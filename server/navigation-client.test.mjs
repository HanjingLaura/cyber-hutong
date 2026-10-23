import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import ts from 'typescript';

const source=readFileSync(new URL('../src/room-navigation.ts',import.meta.url),'utf8');
const start=source.indexOf(' const go=async('),end=source.indexOf(" document.querySelector('#room-open')",start);
const compiled=ts.transpileModule(source.slice(start,end)+'\ngo.cancel=()=>preparing?.abort();return go;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const canTravelSource=source.slice(source.indexOf(' const canTravel='),source.indexOf(' const exitNear='));
test('quick travel allows standing beside an object without treating proximity as an active interaction',()=>{
 const code=ts.transpileModule(canTravelSource+'\nreturn canTravel;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 let pose={seat:null,activity:'walk'};const bridge={state:()=>pose,active:{prefersInteraction:()=>true}};
 const canTravel=new Function('bridge','quickSetting','exitNear',code)(bridge,{checked:true},()=>false);
 assert.equal(canTravel(),true);pose={seat:'0',activity:'sit'};assert.equal(canTravel(),false);
});
function fixture({prepare='ready',load=async()=>{},submit=async()=>({player:{role:'sid',scene:'rest',x:554,y:184}}),recover=async()=>({player:{role:'sid',scene:'rest',x:554,y:184}}),confirm=async()=>{},render=async()=>{}}={}){
 const calls=[],controls=[{disabled:false}],close={disabled:false},status={textContent:''},enter={disabled:false};let area='hutong';
 const before={role:'sid',scene:'hutong',x:596,y:194,seat:null,activity:'walk'};
 const destination={events:new EventEmitter(),load:new EventEmitter(),sys:{isSleeping:()=>prepare==='ready',isActive:()=>false,isPaused:()=>prepare==='paused'}};
 const bridge={transitioning:false,user:{role:'sid'},controller:true,connected:true,players:[before],state:()=>before,active:{input:{keyboard:{resetKeys(){calls.push('reset');}}}},game:{scene:{getScene:()=>destination,run(){if(prepare==='error')queueMicrotask(()=>destination.load.emit('loaderror'));},stop(){calls.push('stop');}}},apply(player){area=player.scene;calls.push('apply:'+player.scene);}};
 const dialog={open:true,querySelector:s=>s==='[data-cancel]'?close:status,querySelectorAll:()=>controls,close(){this.open=false;}};
 const document={querySelector:s=>s==='.world'?{focus(){calls.push('focus');}}:null};
 const request=async(path,input)=>{calls.push(path);if(path==='transition')return submit(input);return recover();};
 const go=new Function('bridge','dialog','canTravel','quickSetting','exitNear','findExit','notice','document','enterButton','warmRoom','rooms','publish','request','client','changeScene','open','prepareRoom',`let busy=false,preparing;${compiled}`)(bridge,dialog,()=>true,{checked:false},()=>true,()=>{},message=>calls.push('notice:'+message),document,enter,()=>{}, {rest:{exit:[554,184]}},async()=>{calls.push('publish');await confirm();},request,'tab',async scene=>{calls.push('scene:'+scene);await render(scene);},()=>calls.push('map'),load);
 return {go,bridge,calls,close,dialog,area:()=>area};
}
test('navigation locks once, confirms before committing, and applies the server entry before restoring input',async()=>{
 let acknowledge;const f=fixture({confirm:()=>new Promise(resolve=>acknowledge=resolve)});
 const move=f.go('rest');assert.equal(f.bridge.transitioning,true);assert.equal(f.close.disabled,false);
 await f.go('rest');assert.equal(f.calls.filter(c=>c==='publish').length,1);assert.equal(f.calls.includes('transition'),false);
 acknowledge();await move;
 assert.deepEqual(f.calls.filter(c=>['publish','transition','scene:rest','apply:rest'].includes(c)),['publish','transition','scene:rest','apply:rest']);
 assert.equal(f.bridge.transitioning,false);assert.equal(f.area(),'rest');assert.equal(f.close.disabled,false);
});
test('asset failure submits no move and releases the operation lock for retry',async()=>{
 const f=fixture({prepare:'error'});await f.go('rest');
 assert.equal(f.calls.includes('transition'),false);assert.equal(f.area(),'hutong');assert.equal(f.bridge.transitioning,false);
 assert.equal(f.close.disabled,false);assert.equal(f.calls.includes('map'),true);
});
test('lost transition response recovers the committed server scene and later navigation remains usable',async()=>{
 let attempt=0;const f=fixture({submit:async()=>{if(!attempt++)throw new Error('response timeout');return{player:{role:'sid',scene:'rest',x:554,y:184}};}});
 await f.go('rest');assert.equal(f.area(),'rest');assert.equal(f.bridge.transitioning,false);
 assert.ok(f.calls.indexOf('location')>f.calls.indexOf('transition'));assert.equal(f.close.disabled,false);
 await f.go('rest');assert.equal(attempt,2);assert.equal(f.bridge.transitioning,false);
});
test('failed recovery rendering still releases the operation lock',async()=>{
 const f=fixture({submit:async()=>{throw new Error('timeout');},render:async()=>{throw new Error('render failed');}});
 await f.go('rest');assert.equal(f.bridge.transitioning,false);assert.equal(f.close.disabled,false);assert.equal(f.area(),'hutong');
});
test('failed location recovery pauses stale presence until an authoritative reconnect can recover',async()=>{
 const f=fixture({submit:async()=>{throw new Error('timeout');},recover:async()=>{throw new Error('offline');}});
 await f.go('rest');assert.equal(f.bridge.transitioning,false);assert.equal(f.bridge.navigationRecovery,true);
 const commits=f.calls.filter(c=>c==='transition').length;await f.go('rest');assert.equal(f.calls.filter(c=>c==='transition').length,commits);
});
test('stalled assets time out, remove late callbacks and unlock the map',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({prepare:'stall'}),move=f.go('rest');
 for(let n=0;n<8;n++)await Promise.resolve();
 t.mock.timers.tick(12000);await move;assert.equal(f.bridge.transitioning,false);assert.equal(f.close.disabled,false);
 assert.equal(f.calls.includes('transition'),false);assert.equal(f.calls.includes('stop'),true);
});

test('returning to a paused scene resumes it instead of waiting for a second create event',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({prepare:'paused'}),move=f.go('rest');
 for(let n=0;n<8;n++)await Promise.resolve();t.mock.timers.tick(12000);await move;
 assert.equal(f.calls.includes('transition'),true);assert.equal(f.area(),'rest');assert.equal(f.bridge.transitioning,false);
});

