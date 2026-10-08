const {chromium}=require('./playwright.cjs').loadPlaywright();
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 const directory='output/playwright/ktv';fs.mkdirSync(directory,{recursive:true});
 try{
  let page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.KTV_TEST_URL||'http://127.0.0.1:5173/?debug=1');
  await page.waitForFunction(()=>window.__socialPreview&&window.__hutongPreview?.getState().ready);
  // Guest-only developer inspection; never changes accounts or persistent player state.
  await page.evaluate(()=>{document.querySelector('#account-dialog').close();window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'ktv'}));});
  await page.waitForFunction(()=>window.__ktvPreview?.getState().ready&&window.__ktvPreview.getState().active);
  const pose=async(x,y)=>{await page.evaluate(({x,y})=>{window.__socialPreview.bridge.apply({...window.__socialPreview.bridge.state(),x,y});document.querySelector('.world').focus();},{x,y});await page.waitForTimeout(80);};
  const state=()=>page.evaluate(()=>window.__ktvPreview.getState());
  await pose(557,226);await page.keyboard.press('e');await page.locator('#ktv-menu').waitFor({state:'visible'});
  await page.getByRole('button',{name:'点歌',exact:true}).nth(0).click();
  await page.getByRole('button',{name:'点歌',exact:true}).nth(1).click();
  assert.equal((await state()).playback.queue.length,2);
  await page.getByRole('button',{name:'暂停',exact:true}).click();assert.equal((await state()).playback.playing,false);
  const elapsed=(await state()).playback.elapsed;await page.waitForTimeout(220);assert.equal((await state()).playback.elapsed,elapsed);
  await page.getByRole('button',{name:'继续播放',exact:true}).click();
  await page.getByRole('button',{name:'切歌',exact:true}).click();assert.equal((await state()).playback.song.id,'breeze');
  if(!process.env.KTV_SKIP_CAPTURE)await page.screenshot({path:directory+'/desktop-menu.png'});
  await page.getByRole('button',{name:'返回包厢',exact:true}).click();
  await pose(581,259);await page.keyboard.press('e');assert.equal((await state()).light,'紫光');
  await pose(145,207);await page.keyboard.press('e');assert.equal((await state()).seated,'A1');await page.keyboard.press('Escape');assert.equal((await state()).mode,'walk');
  await pose(200,315);await page.keyboard.down('w');await page.waitForTimeout(550);await page.keyboard.up('w');assert.ok((await state()).y>=299,'table/stools must block movement');
  await pose(417,225);await page.keyboard.press('e');assert.equal((await state()).mode,'sing');
  await page.getByRole('button',{name:'开启伴奏',exact:true}).click();assert.equal((await state()).sound,true);
  await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active;scene.player.started=Date.now()-2*(60000/90);scene.player.offset=0;});
  await page.waitForTimeout(40);await page.keyboard.press('Space');assert.equal((await state()).score,100);
  await page.keyboard.press('Space');assert.equal((await state()).score,100,'one beat cannot be counted twice');
  if(!process.env.KTV_SKIP_CAPTURE)await page.screenshot({path:directory+'/desktop.png'});
  // Actual Phaser 640×360 scene is the map preview, with the local avatar hidden for this frame.
  await page.locator('#ktv-stop').click();
  await page.evaluate(()=>{const game=window.__socialPreview.bridge.game;const handler=()=>{for(const child of window.__socialPreview.bridge.active.children.list)if((child.texture?.key??'').startsWith('team-v3-')||child.depth>=850)child.setVisible?.(false);};game.events.on('prerender',handler);window.__ktvCaptureHandler=handler;});
  await page.waitForTimeout(60);
  const map=await page.locator('#game canvas').evaluate(canvas=>canvas.toDataURL().split(',')[1]);fs.writeFileSync(directory+'/map.png',Buffer.from(map,'base64'));
  await page.evaluate(()=>window.__socialPreview.bridge.game.events.off('prerender',window.__ktvCaptureHandler));
  const sharedPlayer=(await state()).player;
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page=await mobile.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.KTV_TEST_URL||'http://127.0.0.1:5173/?debug=1');await page.waitForFunction(()=>window.__socialPreview&&window.__hutongPreview?.getState().ready);
  await page.evaluate(()=>{document.querySelector('#account-dialog').close();window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'ktv'}));});await page.waitForFunction(()=>window.__ktvPreview?.getState().ready&&window.__ktvPreview.getState().active);
  await page.evaluate(player=>window.__socialPreview.bridge.active.applyKtv('player',player),sharedPlayer);
  await pose(557,226);await page.locator('#touch-primary').tap();await page.locator('#ktv-menu').waitFor({state:'visible'});if(!process.env.KTV_SKIP_CAPTURE)await page.screenshot({path:directory+'/mobile-menu.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  await page.getByRole('button',{name:'返回包厢',exact:true}).click();await pose(417,225);await page.keyboard.press('e');if(!process.env.KTV_SKIP_CAPTURE)await page.screenshot({path:directory+'/mobile.png'});
  await page.setViewportSize({width:844,height:390});if(!process.env.KTV_SKIP_CAPTURE)await page.screenshot({path:directory+'/mobile-landscape.png'});
  await page.locator('#ktv-stop').click();
  await pose(580,321);await page.keyboard.press('e');await page.locator('#location-map').waitFor({state:'visible'});
  const ktv=page.locator('[data-place="ktv"]');assert.equal(await ktv.isDisabled(),true);await page.waitForFunction(()=>{const image=document.querySelector('[data-place="ktv"] img');return image?.complete&&image.naturalWidth>0;});
  await page.locator('[data-place="rest"]').click();await page.locator('[data-place="rest"]').click();await page.waitForFunction(()=>window.__socialPreview.bridge.state()?.scene==='rest');
  assert.equal(await page.locator('#ktv-dock').isVisible(),false);assert.equal((await state()).sound,false);
  assert.deepEqual(errors,[]);fs.copyFileSync(directory+'/map.png','assets/maps/memories/ktv.png');
  console.log('KTV browser checks passed: map entry/exit, queue, pause/resume, skip, lights, seats, collisions, microphone, beat scoring, audio cleanup, desktop/mobile.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
