const fs=require('node:fs');const assert=require('node:assert/strict');
const {chromium}=require('D:/CodexHome/mcp/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 try{
  fs.mkdirSync('output/playwright',{recursive:true});const page=await browser.newPage({viewport:{width:960,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/members.html');await page.waitForFunction(()=>window.__memberPreview?.getState().ready);
  await page.locator('#team-direction').selectOption('1');
  for(const [action,name]of [['1','walk'],['9','run']]){
   await page.locator('#team-action').selectOption(action);const poses=[];
   for(let i=0;i<8;i++){await page.locator('#team-frame').fill(String(i));await page.waitForTimeout(45);poses.push((await page.evaluate(()=>window.__memberPreview.getState())).frames.find(f=>f.id==='laura').pose);}
   assert.equal(new Set(poses).size,8);assert.deepEqual(poses,Array.from({length:8},(_,i)=>name+'-side-v5-'+i));
   await page.locator('#team-direction').selectOption('3');await page.waitForTimeout(80);assert.equal((await page.evaluate(()=>window.__memberPreview.getState())).frames.find(f=>f.id==='laura').pose,name+'-side-v5-7');
   await page.locator('#team-direction').selectOption('1');
  }
  assert.deepEqual(errors,[]);
  // Render the production TeamAvatar into a contact-sheet review scene. This is a screenshot, not image editing.
  await page.goto('http://127.0.0.1:5173/members.html');
  await page.evaluate(async()=>{
   const {default:Phaser}=await import('/node_modules/.vite/deps/phaser.js');const {TeamAvatar}=await import('/src/multiplayer/avatar.ts');
   document.body.innerHTML='<div id="cycle"></div>';document.body.style.margin='0';document.querySelector('head').querySelectorAll('style').forEach(el=>el.remove());
   class Cycle extends Phaser.Scene{
    create(){this.views=[];for(let i=0;i<16;i++){const x=80+i%4*160,y=100+Math.floor(i/4)*115;this.add.text(x,y-100,(i<8?'走路 ':'跑步 ')+(i%8),{fontFamily:'Consolas',fontSize:'13px',color:'#eee8dc'}).setOrigin(.5,0);this.views.push(new TeamAvatar(this,'laura'));}window.__lauraCycle={ready:()=>this.views.every(v=>v.ready)};}
    update(_time,delta){this.views.forEach((v,i)=>{const x=80+i%4*160,y=100+Math.floor(i/4)*115;v.draw({role:'laura',name:'Laura',scene:'review',x,y,facing:1,moving:true,seat:null,hand:null,revision:0},x,y,1,delta,false,76,1,false,i<8?'':'run',undefined,i%8);});}
   }
   new Phaser.Game({type:Phaser.CANVAS,width:640,height:480,parent:'cycle',backgroundColor:'#343b3c',pixelArt:true,antialias:false,roundPixels:true,scene:Cycle,audio:{noAudio:true}});
  });
  await page.waitForFunction(()=>window.__lauraCycle?.ready());await page.waitForTimeout(150);await page.locator('#cycle canvas').screenshot({path:'output/playwright/laura-v5-cycle.png'});
  console.log('Verified eight distinct walk phases, eight distinct run phases, left/right playback and no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
