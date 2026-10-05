const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('./playwright.cjs').loadPlaywright();
const roles=['suki','sid','jilly','laura','kay','franco','cora','amber','celine'];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [action,mode,version]of [['1','walk','v8'],['9','run','v10']]){
   await page.goto(`http://127.0.0.1:5173/members.html?action=${action}&direction=1`);await page.waitForFunction(()=>window.__memberPreview?.getState().ready);
   for(const direction of ['1','3']){
    await page.locator('#team-direction').selectOption(direction);
    for(let phase=0;phase<8;phase++){
     await page.locator('#team-frame').fill(String(phase));await page.waitForTimeout(55);
     const state=await page.evaluate(()=>window.__memberPreview.getState());assert.equal(state.frames.length,9);
     state.frames.forEach(frame=>{assert.equal(frame.ready,true);assert.equal(frame.pose,`${mode}-side-${version}-${phase}`,frame.id);});
    }
   }
   await page.evaluate(async({roles,mode})=>{
    const {default:Phaser}=await import('/node_modules/.vite/deps/phaser.js'),{TeamAvatar}=await import('/src/multiplayer/avatar.ts'),{characterRegistry}=await import('/src/character-assets.ts');
    document.body.innerHTML='<div id="cycles"></div>';document.body.style.margin='0';document.querySelectorAll('style').forEach(el=>el.remove());
    class Cycles extends Phaser.Scene{
     create(){this.views=[];roles.forEach((role,row)=>{for(let phase=0;phase<8;phase++){this.views.push({role,row,phase,view:new TeamAvatar(this,role)});}});window.__teamCycles={ready:()=>this.views.every(v=>v.view.ready),geometry:()=>this.views.map(({role,row,phase,view})=>{
      const data=characterRegistry.members[role],frame=data.frames[(mode==='run'?data.runLoop:data.sideWalkLoop)[phase]],body=view.body,m=frame.headMetrics;
      return {role,phase,headWidth:m.headWidth*body.scaleX,headHeight:m.landmarkHeight*body.scaleY,headTop:body.y-frame.rect[3]*body.scaleY-row*112,headCenter:body.x+(m.centerX-frame.rect[2]*body.originX)*body.scaleX-phase*150};
     })};}
     update(_time,delta){for(const v of this.views){const x=85+v.phase*150,y=106+v.row*112;v.view.draw({role:v.role,name:v.role,scene:'review',x,y,facing:1,moving:true,seat:null,hand:null,revision:0},x,y,1,delta,false,78,1,false,mode==='run'?'run':'',undefined,v.phase);}}
    }
    new Phaser.Game({type:Phaser.CANVAS,width:1280,height:1008,parent:'cycles',backgroundColor:'#343b3c',pixelArt:true,antialias:false,roundPixels:true,scene:Cycles,audio:{noAudio:true}});
   },{roles,mode});
   await page.waitForFunction(()=>window.__teamCycles?.ready());await page.waitForTimeout(150);
   const geometry=await page.evaluate(()=>window.__teamCycles.geometry());
   for(const role of roles){const frames=geometry.filter(f=>f.role===role);for(const metric of ['headWidth','headHeight','headTop','headCenter']){const values=frames.map(f=>f[metric]);assert.ok(Math.max(...values)-Math.min(...values)<1.01,`${role} ${mode} ${metric} drifts`);}}
   fs.mkdirSync('output/playwright',{recursive:true});await page.locator('#cycles canvas').screenshot({path:`output/playwright/team-${mode}-normalized.png`});
  }
  assert.deepEqual(errors,[]);console.log('Verified nine walk and run cycles, eight distinct phases, both directions, invariant rendered head width/height and < 1px head anchor drift.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
