import {fail} from './store.mjs';
import ticketDesigns from '../shared/memory-tickets.json' with {type:'json'};
import {scooterWalkable,scooterPathClear,safeOutdoorPoint,scooterDismountPoint} from '../shared/outdoor-collision.mjs';
const slots=['driver','rear','front'],offset={driver:0,front:34,rear:-23};
const title=role=>role[0].toUpperCase()+role.slice(1);
export const ticketName='车票·Human2026→Agent2027';

// A single SQLite row makes all seat reservations part of the same replicated
// optimistic write. An account has one slot; disconnected leases expire quickly.
export function createRides(store,{clock=Date.now,position,controller,live,move}){
 const db=store.db;
 db.exec('CREATE TABLE IF NOT EXISTS shared_rides(id TEXT PRIMARY KEY,state TEXT NOT NULL)');
 const get=db.prepare('SELECT state FROM shared_rides WHERE id=?'),put=db.prepare('INSERT INTO shared_rides VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state');
 const save=s=>put.run('street-scooter',JSON.stringify(s));
 const fresh=()=>({id:'street-scooter',scene:'street',x:320,y:285,facing:1,updatedAt:clock(),driveAt:clock(),seats:{driver:null,front:null,rear:null}});
 const read=()=>JSON.parse(get.get('street-scooter')?.state??JSON.stringify(fresh()));
 const valid=o=>!!o&&store.byId(o.account)?.role===o.role&&o.until>clock()&&live(o.account)&&controller(o.account)===o.client&&position(o.account)?.scene==='street';
 const dismount=account=>{
  const p=position(account);
  if(p?.activity==='scooter'||p?.activity==='scooter-basket'){
   const [x,y]=p.scene==='street'?scooterDismountPoint(p.x,p.y,read()):[p.x,p.y];
   move(account,{...p,x,y,activity:'walk',moving:false,at:clock()});
  }
 };
 const clean=s=>{
  let changed=false,migrated=false;
  // Older rows were allowed on the distant road and at centers where wheels
  // extended past the ground. Repair once before deriving any passenger pose.
  if(!scooterWalkable(s.x,s.y)){
   [s.x,s.y]=safeOutdoorPoint('street',s.x,s.y,'scooter');s.updatedAt=clock();s.driveAt=clock();changed=true;migrated=true;
  }
  for(const slot of slots)if(s.seats[slot]&&!valid(s.seats[slot])){dismount(s.seats[slot].account);s.seats[slot]=null;changed=true;}
  if(changed)save(s);
  if(migrated)for(const slot of slots)if(s.seats[slot])move(s.seats[slot].account,anchor(s,slot));
  return s;
 };
 const anchor=(s,slot)=>({scene:'street',x:s.x+offset[slot]*(s.facing===3?-1:1),y:s.y,facing:s.facing,moving:false,seat:null,activity:slot==='front'?'scooter-basket':'scooter',at:clock(),fresh:false});
 const view=s=>({id:s.id,scene:s.scene,x:s.x,y:s.y,facing:s.facing,updatedAt:s.updatedAt,seats:Object.fromEntries(slots.map(slot=>[slot,s.seats[slot]?{role:s.seats[slot].role,name:title(s.seats[slot].role),x:anchor(s,slot).x,y:s.y}:null]))});
 function release(account,client){const s=clean(read());let changed=false;for(const slot of slots)if(s.seats[slot]?.account===account&&(client===undefined||s.seats[slot].client===client)){s.seats[slot]=null;changed=true;}if(changed){save(s);dismount(account);}}
 function snapshot(account,client){const s=clean(read());for(const slot of slots){const o=s.seats[slot];if(o&&o.account===account&&o.client===client){o.until=clock()+15000;save(s);move(account,anchor(s,slot));break;}}return view(s);}
 function seat(account){const s=clean(read());return slots.find(slot=>s.seats[slot]?.account===account)??null;}
 function act(user,input){
  if(!user?.role)fail(409,'请先领取角色');
  if(typeof input.client!=='string'||!input.client||controller(user.id)!==input.client)fail(409,'角色在另一个窗口操作，请点击接管');
  const p=position(user.id);if(!p||p.scene!=='street'||!live(user.id))fail(409,'请先来到街道');
  let s=clean(read());
  if(input.action==='leave'){release(user.id);return snapshot();}
  if(input.action==='join'){
   if(!slots.includes(input.slot))fail(400,'座位无效');
   if(Math.hypot(p.x-s.x,p.y-s.y)>55)fail(409,'请走到小电驴附近');
   if(s.seats[input.slot]&&s.seats[input.slot].account!==user.id)fail(409,'这个座位已经有人了');
   for(const slot of slots)if(s.seats[slot]?.account===user.id)s.seats[slot]=null;
   s.seats[input.slot]={account:user.id,role:user.role,client:input.client,until:clock()+15000};
   if(input.slot==='driver')s.driveAt=clock();save(s);move(user.id,anchor(s,input.slot));return view(s);
  }
  if(input.action!=='drive')fail(400,'骑乘操作无效');
  if(s.seats.driver?.account!==user.id)fail(403,'只有驾驶员能驾驶');
  if(!Number.isFinite(input.x)||!Number.isFinite(input.y)||!scooterWalkable(input.x,input.y)||(input.facing!==undefined&&(!Number.isInteger(input.facing)||input.facing<0||input.facing>3)))fail(400,'骑乘位置无效');
  const elapsed=Math.max(0,Math.min(1000,clock()-s.driveAt));
  if(Math.hypot(input.x-s.x,input.y-s.y)>180*elapsed/1000+0.00001)fail(409,'移动过快，请重试');
  if(!scooterPathClear(s.x,s.y,input.x,input.y))fail(409,'请在可通行的地面骑行');
  s.x=input.x;s.y=input.y;s.facing=input.facing??s.facing;s.driveAt=clock();s.updatedAt=clock();s.seats.driver.until=clock()+15000;save(s);
  for(const slot of slots)if(s.seats[slot])move(s.seats[slot].account,anchor(s,slot));
  return view(s);
 }
 return {act,snapshot,release,seat};
}

