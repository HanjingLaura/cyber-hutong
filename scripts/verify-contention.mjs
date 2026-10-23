import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMvpServer} from '../server/app.mjs';
import {roles} from '../server/personas.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};

const directory='output/contention-'+Date.now();await mkdir(directory,{recursive:true});
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const accounts=[],report={passed:false,scope:'eight isolated HTTP identities; simultaneous claims; setup positions are fixtures; model disabled',seatRounds:0,deviceRounds:0,expectedConflicts:0,checks:{}};
async function api(account,path,input){const start=performance.now(),response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/`+path,{method:'POST',headers:{cookie:account?.cookie??'','Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(10000)});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],ms:performance.now()-start};}
function fixture(scene,point){for(const a of accounts)Object.assign(app.players.get(a.id),{scene,x:point[0],y:point[1],activity:'walk',seat:null,fresh:true,moving:false,at:Date.now()-1000});}
try{
 process.env.HUTONG_INVITE='isolated-contention';
 for(const role of roles){const r=await api(null,'register',{username:'race_'+role,password:'isolated-race-password',role,invite:process.env.HUTONG_INVITE});assert.equal(r.status,200);const a={role,id:r.data.user.id,cookie:r.cookie,client:role+'-first'};accounts.push(a);assert.equal((await api(a,'control',{client:a.client})).status,200);}
 const seat=geometry.rest.seats['2'];
 for(let round=0;round<8;round++){
  fixture('rest',seat.approach);
  const results=await Promise.all(accounts.map(a=>api(a,'presence',{client:a.client,revision:0,scene:'rest',x:seat.at[0],y:seat.at[1],seat:'2',facing:0,activity:'sit',moving:false,hand:null})));
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,7);assert.equal([...app.players.values()].filter(p=>p.scene==='rest'&&p.seat==='2').length,1);
  report.expectedConflicts+=7;report.seatRounds++;const winner=accounts[results.findIndex(r=>r.status===200)];assert.equal((await api(winner,'presence',{client:winner.client,revision:0,scene:'rest',x:seat.approach[0],y:seat.approach[1],seat:null,facing:0,activity:'walk',moving:false,hand:null})).status,200);
  accounts.push(accounts.shift());
 }
 for(let round=0;round<8;round++){
  fixture('gym',geometry.gym.devices['run-0']);
  const results=await Promise.all(accounts.map(a=>api(a,'lease',{client:a.client,device:'run-0'})));assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,7);
  report.expectedConflicts+=7;report.deviceRounds++;const winner=accounts[results.findIndex(r=>r.status===200)];assert.equal((await api(winner,'lease',{client:winner.client,device:'run-0',release:true})).status,200);accounts.push(accounts.shift());
 }
 report.checks.singleSeatAndDeviceWinner=true;
 for(const a of accounts){const previous=a.client;a.client=a.role+'-second';assert.equal((await api(a,'control',{client:a.client})).status,200);assert.equal((await api(a,'lease',{client:previous,device:'run-0'})).status,409,'superseded window must not act');}
 report.checks.supersededWindowsRejected=true;
 // One current controller can still claim and release after all eight takeovers.
 fixture('gym',geometry.gym.devices['run-0']);
 assert.equal((await api(accounts[0],'lease',{client:accounts[0].client,device:'run-0'})).status,200);assert.equal((await api(accounts[0],'lease',{client:accounts[0].client,device:'run-0',release:true})).status,200);report.checks.freshControlUsable=true;
 assert.equal(app.llm.status().budget.calls,0);report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}
finally{await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));app.close();app.server.closeAllConnections();}
