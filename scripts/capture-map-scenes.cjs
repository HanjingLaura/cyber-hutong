const fs=require('node:fs');
const {chromium}=require('D:/CodexHome/mcp/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.__hutongPreview?.getState().ready&&window.__socialPreview);
  // Hide actors after room updates have positioned the local and remote avatars.
  await page.evaluate(()=>window.__socialPreview.bridge.game.events.on('prerender',()=>{
   for(const scene of window.__socialPreview.bridge.game.scene.getScenes(true)){
    for(const name of ['actor','actorUpper','curlActor','dancer','reflectedDancer'])scene[name]?.setVisible?.(false);
    for(const name of ['sideLegs','heldItem','reflection','ani','guest'])scene[name]?.hide?.();
    for(const child of scene.children.list){const key=child.texture?.key??'';
     if(child.type==='Text'||/^guest-|^team-v3-|^office-|^ani|^idle$|^walk$|^sideWalk$|^seated$|-(idle|walk|side|seated|hold|curl|dance|piano)(-|$)/.test(key)||child.depth>=850)child.setVisible?.(false);
    }
   }
  }));
  const scenes=['hutong','hawaii','rest'];fs.mkdirSync('output/map-scene-captures',{recursive:true});
  for(const key of scenes){
   await page.evaluate(key=>window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:key==='hutong'?'culture':key})),key);
   await page.waitForFunction(key=>window.__socialPreview.bridge.active?.sys.settings.key===key&&window.__socialPreview.bridge.state(),key);
   await page.waitForTimeout(500);
   const data=await page.locator('#game canvas').evaluate(canvas=>canvas.toDataURL().split(',')[1]);
   fs.writeFileSync(`output/map-scene-captures/${key}.png`,Buffer.from(data,'base64'));
  }
  // Copy together so asset reloads cannot interrupt capture navigation.
  for(const key of scenes)fs.copyFileSync(`output/map-scene-captures/${key}.png`,`assets/maps/${key}.png`);
  console.log('Replaced three map previews with empty furnished scenes');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
