import type {MultiplayerBridge} from './bridge';
import {playerInventory,type ItemName} from '../player-inventory';
import {blindBoxes,type ToyRecord} from '../blind-box';
import {gacha} from '../gacha';
import {setGuestPresence} from '../easter-eggs';
import {ensureCollectible} from '../collectible-art';

export type RoomObject={id:string;version:number;slots?:any[];open?:boolean;stock?:boolean[]};
export type Progress={kind:string;key:string;data:any};
let service:WorldClient|undefined;
export function sharedAction(object:string,action:string,args:Record<string,unknown>={},after?:()=>void){
  if(!service?.bridge.user?.role)return false;
  void service.action(object,action,args).then(()=>after?.()).catch(e=>service?.notice(e.message));return true;
}
export function saveProgress(kind:string,key:string,data:unknown){service?.save(kind,key,data);}
export function personalProgress(){return service?.progress??[];}
export function onlineWorld(){return service;}
const heldDevices=new Set<string>();
const pendingDevices=new Set<string>();
export function useDevice(device:string,start:()=>void){if(!service?.bridge.user?.role)return false;const key=service.bridge.active?.sys.settings.key+':'+device;if(heldDevices.has(key))return false;if(pendingDevices.has(key))return true;pendingDevices.add(key);void service.lease(device).then(()=>{if(!service?.bridge.connected||!service.bridge.controller){void service?.lease(device,true).catch(()=>{});return;}heldDevices.add(key);start();}).catch(e=>service?.notice(e.message)).finally(()=>pendingDevices.delete(key));return true;}
export function releaseDevice(device:string){if(!service?.bridge.user?.role)return;heldDevices.delete(service.bridge.active?.sys.settings.key+':'+device);void service.lease(device,true).catch(()=>{});}
export class WorldClient{
 objects=new Map<string,RoomObject>();progress:Progress[]=[];busy=false;
 celine:any=null;
 clockOffset=0;private progressVersion=-1;
 private queue=Promise.resolve();private hydrated='';private progressSignature='';
 private appliedScene:unknown;private appliedVersions=new Map<string,number>();private saves=new Map<string,ReturnType<typeof setTimeout>>();
 constructor(readonly bridge:MultiplayerBridge,private request:(path:string,input?:any)=>Promise<any>,private publish:()=>Promise<void>,readonly client:string,readonly notice:(message:string)=>void){service=this;bridge.game.events.on('poststep',()=>{const s=bridge.active;if(s?.actor&&s!==this.appliedScene){heldDevices.clear();pendingDevices.clear();this.appliedVersions.clear();this.appliedScene=s;this.apply();}});}
 pause(){const s=this.bridge.active;if(s){const mode=s.mode;if((s.sys.settings.key==='gym'&&['run','curl'].includes(mode))||mode==='piano'||s.sys.settings.key==='dance')this.bridge.stand();s.piano?.stop();s.beat?.stop();s.input.keyboard?.resetKeys();}for(const id of ['arcade-game','perler-workshop','gym-storage']){const d=document.getElementById(id);if(d instanceof HTMLDialogElement&&d.open)d.close();}heldDevices.clear();pendingDevices.clear();}
 reset(){this.pause();this.bridge.pendingSpawn=null;setGuestPresence();this.objects.clear();this.progress=[];this.hydrated='';this.progressSignature='';this.progressVersion=-1;this.appliedVersions.clear();heldDevices.clear();pendingDevices.clear();this.saves.forEach(clearTimeout);this.saves.clear();}
 receive(data:any){
  if(data.celine)this.celine=data.celine;
  if(data.self&&data.self.id!==this.bridge.user?.id)return;
  if(data.npcs)setGuestPresence(data.npcs);
  if(data.clock)this.clockOffset=data.clock-Date.now();
  const scene=this.bridge.active;if(scene)for(const name of [data.self?.hand,...(data.players??[]).map((p:any)=>p.hand),...(data.objects??[]).flatMap((o:any)=>(o.slots??[]).map((s:any)=>typeof s==='string'?s:s?.name))])if(name)void ensureCollectible(scene,name).catch(()=>{});
  if(data.self&&this.bridge.user?.id===data.self.id&&data.self.revision>=(this.bridge.user?.revision??0)){this.bridge.user=data.self;playerInventory.hand=data.self.hand as ItemName|null;playerInventory.noodleSeasoning=data.self.seasoning??[];}
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
   if(key==='pop'&&o.stock)blindBoxes.data.shelf[id as keyof typeof blindBoxes.data.shelf]=o.stock.map(v=>v?0:null);
  }
  if(changed&&key==='rest'&&s.fridgeMenu?.open)s.renderFridge();
 }
 action(object:string,action:string,args:Record<string,unknown>={}){
  const account=this.bridge.user?.id;
  const execute=async()=>{if(!account||account!==this.bridge.user?.id||!this.bridge.connected||!this.bridge.controller)throw new Error('连接恢复后再操作');this.busy=true;try{await this.publish();if(account!==this.bridge.user?.id)throw new Error('账号已切换');const input={object,action,...args,client:this.client,revision:this.bridge.user?.revision,requestId:crypto.randomUUID()};let data;try{data=await this.request('object',input);}catch(e){if((e as any).status)throw e;data=await this.request('object',input);}if(account!==this.bridge.user?.id)throw new Error('账号已切换');this.receive(data);return data;}finally{this.busy=false;}};
  const result=this.queue.then(execute);this.queue=result.then(()=>undefined,()=>undefined);return result;
 }
 save(kind:string,key:string,data:unknown){if(!this.bridge.user?.role)return;const account=this.bridge.user.id,id=kind+':'+key;clearTimeout(this.saves.get(id));const send=()=>{this.saves.delete(id);if(this.bridge.user?.id!==account)return;void this.request('progress',{kind,key,data}).then(result=>{if(this.bridge.user?.id===account)this.receive(result);}).catch(e=>{if(this.bridge.user?.id===account)this.notice(e.message);});};if(kind==='draft')this.saves.set(id,setTimeout(send,250));else send();}
 async saveNow(kind:string,key:string,data:unknown){const account=this.bridge.user?.id;if(!account)throw Error('请先登录');const result=await this.request('progress',{kind,key,data});if(account!==this.bridge.user?.id)throw Error('账号已切换');this.receive(result);}
 reward(action:string,args:Record<string,unknown>={}){
  const account=this.bridge.user?.id;
  const execute=async()=>{if(!account||account!==this.bridge.user?.id||!this.bridge.connected||!this.bridge.controller)throw Error('连接恢复后再操作');await this.publish();const input={action,...args,client:this.client,revision:this.bridge.user?.revision,requestId:crypto.randomUUID()};let result;try{result=await this.request('reward',input);}catch(e){if((e as any).status)throw e;result=await this.request('reward',input);}if(account!==this.bridge.user?.id)throw Error('账号已切换');this.receive(result);return result;};
  const result=this.queue.then(execute);this.queue=result.then(()=>undefined,()=>undefined);return result;
 }
 async lease(device:string,release=false){if(!this.bridge.user?.role)return;await this.publish();await this.request('lease',{client:this.client,device,release});}
}