test('canceling a slow cold asset load sends no transition and allows a fresh attempt',async()=>{
 let first=true;const f=fixture({load:(_target,_game,_progress,signal)=>{
  if(!first)return Promise.resolve();first=false;
  return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('已取消地点载入')),{once:true}));
 }});
 const pending=f.go('rest');assert.equal(f.close.disabled,false);f.go.cancel();await pending;
 assert.equal(f.bridge.transitioning,false);assert.equal(f.calls.includes('transition'),false);
 await f.go('rest');assert.equal(f.area(),'rest');assert.equal(f.bridge.transitioning,false);
});

test('canceling scene creation stops the uncommitted scene and immediately unlocks navigation',async()=>{
 const f=fixture({prepare:'stall'}),pending=f.go('rest');
 for(let n=0;n<8;n++)await Promise.resolve();f.go.cancel();await pending;
 assert.equal(f.calls.includes('stop'),true);assert.equal(f.calls.includes('transition'),false);
 assert.equal(f.bridge.transitioning,false);assert.equal(f.close.disabled,false);
});

test('cancel also releases a cached destination while its position checkpoint is still pending',async()=>{
 let acknowledge,settled=false;const f=fixture({confirm:()=>new Promise(resolve=>acknowledge=resolve)});
 const pending=f.go('rest').then(()=>settled=true);for(let n=0;n<8;n++)await Promise.resolve();
 f.go.cancel();for(let n=0;n<12;n++)await Promise.resolve();
 const canceledBeforeReply=settled;acknowledge();await pending;
 assert.equal(canceledBeforeReply,true,'cancel must not wait for an old HTTP checkpoint');
 assert.equal(f.calls.includes('transition'),false);assert.equal(f.bridge.transitioning,false);
});
