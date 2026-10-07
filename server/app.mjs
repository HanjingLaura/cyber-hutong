import workstations from '../shared/workstations.json' with {type:'json'};
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { openStore,fail } from './store.mjs';
import { roles,replyFor } from './personas.mjs';
import rooms from '../shared/rooms.json' with {type:'json'};
import interactions from '../shared/interactions.json' with {type:'json'};
import npcRules from '../shared/npcs.json' with {type:'json'};
import guestPositions from '../shared/guests.json' with {type:'json'};
import {createWorld} from './world.mjs';
import {createLife,memoryPolicy} from './life.mjs';
import {createAutonomy,walkable} from './autonomy.mjs';
import {createBailian} from './llm.mjs';
import {createDirector} from './director.mjs';
import {createRewards,plushNames} from './rewards.mjs';
import {createCeline} from './celine.mjs';
import {issueTicket} from '../shared/party-ticket.mjs';
import {PARTY_ROOM_ID} from '../shared/party-room.mjs';
export const scenes=['hutong','hawaii','rest','pop','bathroom','concert','arcade','noodle','gym','dance','perler','rehearsal','elevator','subway'];
const partySecret=()=>process.env.PARTY_AUTH_SECRET||'';
const items=['咖啡','可乐','气泡水','薯片','面包','火腿肠','辣条','马卡龙','蛋糕','冰红茶','碗筷','米线','鸡柳','炸鸡','水','扭蛋·粉色小熊','扭蛋·薄荷兔子','扭蛋·蓝色机器人','扭蛋·橘猫','扭蛋·紫色小巫师','扭蛋·皇冠小熊'];
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const cookie=req=>String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('hutong_session='))?.slice(15);
async function body(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>16384)fail(413,'请求内容过长');parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{fail(400,'请求格式不正确');}}
const name=role=>role[0].toUpperCase()+role.slice(1);
// Public deployments live under /cyber-hutong/ (Vite base). Requests may arrive with or without that prefix.
export const basePath=(process.env.HUTONG_BASE_PATH??'/cyber-hutong').replace(/\/+$/,'');
export const stripBase=url=>{const i=url.indexOf('?'),path=i===-1?url:url.slice(0,i),query=i===-1?'':url.slice(i);let next=path===basePath||path.startsWith(basePath+'/')?(path.slice(basePath.length)||'/'):path;if(next.startsWith('/api/')&&next.length>5)next=next.replace(/\/+$/,'');return next+query;};
const allowedHosts=()=>String(process.env.HUTONG_ALLOWED_HOSTS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
const clientAddress=req=>process.env.VERCEL?String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress:req.socket.remoteAddress;
export function createMvpServer({dbPath='data/mvp.sqlite',staticDir=resolve('dist'),llmOptions={}}={}){
  const store=openStore(dbPath),players=new Map(),streams=new Set(),rates=new Map();
  const controlStmt={get:store.db.prepare('SELECT client,at FROM controllers WHERE account=?'),set:store.db.prepare('INSERT INTO controllers(account,client,at) VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET client=excluded.client,at=excluded.at'),del:store.db.prepare('DELETE FROM controllers WHERE account=?')};
    // Control lives in SQLite (replicated across Vercel instances). Instances must only release control they can
  // prove is theirs/stale; deleting it from one instance used to demote the user's live tab on another instance.
  const controls={get(id){return controlStmt.get.get(id)?.client;},has(id){return !!controlStmt.get.get(id);},set(id,client){controlStmt.set.run(id,client,Date.now());return this;},delete(id){controlStmt.del.run(id);return true;},
    touch(id,client){const row=controlStmt.get.get(id);if(row?.client===client&&Date.now()-row.at>10000)controlStmt.set.run(id,client,Date.now());},
    release(id,client){if(controlStmt.get.get(id)?.client===client)controlStmt.del.run(id);},
    stale(id,ms=60000){const row=controlStmt.get.get(id);return !row||Date.now()-row.at>ms;}};
  // Cross-instance liveness: a human heartbeat in SQLite. Autonomy/LLM never drives an account seen live recently.
  store.db.exec('CREATE TABLE IF NOT EXISTS live_presence(account TEXT PRIMARY KEY,at INTEGER NOT NULL)');
  const liveStmt={set:store.db.prepare('INSERT INTO live_presence VALUES(?,?) ON CONFLICT(account) DO UPDATE SET at=excluded.at'),get:store.db.prepare('SELECT at FROM live_presence WHERE account=?')};
  const liveMarks=new Map();
  const markLive=id=>{const now=Date.now();if(now-(liveMarks.get(id)||0)<5000)return;liveMarks.set(id,now);liveStmt.set.run(id,now);};
  const seenLive=(id,ms=60000)=>Date.now()-(liveStmt.get.get(id)?.at||0)<ms;
  const leases=new Map();const life=createLife(store),autonomy=createAutonomy(store,life,players,leases,id=>seenLive(id));
  const world=createWorld(store,life),replyCooldown=new Map(),llm=createBailian(store,life,llmOptions);
  const rewards=createRewards(store,life,world,leases);
  const npcReactions=new Map();
  const celine=createCeline(store);
  let dirty=true,closed=false,visitorSignature='';
  const live=role=>[...players.values()].find(p=>p.role===role&&!p.disconnectedAt);
  const cleanPlayer=p=>{const a=store.byId(p.id);return {role:p.role,name:name(p.role),scene:p.scene,x:p.x,y:p.y,facing:p.facing,moving:p.moving,seat:p.seat,hand:a.hand,revision:a.revision,activity:p.activity};};
  life.setSceneProvider(scene=>({version:1,actors:autonomy.all().filter(p=>p.scene===scene).map(cleanPlayer),objects:world.snapshot(scene),npcs:npcRules.filter(rule=>rule.room===scene&&(rule.condition==='always'||autonomy.all().some(p=>p.role===rule.owner&&p.scene===scene&&(rule.condition!=='working'||p.activity==='working'&&workstations[p.scene]?.[p.role]===p.seat)))).map(rule=>({id:rule.id,...guestPositions[rule.id],text:npcReactions.get(rule.id)?.expires>Date.now()?npcReactions.get(rule.id).text:undefined})).concat((()=>{const v=celine.snapshot(autonomy.all());return v.scene===scene?[{...v,height:61.44}]:[];})())}),id=>{const p=autonomy.all().find(p=>p.id===id);return p?cleanPlayer(p):null;});
  const emit=(stream,type,data)=>{if(stream.res.writableEnded||stream.res.destroyed)return;const payload=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;if(stream.res.writableLength>256000){stream.res.destroy();return;}stream.res.write(payload);};
  const roomFor=id=>players.get(id)?.scene||'hutong';
  const snapshot=stream=>{if(!controls.has(stream.user))controls.set(stream.user,stream.client);const user=store.publicAccount(store.byId(stream.user));return {self:user,controller:controls.get(stream.user)===stream.client,players:autonomy.all().filter(p=>p.scene===roomFor(stream.user)).map(p=>({...cleanPlayer(p),offline:autonomy.doubles.has(p.id)})),online:[...players.values()].filter(p=>!p.disconnectedAt).map(p=>({role:p.role,scene:p.scene})),roster:store.roster(),objects:world.snapshot(roomFor(stream.user)),progress:world.progress(stream.user),progressVersion:user.progressVersion,bag:life.bag(stream.user),collection:life.collection(stream.user),offers:life.offers(stream.user),recent:life.recent(stream.user),clock:Date.now(),leases:[...leases].map(([id,l])=>({id,role:l.role})),celine:celine.snapshot(autonomy.all()),npcEpoch:Math.floor(Date.now()/20000),npcReactions:[...npcReactions.values()].filter(r=>r.scene===roomFor(stream.user)&&r.expires>Date.now()),npcs:npcRules.filter(rule=>rule.condition==='always'||autonomy.all().some(p=>p.role===rule.owner&&p.scene===rule.room&&(rule.condition!=='working'||p.activity==='working'&&workstations[p.scene]?.[p.role]===p.seat))).map(rule=>rule.id)};};
  const release=id=>{for(const [key,l]of leases)if(l.account===id)leases.delete(key);};
  const publishMessage=message=>{for(const s of streams){const own=store.byId(s.user)?.role;if(message.recipient?own===message.sender||own===message.recipient:roomFor(s.user)===message.scene)emit(s,'message',message);}};
  const director=createDirector(store,life,autonomy,world,llm,{publish:publishMessage});autonomy.setDirector(director);
  const flush=()=>{if(dirty){dirty=false;for(const s of streams)emit(s,'world',snapshot(s));}};
  const limited=(key,max,ms=60000)=>{const now=Date.now(),entry=rates.get(key);if(!entry||entry.until<now){rates.set(key,{n:1,until:now+ms});return;}if(++entry.n>max)fail(429,'操作太快，请稍后重试');};
  const cookieFlags=()=>`HttpOnly; SameSite=Strict; Path=/${process.env.COOKIE_SECURE==='1'||process.env.VERCEL==='1'?'; Secure':''}`;
  const setSession=(res,token)=>res.setHeader('Set-Cookie',`hutong_session=${token}; ${cookieFlags()}; Max-Age=604800`);
  const checkControl=(user,client)=>{checkControlOnly(user,client);startPlayer(user);};
  const checkControlOnly=(user,client)=>{if(typeof client!=='string'||client.length>80)fail(409,'角色在另一个窗口操作，请点击接管');const current=controls.get(user.id);markLive(user.id);if(!current){controls.set(user.id,client);return;}if(current!==client)fail(409,'角色在另一个窗口操作，请点击接管');controls.touch(user.id,client);};
  const startPlayer=user=>{if(!user.role)return;markLive(user.id);if(players.has(user.id))return;const homes={suki:[288,207],sid:[192,207],jilly:[192,182],laura:[384,207],kay:[480,207],franco:[480,182],cora:[288,182],amber:[384,182]};const [x,y]=homes[user.role];const previous=autonomy.reclaim(user.id)||life.position(user.id);const p={id:user.id,role:user.role,scene:'hutong',x,y,facing:0,moving:false,seat:null,activity:'walk',...previous,at:Date.now()};if(p.seat){const seat=interactions[p.scene].seats[p.seat];if(seat)[p.x,p.y]=seat.approach;p.seat=null;}const oldActivity=interactions[p.scene].activities[p.activity]?.find(a=>Math.hypot(p.x-a.at[0],p.y-a.at[1])<8);if(oldActivity)[p.x,p.y]=oldActivity.approach;p.activity='walk';p.moving=false;p.fresh=true;players.set(user.id,p);dirty=true;};
  const server=createServer(async(req,res)=>{
    try{
      req.url=stripBase(req.url||'/');const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(path.startsWith('/api/')){
        // Vite proxy and production must preserve the browser-facing Host header.
        const origin=req.headers.origin;if(req.method!=='GET'&&origin){let host='';try{host=new URL(origin).host.toLowerCase();}catch{fail(403,'请求来源不正确');}if(host!==String(req.headers.host||'').toLowerCase()&&!allowedHosts().includes(host))fail(403,'请求来源不正确');}
        if(path==='/api/health'){json(res,200,{ok:true,version:2,online:players.size,llm:llm.status(),party:!!partySecret()});return;}
        const token=cookie(req),user=store.session(token);
        if(path==='/api/me'){json(res,200,{user,roster:store.roster()});return;}
        if(path==='/api/party-ticket'){
          if(req.method!=='POST')fail(405,'请使用 POST');
          if(!user)fail(401,'请先登录');
          if(!user.role)fail(409,'请先领取角色');
          if(!partySecret())fail(503,'未配置 PARTY_AUTH_SECRET');
          const input=await body(req);
          if(typeof input.client!=='string'||input.client.length>80)fail(400,'连接编号无效');
          startPlayer(user);
          if(!controls.has(user.id))controls.set(user.id,input.client);
          const controller=controls.get(user.id)===input.client;
          const issued=await issueTicket(partySecret(),{userId:user.id,role:user.role,username:user.username,client:input.client,controller},60_000);
          json(res,200,{...issued,room:process.env.PARTY_ROOM||PARTY_ROOM_ID,host:process.env.PARTYKIT_HOST||null,controller});return;
        }
        if(path==='/api/register'||path==='/api/login'){
          if(req.method!=='POST')fail(405,'请使用 POST');limited('auth:'+clientAddress(req),30);
          const input=await body(req);
          if(path==='/api/register'&&process.env.HUTONG_INVITE&&input.invite!==process.env.HUTONG_INVITE)fail(403,'请输入内测邀请码');
          if(path==='/api/register'&&store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n>=8)fail(409,'八个内测账号已创建');
          const result=path==='/api/register'?await store.register(input.username,input.password,input.role??null):await store.login(input.username,input.password);
          setSession(res,result.token);json(res,200,{user:result.user,roster:store.roster()});return;
        }
        if(!user)fail(401,'请先登录');
        if(path==='/api/events'&&req.method==='GET'){
          const client=url.searchParams.get('client');if(!client||client.length>80)fail(400,'连接编号无效');
          if(streams.size>=128||[...streams].filter(s=>s.user===user.id).length>=4)fail(429,'连接数已满');
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 1500\n\n');
          const stream={user:user.id,client,res,token};streams.add(stream);startPlayer(user);const player=players.get(user.id);if(player)delete player.disconnectedAt;
          if(!controls.has(user.id))controls.set(user.id,client);
          emit(stream,'world',snapshot(stream));dirty=true;
          req.on('close',()=>{if(closed)return;streams.delete(stream);if(![...streams].some(s=>s.user===user.id)){const p=players.get(user.id);if(p){p.disconnectedAt=Date.now();life.savePosition(p);}controls.release(user.id,client);}else if(controls.get(user.id)===client&&!([...streams].some(s=>s.user===user.id&&s.client===client))){/* Another tab of the same user is still open: hand control to it so the user stays the driver (never "other window", never autonomy). */controls.set(user.id,[...streams].find(s=>s.user===user.id).client);}dirty=true;});return;
        }
        if(path==='/api/journal'&&req.method==='GET'){const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)fail(400,'经历页码无效');json(res,200,{entries:life.journal(user.id,before)});return;}
        if(path==='/api/life'&&req.method==='GET'){json(res,200,{bag:life.bag(user.id),collection:life.collection(user.id),offers:life.offers(user.id)});return;}
        if(path==='/api/item-art'&&req.method==='GET'){const art=rewards.art(url.searchParams.get('name'));if(!art)fail(404,'物品不存在');json(res,200,art);return;}
        if(path==='/api/history'&&req.method==='GET'){
          if(!user.role)fail(409,'请先领取角色');const peer=url.searchParams.get('peer');if(peer&&(!roles.includes(peer)||peer===user.role))fail(400,'私聊对象无效');json(res,200,{messages:store.history(user.role,peer,roomFor(user.id))});return;
        }
        if(req.method!=='POST')fail(405,'请使用 POST');
        const input=await body(req);
        if(path==='/api/logout'){
          store.logout(token);for(const s of [...streams])if(s.token===token){emit(s,'logout',{});s.res.end();streams.delete(s);}if(![...streams].some(s=>s.user===user.id)){const p=players.get(user.id);if(p)life.savePosition(p);release(user.id);players.delete(user.id);controls.delete(user.id);}dirty=true;
          res.setHeader('Set-Cookie',`hutong_session=; ${cookieFlags()}; Max-Age=0`);json(res,200,{ok:true});return;
        }
        if(path==='/api/claim'){limited('claim:'+user.id,15);const next=store.claim(user.id,input.role);startPlayer(next);dirty=true;json(res,200,{user:next});return;}
        if(!user.role)fail(409,'请先领取角色');
        startPlayer(user);
        if(path==='/api/control'){if(typeof input.client!=='string'||input.client.length>80)fail(400,'连接编号无效');startPlayer(user);if(controls.get(user.id)!==input.client){const p=players.get(user.id),geometry=interactions[p.scene],seat=geometry.seats[p.seat],activity=geometry.activities[p.activity]?.find(a=>Math.hypot(p.x-a.at[0],p.y-a.at[1])<8),point=seat?.approach??activity?.approach;if(point){p.x=point[0];p.y=point[1];}p.seat=null;p.activity='walk';release(user.id);}controls.set(user.id,input.client);dirty=true;json(res,200,{ok:true,player:cleanPlayer(players.get(user.id))});return;}
        if(path==='/api/transition'){
          checkControl(user,input.client);const p=players.get(user.id),from=rooms[p.scene],to=rooms[input.target];
          if(!to||input.target===p.scene)fail(400,'地点无效');
          if(p.seat||[...leases.values()].some(l=>l.account===user.id)||!['walk',undefined].includes(p.activity)||Math.hypot(p.x-from.exit[0],p.y-from.exit[1])>30)fail(409,'先结束互动，走到出口');
          release(user.id);Object.assign(p,{scene:input.target,x:to.exit[0],y:to.exit[1],seat:null,moving:false,facing:0,at:Date.now()});dirty=true;
          json(res,200,{player:cleanPlayer(p),self:store.publicAccount(store.byId(user.id)),objects:world.snapshot(p.scene)});return;
        }
        if(path==='/api/inventory'){checkControl(user,input.client);limited('inventory:'+user.id,30,10000);const result=life.inventory(user.id,input,roomFor(user.id));dirty=true;json(res,200,result);return;}
        if(path==='/api/reward'){checkControl(user,input.client);limited('reward:'+user.id,30,10000);const result=rewards.interact(user,players.get(user.id),input);dirty=true;json(res,200,result);return;}
        if(path==='/api/npc'){
          checkControl(user,input.client);limited('npc:'+user.id,1,3000);const rule=npcRules.find(n=>n.id===input.npc),p=players.get(user.id);
          if(!rule)fail(400,'彩蛋不存在');if(rule.owner!==user.role)fail(403,'只有对应的人能与这个彩蛋互动');
          const visible=rule.condition==='always'||autonomy.all().some(a=>a.role===rule.owner&&a.scene===rule.room&&(rule.condition!=='working'||a.activity==='working'&&workstations[a.scene]?.[a.role]===a.seat));
          const point=guestPositions[rule.id];if(p.scene!==rule.room||!visible||Math.hypot(p.x-point.x,p.y-point.y)>(rule.id==='ani'?75:42))fail(409,'走近自己的彩蛋再互动');
          const lines={ani:'Sid，歇会儿吧。',lulu:'Suki，一起慢慢待一会儿。',tutu:'Kay，运动完一起歇歇！',buzz:'Cora，今天想拆哪一盒？',zhu:'Jilly，今天也来听歌啦！',ferret:'Amber，又见面了！'};
          const reaction={id:rule.id+':'+Date.now(),npc:rule.id,owner:rule.owner,scene:rule.room,x:point.x,y:point.y,text:lines[rule.id],expires:Date.now()+5000};npcReactions.set(rule.id,reaction);
          life.recordGroup([user.id],'easter',`${name(user.role)} 与${({ani:'Ani',lulu:'噜噜',tutu:'图图',buzz:'巴斯光年',zhu:'朱志鑫',ferret:'富贵貂'})[rule.id]}打了个招呼。`,rule.room,Date.now(),reaction.id);dirty=true;json(res,200,{ok:true,reaction});return;
        }
        if(path==='/api/offer'){checkControl(user,input.client);const result=life.respond(user.id,input.id,input.answer);dirty=true;json(res,200,{offer:result});return;}
        if(path==='/api/invite'){checkControl(user,input.client);limited('invite:'+user.id,10,10000);const b=store.byRole(input.peer);if(!b)fail(400,'对方尚未领取角色');const result=life.send(user.id,input.peer,'meet',input.requestId,roomFor(user.id),undefined,input.place||'rest');dirty=true;json(res,200,{offer:result});return;}
        if(path==='/api/object'){
          if(['hutong:celine','hawaii:celine'].includes(input.object))fail(403,'Celine 会自己活动');
          checkControl(user,input.client);limited('object:'+user.id,60,10000);const result=world.interact(user,players.get(user.id),input,players);dirty=true;json(res,200,result);return;
        }
        if(path==='/api/lease'){
          checkControl(user,input.client);const p=players.get(user.id),id=p.scene+':'+input.device;
          const allowed={arcade:['mines','spider','claw','basketball','hockey'],gym:['run-0','run-1','run-2','curl'],rehearsal:['piano'],dance:['music']};
          if(!allowed[p.scene]?.includes(input.device))fail(400,'设备无效');
          if(input.release){if(leases.get(id)?.account===user.id)leases.delete(id);}else{const at=interactions[p.scene].devices?.[input.device];if(!at)fail(400,'设备位置无效');if(Math.hypot(p.x-at[0],p.y-at[1])>40)fail(409,'请走到设备附近');if(store.byId(user.id).hand&&['gym','rehearsal'].includes(p.scene))fail(409,'先放下手中物品');const old=leases.get(id);if(old&&old.account!==user.id)fail(409,'设备有人使用');leases.set(id,{account:user.id,role:user.role,at:Date.now()});}dirty=true;json(res,200,{ok:true});return;
        }
        if(path==='/api/progress'){
          if(!['bead','score','draft'].includes(input.kind)||typeof input.key!=='string'||input.key.length>80)fail(400,'记录无效');
          if(input.kind==='bead'||input.kind==='draft'){if(!Array.isArray(input.data?.cells)||input.data.cells.length!==256||input.data.cells.some(c=>!Number.isInteger(c)||c< -1||c>15))fail(400,'作品无效');}
          if(input.kind==='score'){if(!['mines','spider','basketball','hockey'].includes(input.key)||!Number.isFinite(input.data?.value)||input.data.value<0||input.data.value>100000)fail(400,'成绩无效');const old=world.progress(user.id).find(p=>p.kind==='score'&&p.key===input.key);if(old?.data.value>=input.data.value){json(res,200,{progress:world.progress(user.id),progressVersion:store.byId(user.id).progress_revision});return;}
            const labels={mines:'扫雷',spider:'蜘蛛纸牌',basketball:'投篮',hockey:'冰球'};
            world.write(user.id,input.kind,input.key,input.data);dirty=true;
            publishMessage(store.message(user.role,null,roomFor(user.id),`${name(user.role)} 刷新了${labels[input.key]}纪录：${Math.floor(input.data.value)}！`,'score:'+input.key+':'+Math.floor(input.data.value)));
            json(res,200,{progress:world.progress(user.id),progressVersion:store.byId(user.id).progress_revision});return;}
          world.write(user.id,input.kind,input.key,input.data);dirty=true;json(res,200,{progress:world.progress(user.id),progressVersion:store.byId(user.id).progress_revision});return;
        }
        if(path==='/api/presence'){
          limited('move:'+user.id,30,1000);checkControl(user,input.client);
          if(!scenes.includes(input.scene)||!Number.isFinite(input.x)||!Number.isFinite(input.y)||input.x<20||input.x>620||input.y<90||input.y>355||!Number.isInteger(input.facing)||input.facing<0||input.facing>3)fail(400,'位置无效');
          if(input.seat!==null&&(typeof input.seat!=='string'||input.seat.length>50))fail(400,'座位无效');
          const p=players.get(user.id),now=Date.now();
          // A player record created on this (serverless) instance from a stale DB pose must adopt the client's live pose.
          const fresh=!!p.fresh&&input.seat===null&&walkable(input.scene,input.x,input.y);if(fresh){p.scene=input.scene;p.x=input.x;p.y=input.y;p.at=now;}
          if(input.scene!==p.scene)fail(409,'请从出口切换场景');
          const distance=Math.hypot(p.x-input.x,p.y-input.y),elapsed=Math.min(3000,now-p.at);
          const geometry=interactions[p.scene],near=(point,x,y,r)=>Math.hypot(x-point[0],y-point[1])<=r;
          let anchored=false;
          if(input.seat!==null){const anchor=geometry.seats[input.seat];if(!anchor||!near(anchor.at,input.x,input.y,6))fail(409,'请使用实际座位');if(input.seat!==p.seat&&!near(anchor.approach,p.x,p.y,38))fail(409,'请走到椅子附近');if(p.scene==='bathroom'&&!world.snapshot('bathroom').find(o=>o.id==='bathroom:door-'+input.seat)?.open)fail(409,'先打开隔间门');anchored=true;}
          else if(p.seat){const anchor=geometry.seats[p.seat];anchored=!!anchor&&near(anchor.approach,input.x,input.y,40);}
          const activity=['hutong','hawaii'].includes(p.scene)?(input.seat?(workstations[p.scene]?.[p.role]===input.seat?'working':'sit'):'walk'):typeof input.activity==='string'?input.activity:'walk';
          if(p.activity!==activity&&geometry.activities[p.activity])anchored||=geometry.activities[p.activity].some(a=>near(a.at,p.x,p.y,6)&&near(a.approach,input.x,input.y,40));
          if(geometry.activities[activity]){const anchor=geometry.activities[activity].find(a=>near(a.at,input.x,input.y,6)&&((p.activity===activity&&near(a.at,p.x,p.y,6))||near(a.approach,p.x,p.y,40)));if(!anchor||anchor.device&&leases.get(p.scene+':'+anchor.device)?.account!==user.id)fail(409,'请先使用附近的设备');anchored=true;}
          if(!anchored&&distance>180*elapsed/1000+14)fail(409,'移动过快，请重试');
          if(input.scene==='hawaii'&&input.seat==='HL3'){const visitor=celine.snapshot(autonomy.all());if(visitor.scene==='hawaii'&&visitor.seat==='HL3')fail(409,'Celine 正坐在这张椅子上');}
          if(input.seat&&[...players.values()].some(other=>other.id!==user.id&&other.scene===input.scene&&other.seat===input.seat))fail(409,'这个座位已经有人了');
          if(input.hand!==null&&!items.includes(input.hand)&&!(typeof input.hand==='string'&&(plushNames.some(n=>input.hand==='娃娃·'+n)||rewards.art(input.hand))))fail(400,'物品无效');
          const next=store.publicAccount(store.byId(user.id));
          for(const l of leases.values())if(l.account===user.id)l.at=now;
          const previousActivity=p.activity;
          delete p.fresh;Object.assign(p,{scene:input.scene,x:input.x,y:input.y,facing:input.facing,moving:input.moving===true,seat:input.seat,activity:activity.slice(0,20),at:now});if(now-(p.savedAt||0)>5000){life.savePosition(p);p.savedAt=now;}
          if(previousActivity!==activity){
            if(activity==='working')life.record(user.id,'work','开始在自己的工位办公。',p.scene,Date.now(),{routine:true,key:`work:start:${p.scene}`});
            else if(activity==='sit')life.record(user.id,'rest','坐在椅子上休息。',p.scene,Date.now(),{routine:true,key:`rest:sit:${p.scene}`});
            else if(previousActivity==='working')life.record(user.id,'work','离开工位，结束了这段办公。',p.scene,Date.now(),{routine:true,key:`work:end:${p.scene}`});
          }
          dirty=true;json(res,200,{self:next,player:cleanPlayer(p)});return;
        }
        if(path==='/api/chat'){
          limited('chat:'+user.id,12,10000);const text=typeof input.text==='string'?input.text.trim():'';if(!text||text.length>200)fail(400,'消息需为 1–200 个字');
          const peer=input.peer||null;if(peer&&(!roles.includes(peer)||peer===user.role))fail(400,'私聊对象无效');
          const existed=store.db.prepare('SELECT seq FROM messages WHERE id=?').get(user.role+':'+input.requestId);const scene=roomFor(user.id),message=store.message(user.role,peer,scene,text,input.requestId);publishMessage(message);
          if(peer&&!live(peer)&&!existed){const owner=store.byRole(peer),profile=owner?JSON.parse(owner.profile):{},thread=user.role+':'+peer;if(owner&&(llm.configured?(!profile.confirmed||profile.autoReply):(profile.confirmed&&profile.autoReply))&&Date.now()-(replyCooldown.get(thread)||0)>20000){replyCooldown.set(thread,Date.now());
            void llm.reply(peer,text,user.role,scene).then(reply=>{if(closed||live(peer)||!reply)return;publishMessage(store.message(peer,user.role,scene,reply,'reply:'+user.role+':'+input.requestId,true));}).catch(()=>{});
          }}json(res,200,{message});return;
        }
        if(path==='/api/interact'){
          limited('interact:'+user.id,10,10000);checkControl(user,input.client);
          const a=players.get(user.id);
          if(input.action==='emote'){
            const emotes={wave:'👋 挥手',cheer:'🙌 加油',bow:'🙇 点头'};
            const body=emotes[input.emote];if(!body)fail(400,'表情无效');
            if(typeof input.requestId!=='string'||input.requestId.length>120)fail(400,'操作编号无效');
            const message=store.message(user.role,null,a.scene,body,input.requestId);publishMessage(message);json(res,200,{ok:true});return;
          }
          const b=live(input.peer)||autonomy.all().find(p=>p.role===input.peer);if(!b||b.id===a.id||a.scene!==b.scene||Math.hypot(a.x-b.x,a.y-b.y)>55)fail(409,'请走到对方附近');
          if(input.action==='greet'){const duplicate=store.db.prepare('SELECT seq FROM messages WHERE id=?').get(user.role+':'+input.requestId);const message=store.message(user.role,null,a.scene,`嗨，${name(b.role)}！`,input.requestId);publishMessage(message);if(!duplicate){const pair=[user.role,b.role].sort().join(':');life.record(user.id,'greet',`向 ${name(b.role)} 打了招呼。`,a.scene,Date.now(),{key:`greet:${pair}`,cooldown:memoryPolicy.encounterCooldown});life.record(b.id,'greet',`${name(user.role)} 向你打了招呼。`,a.scene,Date.now(),{key:`greet:${pair}:peer`,cooldown:memoryPolicy.encounterCooldown});}json(res,200,{ok:true});return;}
          if(input.action==='gift'){if(typeof input.requestId!=='string'||input.requestId.length>120)fail(400,'操作编号无效');const result=life.send(user.id,b.role,'gift',input.requestId,a.scene,input.revision);dirty=true;flush();json(res,200,result);return;}
          fail(400,'互动无效');
        }
        fail(404,'没有这个接口');
      }
      let filePath=path;
      try{filePath=decodeURIComponent(path);}catch{fail(400,'路径无效');}
      let file=resolve(staticDir,'.'+filePath);if(path==='/')file=resolve(staticDir,'index.html');if(path==='/moles'||path==='/moles/')file=resolve(staticDir,'moles.html');if(!file.startsWith(resolve(staticDir)+sep))fail(403,'访问无效');
      const content=await readFile(file).catch(()=>null);if(!content){json(res,404,{error:'文件不存在，请先构建'});return;}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(content);
    }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'服务暂时不可用'});else res.end();if(!e.status)console.error(e.message);}
  });
  const timer=setInterval(()=>{if(autonomy.tick())dirty=true;const v=celine.snapshot(autonomy.all()),signature=JSON.stringify([v.scene,v.mode,v.seat,Math.round(v.x),Math.round(v.y),v.question]);if(signature!==visitorSignature){visitorSignature=signature;dirty=true;}flush();},100),heartbeat=setInterval(()=>{for(const s of streams)markLive(s.user);for(const [key,value] of rates)if(value.until<Date.now())rates.delete(key);for(const s of [...streams]){if(!store.session(s.token)){emit(s,'logout',{});s.res.end();streams.delete(s);if(![...streams].some(x=>x.user===s.user)){const p=players.get(s.user);if(p){p.disconnectedAt=Date.now();life.savePosition(p);}controls.delete(s.user);}dirty=true;}else s.res.write(': heartbeat\n\n');}for(const [id,p]of players){if(p.disconnectedAt&&Date.now()-p.disconnectedAt>45000){/* The user may be live on another instance: never clobber their newer pose/control. */if(!seenLive(id,45000))life.savePosition(p);players.delete(id);release(id);if(controls.stale(id))controls.delete(id);dirty=true;}else if(!p.disconnectedAt&&Date.now()-p.at>45000){p.seat=null;release(id);dirty=true;}}},15000);timer.unref();heartbeat.unref();
  return {server,store,life,autonomy,director,llm,players,streams,close(){if(closed)return;closed=true;director.close();llm.close();autonomy.saveAll();clearInterval(timer);clearInterval(heartbeat);for(const s of streams)s.res.end();streams.clear();server.close();store.close();}};
}