export function createTickets(store,life,world){
 // Derive identity from the authenticated account, including tickets collected before the artwork update.
 const details=role=>{const ref=ticketDesigns[role];if(!ref)fail(409,'请先领取有效角色');return {passenger:ref.passenger,flight:ref.flight,gate:ref.gate,seat:ref.seat,boarding:'13:30'};};
 const get=account=>{const old=world.progress(account).find(e=>e.kind==='ticket'&&e.key==='google-2026')?.data;if(!old)return null;const role=store.byId(account)?.role;if(!ticketDesigns[role])return null;return {...old,...details(role),role,person:title(role)};};
 function claim(user,player){
  if(player?.scene!=='google')fail(409,'请到 Google 站领取车票');
  const old=get(user.id);if(old)return old;
  const role=store.byId(user.id)?.role;
  const ticket={id:'google-2026:'+user.id,name:ticketName,...details(role),role,person:title(role),date:'2026-10-10',from:'Human2026',to:'Agent2027',claimedAt:Date.now()};
  store.db.exec('SAVEPOINT ticket_claim');
  try{world.write(user.id,'ticket','google-2026',ticket);life.addCollected(user.id,ticketName,[],{scene:'google',at:ticket.claimedAt});life.record(user.id,'ticket',`领取了 ${ticket.person} 的车票：Human2026 → Agent2027。`,'google');store.db.exec('RELEASE ticket_claim');return ticket;}
  catch(e){store.db.exec('ROLLBACK TO ticket_claim; RELEASE ticket_claim');world.invalidate(user.id);throw e;}
 }
 return {get,claim};
}
