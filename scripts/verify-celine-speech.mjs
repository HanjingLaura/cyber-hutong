import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {openStore} from '../server/store.mjs';
import {celineQuestion} from '../shared/celine-speech.mjs';
import {loadPlaywright} from './playwright.mjs';

const natural=process.argv.includes('--natural');
const directory='output/celine-speech-'+Date.now();await mkdir(directory,{recursive:true});
const dbPath=directory+'/game.sqlite',seed=openStore(dbPath),at=Date.now(),question=celineQuestion(.1);
// Seed one live persisted bubble to verify rendering without a 45–90s wait.
// The server regression separately checks natural timing and the six-second TTL.
if(!natural){seed.db.exec('CREATE TABLE IF NOT EXISTS world_npcs(id TEXT PRIMARY KEY,state TEXT NOT NULL)');seed.db.prepare('INSERT INTO world_npcs VALUES(?,?)').run('celine',JSON.stringify({scene:'hutong',started:at,nextVisit:at+540000,nextSpeech:at+90000,question,until:at+60000}));}seed.close();
process.env.HUTONG_INVITE='isolated-celine';
const app=createMvpServer({dbPath,llmOptions:{key:''}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const backend=`http://127.0.0.1:${app.server.address().port}`,vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:0,proxy:{'/api':{target:backend,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1280,height:800}}),errors=[];
try{
 const register=await context.request.post(origin+'/api/register/',{data:{username:'celine_observer',password:'isolated-test-password',role:'sid',invite:process.env.HUTONG_INVITE}});assert.equal(register.status(),200);
 let navigations=0;const page=await context.newPage();page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/');
 await page.waitForFunction(()=>window.__socialPreview?.bridge.connected);
 let observedScene='hutong';
 if(natural){
  // Wait for the persisted random visit, without seeding a timer or refreshing.
  const deadline=Date.now()+600000;
  while(Date.now()<deadline){const row=app.store.db.prepare("SELECT state FROM world_npcs WHERE id='celine'").get(),visitor=row?JSON.parse(row.state):null;if(visitor?.scene){observedScene=visitor.scene;break;}await new Promise(r=>setTimeout(r,1000));}
  if(observedScene!=='hutong'){
   // Initial source-position fixture only; the actual room switch uses E + map.
   const id=app.store.byRole('sid').id;Object.assign(app.players.get(id),{x:596,y:194,fresh:true});
   await page.evaluate(()=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),x:596,y:194});document.querySelector('.world').focus();});
   await page.keyboard.press('e');await page.locator('#location-map[open]').waitFor();const target=page.locator(`[data-place="${observedScene}"]`);await target.click();await target.click();await page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning,observedScene);
  }
 }
 await page.waitForFunction(natural=>window.__officeGuestsPreview?.getState().some(visitor=>visitor.active&&visitor.id==='celine'&&(natural?!!visitor.speech:visitor.speech==='Amber 呢？')),natural,{timeout:natural?185000:30000});
 const rendered=await page.evaluate(scene=>{const game=window.__socialPreview.bridge.game,allowed=['Amber 呢？','Jilly 呢？','Amber 这孩子。'];return game.scene.getScene(scene).children.list.some(child=>child.type==='Text'&&allowed.includes(child.text)&&child.visible);},observedScene);assert.equal(rendered,true);assert.deepEqual(errors,[]);
 assert.equal(navigations,1,'natural observation must not refresh');await page.screenshot({path:directory+'/celine-amber.png'});const report={passed:true,realBrowser:true,persistedNpcSpeechFixture:!natural,naturalTiming:natural,observedScene,elapsedMs:Date.now()-at,navigations,noRefresh:navigations===1,sharedWorldSpeechVisible:true,renderedTextVisible:true,errors};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
}catch(error){await writeFile(directory+'/verification.json',JSON.stringify({passed:false,error:error.message,errors},null,2));throw error;}
finally{await context.close();await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
