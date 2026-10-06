const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('./playwright.cjs').loadPlaywright();
const roles=['suki','sid','jilly','laura','kay','franco','cora','amber','celine'];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/members.html?action=1&direction=1');await page.waitForFunction(()=>window.__memberPreview?.getState().ready);
  for(const direction of ['1','3']){
   await page.locator('#team-direction').selectOption(direction);
   for(let phase=0;phase<8;phase++){
    await page.locator('#team-frame').fill(String(phase));await page.waitForTimeout(60);
    const state=await page.evaluate(()=>window.__memberPreview.getState());
    assert.equal(state.frames.length,9);
    for(const frame of state.frames){assert.equal(frame.ready,true);assert.equal(frame.pose,`walk-side-v8-${phase}`,frame.id);}
   }
  }
  // The live preview and game share TeamAvatar; use it for a full-cycle contact sheet.
  await page.evaluate(async roles=>{
   const {default:Phaser}=await import('/node_modules/.vite/deps/phaser.js'),{TeamAvatar}=await import('/src/multiplayer/avatar.ts');
   document.body.innerHTML='<div id="cycles"></div>';document.body.style.margin='0';document.querySelectorAll('style').forEach(el=>el.remove());
   class Cycles extends Phaser.Scene{
    create(){this.views=[];roles.forEach((role,row)=>{this.add.text(6,row*112+4,role,{fontFamily:'Consolas',fontSize:'13px',color:'#eee8dc'});for(let phase=0;phase<8;phase++){this.views.push({role,row,phase,view:new TeamAvatar(this,role)});this.add.text(80+phase*150,row*112+6,String(phase),{fontSize:'11px',color:'#d9d9d9'});}});window.__teamCycles={ready:()=>this.views.every(v=>v.view.ready)};}
    update(_time,delta){for(const v of this.views){const x=85+v.phase*150,y=106+v.row*112;v.view.draw({role:v.role,name:v.role,scene:'review',x,y,facing:1,moving:true,seat:null,hand:null,revision:0},x,y,1,delta,false,78,1,false,'',undefined,v.phase);}}
   }
   new Phaser.Game({type:Phaser.CANVAS,width:1280,height:1008,parent:'cycles',backgroundColor:'#343b3c',pixelArt:true,antialias:false,roundPixels:true,scene:Cycles,audio:{noAudio:true}});
  },roles);
  await page.waitForFunction(()=>window.__teamCycles?.ready());await page.waitForTimeout(200);fs.mkdirSync('output/playwright',{recursive:true});await page.locator('#cycles canvas').screenshot({path:'output/playwright/team-walk-v8-cycles.png'});
  await page.goto('http://127.0.0.1:5173/members.html');
  await page.waitForFunction(()=>window.__memberPreview?.getState().ready);
  await page.evaluate(async()=>{
   const {default:Phaser}=await import('/node_modules/.vite/deps/phaser.js'),{OfficeGuest,preloadOfficeGuests}=await import('/src/office-guests.ts'),{WORKSTATIONS}=await import('/src/layout.ts');
   document.body.innerHTML='<div id="npc"></div>';document.querySelectorAll('style').forEach(el=>el.remove());
   class NPC extends Phaser.Scene{
    preload(){preloadOfficeGuests(this);}
    create(){
     this.guests=[];
     for(let phase=0;phase<8;phase++){
      const guest=new OfficeGuest(this,false,WORKSTATIONS);Object.assign(guest,{id:'celine',mode:'walking',facing:1,motion:phase*100,x:85+phase*150,y:105,suppressed:false});guest.draw(false,true);this.guests.push(guest);
     }
     window.__npcWalk=this.guests.map(guest=>({texture:guest.body.texture.key,frame:guest.body.frame.name,visible:guest.body.visible}));
    }
   }
   new Phaser.Game({type:Phaser.CANVAS,width:1280,height:130,parent:'npc',backgroundColor:'#343b3c',pixelArt:true,antialias:false,roundPixels:true,scene:NPC,audio:{noAudio:true}});
  });
  await page.waitForFunction(()=>window.__npcWalk?.length===8);
  const npc=await page.evaluate(()=>window.__npcWalk);assert.equal(new Set(npc.map(p=>p.frame)).size,8);
  npc.forEach((p,i)=>{assert.equal(p.visible,true);assert.equal(p.texture,`office-motion-celine-walk-${i<4?'a':'b'}-v8`);});
  assert.deepEqual(errors,[]);console.log('Verified 9 characters × 8 phases × both side directions and the production Celine NPC, no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
