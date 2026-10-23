import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadPlaywright} from './playwright.mjs';
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true});
const origin=process.env.TTC_ORIGIN||'http://127.0.0.1:5174';
const out='output/ttc/expanded';await mkdir(out,{recursive:true});
const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/ttc.html');await page.getByRole('button',{name:'开始寻找'}).waitFor();
 const config=await page.evaluate(async()=>{const m=await import('/src/ttc/scenes.ts');return {members:m.members,scenes:m.scenes.map(s=>({width:s.width,targets:s.targets,name:s.name}))};});
 const pan=async(p,value)=>p.getByRole('slider',{name:'移动视野'}).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
 for(let si=0;si<config.scenes.length;si++){
  await page.getByLabel('选择场景').selectOption(String(si));
  for(const role of config.members){
   await page.getByLabel('选择人物').selectOption(role);await page.getByRole('button',{name:'开始寻找'}).click();
   if(role==='cora')await page.screenshot({path:`${out}/scene-${si}.png`});
   const sc=config.scenes[si];
   if(sc.width>1280){
    const b=await page.locator('.ttc-scene').boundingBox();await page.mouse.move(b.x+b.width*.8,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*.2,b.y+b.height*.7,{steps:8});await page.mouse.up();
    assert.ok(Number(await page.getByRole('slider').inputValue())>0);assert.equal(await page.locator('.ttc-feedback').textContent(),'');
   }
   for(let i=0;i<sc.targets.length;i++){
    const t=sc.targets[i],camera=Math.max(0,Math.min(sc.width-1280,t.x-500));await pan(page,camera);
    const b=await page.locator('.ttc-scene').boundingBox();
    await page.mouse.click(b.x+(t.x+t.w*.5-camera)/1280*b.width,b.y+(t.y+t.h*.3)/720*b.height);
    await page.waitForFunction(n=>document.querySelector('.ttc-target small').textContent===`${n} / 5`,i+1,{timeout:3000});
   }
   await page.getByText('找齐了 '+role[0].toUpperCase()+role.slice(1),{exact:true}).waitFor();
   checks.push(`${sc.name}/${role}: all five targets hit after panning`);
  }
 }
 // Change selections quickly while images are loading; the final selected identity must win.
 await page.getByLabel('选择人物').selectOption('cora');await page.getByLabel('选择场景').selectOption('2');await page.getByLabel('选择人物').selectOption('franco');
 await page.getByRole('button',{name:'开始寻找'}).waitFor();assert.equal(await page.locator('.ttc-member-name').textContent(),'Franco');
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(origin+'/ttc.html');await mp.getByRole('button',{name:'开始寻找'}).click();
 const b=await mp.locator('.ttc-scene').boundingBox(),cdp=await mobile.newCDPSession(mp);
 const x=b.x+b.width*.85,y=b.y+b.height*.75;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*b.width*.075,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(Number(await mp.getByRole('slider').inputValue())>0);assert.equal(await mp.locator('.ttc-feedback').textContent(),'');
 await mp.getByRole('button',{name:'向右看',exact:true}).click();await mp.getByRole('button',{name:'放大',exact:true}).click();
 await mp.screenshot({path:out+'/mobile.png'});
 assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));checks.push('real mobile swipe does not shoot; no page scrolling');
 await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'开始寻找'}).click();await page.screenshot({path:out+'/landscape.png'});
 assert.ok(await page.locator('.ttc-game').evaluate(e=>e.scrollHeight<=e.clientHeight+2));
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,errors}));
}finally{await browser.close();}
