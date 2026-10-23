import type {MultiplayerBridge} from './bridge';
import {playerInventory,type ItemName} from '../player-inventory';
import {blindBoxes,type ToyRecord} from '../blind-box';
import {gacha} from '../gacha';
import {ensureCollectible} from '../collectible-art';
import {traceInteraction} from '../interaction-diagnostics';

export type RoomObject={id:string;version:number;slots?:any[];open?:boolean;stock?:boolean[]};
export type Progress={kind:string;key:string;data:any};
let service:WorldClient|undefined;
export function sharedAction(object:string,action:string,args:Record<string,unknown>={},after?:()=>void){
  if(!service?.bridge.user?.role)return false;
  const account=service.bridge.user.id,scene=service.bridge.active,epoch=service.epoch;
  void service.action(object,action,args).then(()=>{if(service?.bridge.user?.id===account&&service.bridge.active===scene&&service.epoch===epoch)after?.();}).catch(e=>service?.notice(e.message));return true;
}
export function saveProgress(kind:string,key:string,data:unknown){service?.save(kind,key,data);}
export function personalProgress(){return service?.progress??[];}
export function onlineWorld(){return service;}
const heldDevices=new Set<string>();
const pendingDevices=new Map<string,symbol>();
export function useDevice(device:string,start:()=>void){
 if(!service?.bridge.user?.role)return false;
 const world=service,account=service.bridge.user.id,scene=world.bridge.active,epoch=world.epoch,key=scene?.sys.settings.key+':'+device;
 if(heldDevices.has(key))return false;if(pendingDevices.has(key))return true;
 const intent=Symbol(key);pendingDevices.set(key,intent);
 const current=()=>service===world&&world.bridge.user?.id===account&&world.bridge.active===scene&&world.epoch===epoch&&pendingDevices.get(key)===intent;
 void world.lease(device).then(()=>{
  // A response from an earlier visit/account must neither start an activity nor
  // release a newer visit's lease. Server transitions release the source lease.
  if(!current())return;
  if(!world.bridge.connected||!world.bridge.controller){void world.lease(device,true).catch(()=>{});return;}
  heldDevices.add(key);start();
 }).catch(e=>{if(current())world.notice(e.message);}).finally(()=>{if(pendingDevices.get(key)===intent)pendingDevices.delete(key);});
 return true;
}
export function releaseDevice(device:string){if(!service?.bridge.user?.role)return;heldDevices.delete(service.bridge.active?.sys.settings.key+':'+device);void service.lease(device,true).catch(()=>{});}
export class WorldClient{
 objects=new Map<string,RoomObject>();progress:Progress[]=[];noodleOrders:any[]=[];private noodleOrdersRevision=-1;busy=false;
 celine:any=null;
 clockOffset=0;private progressVersion=-1;
 private queue=Promise.resolve();private hydrated='';private progressSignature='';
 private intents=new Map<string,Promise<any>>();private operationEpoch=0;
 get epoch(){return this.operationEpoch;}
 checkpointPosition(){return this.publish();}
 private appliedScene:unknown;private appliedVersions=new Map<string,number>();private saves=new Map<string,ReturnType<typeof setTimeout>>();
 constructor(readonly bridge:MultiplayerBridge,private request:(path:string,input?:any)=>Promise<any>,private publish:()=>Promise<void>,readonly client:string,readonly notice:(message:string)=>void,private ensureLive:()=>Promise<void>=async()=>{}){service=this;bridge.game.events.on('poststep',()=>{const s=bridge.active;if(s?.actor&&s!==this.appliedScene){if(this.appliedScene)this.operationEpoch++;heldDevices.clear();pendingDevices.clear();this.appliedVersions.clear();this.appliedScene=s;this.apply();}});}
 private enqueue(key:string,execute:()=>Promise<any>){
  const existing=this.intents.get(key);if(existing)return existing;
  if(this.intents.size>=8)return Promise.reject(new Error('操作处理中，请稍后再试'));
  const scene=this.bridge.active,epoch=this.operationEpoch;
  const result=this.queue.then(()=>{if(scene!==this.bridge.active||epoch!==this.operationEpoch)throw new Error('场景已切换，请重新操作');return execute();});
  this.intents.set(key,result);this.queue=result.then(()=>undefined,()=>undefined);
  const cleanup=()=>{if(this.intents.get(key)===result)this.intents.delete(key);};void result.then(cleanup,cleanup);return result;
 }
 pause(){const s=this.bridge.active;if(s){const mode=s.mode;if((s.sys.settings.key==='gym'&&['run','curl'].includes(mode))||mode==='piano'||s.sys.settings.key==='dance'||s.sys.settings.key==='ktv')this.bridge.stand();s.piano?.stop();s.beat?.stop();s.input.keyboard?.resetKeys();}for(const id of ['arcade-game','perler-workshop','gym-storage']){const d=document.getElementById(id);if(d instanceof HTMLDialogElement&&d.open)d.close();}heldDevices.clear();pendingDevices.clear();}
 reset(){this.operationEpoch++;this.pause();this.bridge.clearTransition();this.objects.clear();this.progress=[];this.noodleOrders=[];this.noodleOrdersRevision=-1;this.hydrated='';this.progressSignature='';this.progressVersion=-1;this.appliedVersions.clear();heldDevices.clear();pendingDevices.clear();this.saves.forEach(clearTimeout);this.saves.clear();}
 receive(data:any){
  if(data.celine)this.celine=data.celine;
  if(data.self&&data.self.id!==this.bridge.user?.id)return;
  if(Array.isArray(data.noodleOrders)&&Number.isInteger(data.noodleOrdersRevision)&&data.noodleOrdersRevision>=this.noodleOrdersRevision){this.noodleOrders=data.noodleOrders;this.noodleOrdersRevision=data.noodleOrdersRevision;}
  if(data.clock)this.clockOffset=data.clock-Date.now();
  const scene=this.bridge.active;if(scene)for(const name of [data.self?.hand,...(data.players??[]).map((p:any)=>p.hand),...(data.objects??[]).flatMap((o:any)=>(o.slots??[]).map((s:any)=>typeof s==='string'?s:s?.name))])if(name)void ensureCollectible(scene,name).catch(()=>{});
  if(data.self&&this.bridge.user?.id===data.self.id&&data.self.revision>(this.bridge.user?.revision??-1)){
    const previous=playerInventory.hand;
    this.bridge.user=data.self;playerInventory.hand=data.self.hand as ItemName|null;playerInventory.noodleSeasoning=data.self.seasoning??[];
    const ui=document.getElementById('social-ui');if(ui)ui.dataset.revision=String(data.self.revision);
    if(previous!==playerInventory.hand)window.dispatchEvent(new Event('hutong:hand-changed'));
  }
  for(const o of data.objects??[])if(o.version>=(this.objects.get(o.id)?.version??-1))this.objects.set(o.id,o);
  const version=data.progressVersion??data.self?.progressVersion??0;
  if(data.progress&&version>=this.progressVersion){this.progressVersion=version;this.progress=data.progress;const signature=JSON.stringify(data.progress),id=this.bridge.user?.id??'';if(signature!==this.progressSignature||this.hydrated!==id){
    blindBoxes.data.collection=data.progress.filter((p:Progress)=>p.kind==='toy').map((p:Progress)=>p.data as ToyRecord);
    gacha.counts.fill(0);data.progress.filter((p:Progress)=>p.kind==='gacha').forEach((p:Progress)=>{if(p.data.toy<gacha.counts.length)gacha.counts[p.data.toy]++;});
    const workshop=this.bridge.game.scene.getScene('perler') as any;
    if(workshop?.workshop){workshop.workshop.works=data.progress.filter((p:Progress)=>p.kind==='bead').map((p:Progress)=>({...p.data,key:p.key}));if(this.hydrated!==id){workshop.workshop.boards=Array.from({length:8},()=>({cells:Array(256).fill(-1),pattern:'自由',fused:false}));workshop.workshop.histories=Array.from({length:8},()=>({undo:[],redo:[]}));}if(this.hydrated!==id)for(const p of data.progress.filter((p:Progress)=>p.kind==='draft')){const index=Number(p.key);if(index>=0&&index<8)workshop.workshop.boards[index]=p.data;}}
    this.hydrated=id;this.progressSignature=signature;
  }}this.apply();
 }
 apply(){const s=this.bridge.active;if(!s?.actor||!this.bridge.user?.role)return;
  const key=s.sys.settings.key;let changed=false;
  for(const o of this.objects.values())if(o.id.startsWith(key+':')){
   if(this.appliedVersions.get(o.id)===o.version)continue;this.appliedVersions.set(o.id,o.version);changed=true;
   const id=o.id.split(':')[1],names=o.slots?.map(i=>typeof i==='string'?i:i?.name??null);
   if(key==='rest'){if(id==='fridge')s.fridgeItems=names;if(id.startsWith('table-'))s.tableItems[Number(id.split('-')[1])]=names;if(id==='fridge-door')s.drawFridgeDoor?.(o.open);}
   if(key==='noodle'&&id.startsWith('table-'))s.dishes[Number(id.split('-')[1])]=o.slots?.map(i=>typeof i==='string'?{name:i,seasoning:[]}:i);
   if(key==='gym'&&id==='stash')s.stored=o.slots?.map((item,slot)=>item?{...item,slot}:null).filter(Boolean);
   if((key==='dance'||key==='perler')&&id==='stash')s.stored=o.slots?.[0]??null;
   if(key==='hawaii'&&id==='curtain'){s.curtainDown=o.open;s.curtainProgress=o.open?1:0;}
   if(key==='bathroom'&&id.startsWith('door-')){const i=Number(id.split('-')[1]);if(s.doors[i])s.setDoorOpen(i,o.open);}
   if(key==='elevator'&&id.startsWith('door-')){const door=s.doors?.[Number(id.split('-')[1])];if(door)door.open=!!o.open;}
   if(key==='subway'&&id==='doors')s.open=o.open;
   if(key==='ktv')s.applyKtv?.(id,o);
   if(key==='pop'&&o.stock)blindBoxes.data.shelf[id as keyof typeof blindBoxes.data.shelf]=o.stock.map(v=>v?0:null);
  }
  if(changed&&key==='rest'&&s.fridgeMenu?.open)s.renderFridge();
 }
 action(object:string,action:string,args:Record<string,unknown>={}){
  const account=this.bridge.user?.id;
  const scene=this.bridge.active,epoch=this.operationEpoch;
  const execute=async()=>{if(account&&account===this.bridge.user?.id)await this.ensureLive();if(!account||account!==this.bridge.user?.id||!this.bridge.connected||!this.bridge.controller)throw new Error('连接恢复后再操作');if(scene!==this.bridge.active||epoch!==this.operationEpoch)throw new Error('场景已切换，请重新操作');this.busy=true;traceInteraction('target',{object,action,busy:true});try{await this.publish();if(account!==this.bridge.user?.id)throw new Error('账号已切换');if(scene!==this.bridge.active||epoch!==this.operationEpoch)throw new Error('场景已切换，请重新操作');const input={object,action,...args,client:this.client,revision:this.bridge.user?.revision,requestId:crypto.randomUUID()};let data;try{data=await this.request('object',input);}catch(e){if((e as any).status){if((e as any).status===409&&object.startsWith('noodle:'))try{const authoritative=await this.request('noodle-orders');if(account===this.bridge.user?.id&&scene===this.bridge.active&&epoch===this.operationEpoch)this.receive(authoritative);}catch{}throw e;}await this.publish();if(account!==this.bridge.user?.id||scene!==this.bridge.active||epoch!==this.operationEpoch)throw new Error('场景或账号已切换，请重新操作');data=await this.request('object',input);}if(account!==this.bridge.user?.id)throw new Error('账号已切换');this.receive(data);return data;}finally{this.busy=false;traceInteraction('released',{object,action,busy:false});}};
  return this.enqueue(JSON.stringify([account,scene?.sys.settings.key,object,action,args]),execute);
 }
 noodleOrder(action:string,args:Record<string,unknown>={}){
  const account=this.bridge.user?.id,scene=this.bridge.active,epoch=this.operationEpoch;
  const current=()=>account&&account===this.bridge.user?.id&&scene===this.bridge.active&&epoch===this.operationEpoch;
  return this.enqueue(JSON.stringify([account,scene?.sys.settings.key,'noodle-orders',action,args]),async()=>{
   if(!current())throw Error('场景或账号已切换');
   await this.ensureLive();if(!current()||!this.bridge.connected||!this.bridge.controller)throw Error('连接恢复后再操作');
   this.busy=true;
   try{
    await this.publish();if(!current())throw Error('场景或账号已切换');
    const input={action,...args,client:this.client,revision:this.bridge.user?.revision,requestId:crypto.randomUUID()};let data;
    try{data=await this.request('noodle-orders',input);}catch(error){
     if(!current())throw Error('场景或账号已切换');
     const latest=await this.request('noodle-orders');if(current())this.receive(latest);
     if((error as {status?:number}).status)throw error;
     if(!current())throw Error('场景或账号已切换');
     // Same receipt resolves committed-but-lost responses without a second pickup.
     data=await this.request('noodle-orders',input);
     const authoritative=await this.request('noodle-orders');data={...data,...authoritative};
    }
    if(!current())throw Error('场景或账号已切换');this.receive(data);return data;
   }finally{this.busy=false;}
  });
 }
 save(kind:string,key:string,data:unknown){if(!this.bridge.user?.role)return;const account=this.bridge.user.id,id=kind+':'+key;clearTimeout(this.saves.get(id));const send=()=>{this.saves.delete(id);if(this.bridge.user?.id!==account)return;void this.request('progress',{kind,key,data}).then(result=>{if(this.bridge.user?.id===account)this.receive(result);}).catch(e=>{if(this.bridge.user?.id===account)this.notice(e.message);});};if(kind==='draft')this.saves.set(id,setTimeout(send,250));else send();}
 async saveNow(kind:string,key:string,data:unknown){const account=this.bridge.user?.id;if(!account)throw Error('请先登录');const result=await this.request('progress',{kind,key,data});if(account!==this.bridge.user?.id)throw Error('账号已切换');this.receive(result);}
 reward(action:string,args:Record<string,unknown>={}){
  const account=this.bridge.user?.id;
  const execute=async()=>{/* The user acting in this tab means it is live: wait out a reconnect / reclaim control instead of failing. */if(account&&account===this.bridge.user?.id)await this.ensureLive();if(!account||account!==this.bridge.user?.id||!this.bridge.connected||!this.bridge.controller)throw Error('连接恢复后再操作');await this.publish();const input={action,...args,client:this.client,revision:this.bridge.user?.revision,requestId:crypto.randomUUID()};let result;try{result=await this.request('reward',input);}catch(e){if((e as any).status)throw e;result=await this.request('reward',input);}if(account!==this.bridge.user?.id)throw Error('账号已切换');this.receive(result);return result;};
  return this.enqueue(JSON.stringify([account,this.bridge.active?.sys.settings.key,'reward',action,args]),execute);
 }
 async lease(device:string,release=false){
  if(!this.bridge.user?.role)return;
  const account=this.bridge.user.id,scene=this.bridge.active,epoch=this.operationEpoch;
  await this.publish();
  if(account!==this.bridge.user?.id||scene!==this.bridge.active||epoch!==this.operationEpoch)throw Error('场景或账号已切换，请重新操作');
  await this.request('lease',{client:this.client,device,release});
 }
}
