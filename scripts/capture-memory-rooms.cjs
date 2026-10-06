// Render the real game's scenery without any live avatars or interaction hints.
const fs=require('node:fs');
const {chromium}=require('./playwright.cjs').loadPlaywright();
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__hutongPreview?.getState().ready&&window.__socialPreview);
 await page.evaluate(()=>{
  const bridge=window.__socialPreview.bridge;bridge.game.events.on('prerender',()=>{
   for(const scene of bridge.game.scene.getScenes(true)){
    if(scene.sys.settings.key==='bathroom')for(const door of scene.doors??[])door.setVisible(false);
    for(const name of ['actor','actorUpper','curlActor','dancer','reflectedDancer'])scene[name]?.setVisible?.(false);
    for(const name of ['sideLegs','heldItem','reflection','ani','guest'])scene[name]?.hide?.();
    for(const child of scene.children.list){const key=child.texture?.key??'';
     if(child.type==='Text'||/^guest-|^team-v3-|^office-|^ani|^idle$|^walk$|^sideWalk$|^seated$|-(idle|walk|side|seated|hold|curl|dance|piano)(-|$)/.test(key)||child.depth>=850)child.setVisible?.(false);
    }
   }
  });
 });
 fs.mkdirSync('output/memory-room-captures',{recursive:true});
 for(const key of ['hutong','hawaii','rest','pop','bathroom','concert','arcade','noodle','gym','dance','perler','rehearsal','elevator','subway']){
  await page.evaluate(key=>window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:key==='hutong'?'culture':key})),key);
  await page.waitForFunction(key=>window.__socialPreview.bridge.active?.sys.settings.key===key&&window.__socialPreview.bridge.state(),key);
  await page.waitForTimeout(500);
  const png=await page.locator('#game canvas').evaluate(canvas=>canvas.toDataURL().split(',')[1]);fs.writeFileSync('output/memory-room-captures/'+key+'.png',Buffer.from(png,'base64'));
 }
 fs.mkdirSync('assets/maps/memories',{recursive:true});for(const file of fs.readdirSync('output/memory-room-captures'))if(file.endsWith('.png'))fs.copyFileSync('output/memory-room-captures/'+file,'assets/maps/memories/'+file);
 console.log('Captured 14 game backgrounds without avatars');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
