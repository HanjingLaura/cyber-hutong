import {createMvpServer} from '../server/app.mjs';
import {monitorEventLoopDelay,performance} from 'node:perf_hooks';

const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const percentile=(samples,p)=>samples.length?[...samples].sort((a,b)=>a-b)[Math.min(samples.length-1,Math.floor(samples.length*p))]:0;
const maximum=samples=>samples.reduce((max,value)=>Math.max(max,value),0);

// All eight players send each movement round concurrently, while every SSE body is drained.
export async function runConcurrentLoad({durationMs=5000,tabs=4,createServer=createMvpServer,onSample=()=>{}}={}){
  const app=createServer({dbPath:':memory:',llmOptions:{key:''}}),channels=[],accounts=[];
  const latency=[],gaps=[],samples=[],errors=[];
  let recording=false,bytes=0,worldEvents=0,poseEvents=0,prepares=0,updates=0;
  const originalPrepare=app.store.db.prepare;
  app.store.db.prepare=function(...args){if(recording)prepares++;return originalPrepare.apply(this,args);};
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const root='http://127.0.0.1:'+app.server.address().port;
  const loop=monitorEventLoopDelay({resolution:10});
  const api=async(path,input,cookie='')=>{
    const started=performance.now();
    const response=await fetch(root+'/api/'+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    if(recording&&path==='presence')latency.push(performance.now()-started);
    if(!response.ok)throw new Error(path+': '+response.status+' '+data.error);
    return{response,data};
  };
  const stream=async(account,index,tab)=>{
    const abort=new AbortController(),channel={abort,world:0,pose:0,lastAt:null,controller:null};channels.push(channel);
    const res=await fetch(root+`/api/events?client=${index}-${tab}`,{headers:{Cookie:account.cookie},signal:abort.signal});
    if(!res.ok)throw new Error('events: '+res.status);
    const reader=res.body.getReader(),decoder=new TextDecoder();
    channel.reading=(async()=>{
      let buffer='';
      try{for(;;){
        const{value,done}=await reader.read();if(done)break;
        if(recording)bytes+=value.byteLength;
        buffer+=decoder.decode(value,{stream:true});
        let end;
        while((end=buffer.indexOf('\n\n'))>=0){
          const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
          const event=/^event: (\w+)/m.exec(frame)?.[1],raw=/^data: (.+)$/m.exec(frame)?.[1];
          if(!raw||!['world','pose'].includes(event))continue;
          const data=JSON.parse(raw);channel.controller=data.controller;
          if(data.self&&data.self.id!==account.id)throw new Error('another account received private state');
          if(event==='pose'&&['self','bag','progress','offers','recent','collection'].some(key=>key in data))throw new Error('private state leaked into pose');
          if(recording){
            if(event==='world'){worldEvents++;channel.world++;}else{poseEvents++;channel.pose++;}
            if(channel.lastAt!==null)gaps.push(performance.now()-channel.lastAt);
            channel.lastAt=performance.now();
          }
        }
      }}catch(error){if(!abort.signal.aborted)errors.push(error.message);}
    })();
    return channel;
  };
  try{
    await Promise.all(roles.map(async(role,i)=>{
      const result=await api('register',{username:'concurrent_'+i,password:'test-password-123',role});
      accounts[i]={cookie:result.response.headers.get('set-cookie').split(';')[0],id:result.data.user.id};
    }));
    // Establish the controlling tab first, then exercise the per-account tab limit.
    await Promise.all(accounts.map((account,i)=>stream(account,i,0)));
    await Promise.all(accounts.flatMap((account,i)=>Array.from({length:tabs-1},(_,n)=>stream(account,i,n+1))));
    for(const[i,account]of accounts.entries())Object.assign(app.players.get(account.id),{scene:'rest',x:90+i*65,y:240,at:Date.now()-3000});
    await wait(250);recording=true;loop.enable();
    const started=performance.now();let nextSample=10000;
    while(performance.now()-started<durationMs){
      await wait(Math.max(0,started+updates*100-performance.now()));
      const results=await Promise.allSettled(accounts.map((account,i)=>api('presence',{client:`${i}-0`,scene:'rest',x:90+i*65+updates%2,y:240,facing:updates%4,moving:true,seat:null,hand:null,revision:0},account.cookie)));
      for(const result of results)if(result.status==='rejected')errors.push(result.reason.message);
      updates++;
      if(performance.now()-started>=nextSample){
        const sample={seconds:Math.round((performance.now()-started)/1000),rss:process.memoryUsage().rss,heap:process.memoryUsage().heapUsed,players:app.players.size,streams:app.streams.size};
        samples.push(sample);onSample(sample);nextSample+=10000;
      }
    }
    await wait(150);const seconds=(performance.now()-started)/1000;
    return{seconds,updates,requests:latency.length,players:app.players.size,streams:app.streams.size,errors,
      requestMs:{p95:percentile(latency,.95),p99:percentile(latency,.99),max:maximum(latency)},
      updateGapMs:{p95:percentile(gaps,.95),max:maximum(gaps)},
      eventLoopMs:{p99:loop.percentile(99)/1e6,max:loop.max/1e6},
      worldEvents,poseEvents,bytes,bytesPerSecond:bytes/seconds,preparedStatements:prepares,
      controllers:channels.filter(c=>c.controller===true).length,
      minimumUpdatesPerStream:Math.min(...channels.map(c=>c.world+c.pose)),samples};
  }finally{
    recording=false;loop.disable();channels.forEach(channel=>channel.abort.abort());
    app.close();app.server.closeAllConnections();
    await Promise.allSettled(channels.map(channel=>channel.reading));
  }
}
