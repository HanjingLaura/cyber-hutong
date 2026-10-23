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
  await page.getByRole('button',{name:'切歌',exact:true}).click();assert.equal((await state()).playback.song.id,'beauty-and-a-beat');
  if(!process.env.KTV_SKIP_CAPTURE)await page.screenshot({path:directory+'/desktop-menu.png'});
  await page.getByRole('button',{name:'返回包厢',exact:true}).click();
  await pose(581,259);await page.keyboard.press('e');assert.equal((await state()).light,'紫光');
  await pose(145,207);await page.keyboard.press('e');assert.equal((await state()).seated,'A1');await page.keyboard.press('Escape');assert.equal((await state()).mode,'walk');
  await pose(200,315);await page.keyboard.down('w');await page.waitForTimeout(550);await page.keyboard.up('w');assert.ok((await state()).y>=299,'table/stools must block movement');
  await pose(417,225);await page.keyboard.press('e');assert.equal((await state()).mode,'sing');
  await page.getByRole('button',{name:'开启 MV',exact:true}).click();assert.equal((await state()).sound,true);
  await page.waitForFunction(()=>{const v=document.querySelector('#ktv-mv video');return v?.readyState>=2&&!v.paused;});
  await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active;scene.player.started=Date.now()-2*(60000/128);scene.player.offset=0;});
  await page.waitForTimeout(40);await page.keyboard.press('Space');assert.equal((await state()).score,100);
  await page.keyboard.press('Space');assert.equal((await state()).score,100,'one beat cannot be counted twice');
  await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active;scene.player.started=Date.now()-64*(60000/128);scene.player.offset=0;});
  await page.waitForTimeout(35);await page.keyboard.press('Space');assert.equal((await state()).score,200,'scoring continues after 32 beats');
  await page.waitForFunction(()=>{const v=document.querySelector('#ktv-mv video');return Math.abs(v.currentTime-window.__ktvPreview.getState().playback.elapsed/1000)<.7;});
  for(const [id,duration] of [['power',167],['beauty-and-a-beat',293],['lover-boy-88',275],['eyes-nose-lips',276]]){
   await page.evaluate(id=>window.__socialPreview.bridge.active.applyKtv('player',{queue:[id],playing:true,started:Date.now()-5000,offset:0}),id);
   await page.waitForFunction(({id,duration})=>{const v=document.querySelector('#ktv-mv video');return v?.currentSrc.includes('ktv-'+id)&&v.readyState>=2&&!v.paused&&Math.abs(v.duration-duration)<1&&v.currentTime>4;},{id,duration});
  }
  await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active,p=window.__ktvPreview.getState().playback;scene.applyKtv('player',{queue:p.queue,playing:false,started:Date.now(),offset:p.elapsed});});
  await page.waitForFunction(()=>document.querySelector('#ktv-mv video').paused);
  const pausedTime=await page.locator('#ktv-mv video').evaluate(v=>v.currentTime);await page.waitForTimeout(250);
  assert.ok(Math.abs(await page.locator('#ktv-mv video').evaluate(v=>v.currentTime)-pausedTime)<.1,'paused MV stays paused');
  await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active;scene.applyKtv('player',{...scene.player,playing:true,started:Date.now()});});
  await page.waitForFunction(()=>!document.querySelector('#ktv-mv video').paused);
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
  await page.getByRole('button',{name:'开启 MV',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#ktv-mv video')?.readyState>=2);
  assert.equal(await page.locator('#ktv-mv').evaluate(el=>{const r=el.getBoundingClientRect(),c=document.querySelector('#game canvas').getBoundingClientRect();return Math.abs(r.top-(c.top+c.height*57/360))<2;}),true,'MV aligns to the mobile room screen');
  await page.screenshot({path:directory+'/mobile-mv.png'});
  await page.setViewportSize({width:844,height:390});if(!process.env.KTV_SKIP_CAPTURE)await page.screenshot({path:directory+'/mobile-landscape.png'});
  await page.locator('#ktv-stop').click();
  await pose(580,321);await page.keyboard.press('e');await page.locator('#location-map').waitFor({state:'visible'});
  const ktv=page.locator('[data-place="ktv"]');assert.equal(await ktv.isDisabled(),true);await page.waitForFunction(()=>{const image=document.querySelector('[data-place="ktv"] img');return image?.complete&&image.naturalWidth>0;});
  await page.locator('[data-place="rest"]').click();await page.locator('[data-place="rest"]').click();await page.waitForFunction(()=>window.__socialPreview.bridge.state()?.scene==='rest');
  assert.equal(await page.locator('#ktv-dock').isVisible(),false);assert.equal((await state()).sound,false);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'concert'})));
  await page.waitForFunction(()=>window.__concertPreview?.getState().active);
  await page.locator('#concert-audio audio').evaluate(a=>a.play());
  await page.waitForFunction(()=>{const a=document.querySelector('#concert-audio audio');return a.readyState>=2&&!a.paused&&a.currentTime>.1;});
  const audioDuration=await page.locator('#concert-audio audio').evaluate(a=>a.duration);assert.ok(audioDuration>180&&audioDuration<190,'full correct concert audio');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'ktv'})));
  await page.waitForFunction(()=>window.__ktvPreview?.getState().active);
  assert.equal(await page.locator('#concert-audio audio').evaluate(a=>a.paused),true,'concert audio stops after leaving');
  assert.deepEqual(errors,[]);
  console.log('Full MV playback and concert audio verified; KTV browser checks passed: map entry/exit, queue, pause/resume, skip, lights, seats, collisions, microphone, beat scoring, audio cleanup, desktop/mobile.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
