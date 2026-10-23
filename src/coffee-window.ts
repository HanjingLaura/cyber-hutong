import type Phaser from 'phaser';
import {nearCoffee} from '../shared/coffee.mjs';
import {onlineWorld} from './multiplayer/world-client';
import {api} from './multiplayer/api';
import {bindDialogFocus} from './world-focus';
import './coffee-window.css';
type Order={id:string;status:'pending'|'taken'|'cancelled';version:number};
/** Personal order UI. Closing/sleeping invalidates every outstanding UI continuation. */
export class CoffeeWindow{
 private dialog=document.createElement('dialog');private epoch=0;private busy=false;private order:Order|null=null;private account='';private at='order';private intent:any=null;private uncertain=false;
 constructor(private scene:Phaser.Scene){
  this.dialog.className='coffee-window';this.dialog.setAttribute('aria-label','MANNER 咖啡');this.dialog.innerHTML='<header><h2>MANNER 咖啡</h2><button type="button" data-close>关闭</button></header><p data-status aria-live="polite"></p><div data-actions></div>';
  document.body.append(this.dialog);bindDialogFocus(this.dialog,()=>document.querySelector('#interact'));
  this.dialog.querySelector('[data-close]')!.addEventListener('click',()=>this.dialog.close());
  this.dialog.addEventListener('close',()=>{this.epoch++;this.busy=false;});
  this.dialog.querySelector('[data-actions]')!.addEventListener('click',e=>{const action=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')?.dataset.action;if(action)void this.act(action);});
  scene.events.on('sleep',()=>this.close());scene.events.once('shutdown',()=>this.dispose());
 }
 near(x:number,y:number){return nearCoffee(x,y)||nearCoffee(x,y,'take');}
 private valid(epoch:number,account:string){return epoch===this.epoch&&this.dialog.open&&this.scene.sys.isActive()&&onlineWorld()?.bridge.user?.id===account;}
 private render(message=''){
  const world=onlineWorld(),hand=world?.bridge.user?.hand;
  this.dialog.querySelector('[data-status]')!.textContent=message||(this.order?.status==='pending'?'咖啡已做好，请到右侧取杯台取杯。':this.order?.status==='taken'?'已取杯，可以带走或送给朋友。':this.order?.status==='cancelled'?'订单已取消。':'点一杯咖啡，做好后到右侧取杯。');
  const actions=this.dialog.querySelector('[data-actions]')!;actions.replaceChildren();
  const add=(action:string,label:string,disabled=false)=>{const b=document.createElement('button');b.type='button';b.dataset.action=action;b.textContent=label;b.disabled=this.busy||disabled;actions.append(b);};
  if(this.uncertain){add('sync','同步订单');return;}
  if(this.order?.status==='pending'){if(this.at==='take'){add('take','取咖啡',!!hand);add('cancel','取消订单');}else add('sync','查看订单');}
  else if(this.at==='order')add('order','点一杯',!!hand);else add('sync','查看订单');
  if(hand&&!message&&(this.order?.status==='pending'||this.at==='order'))this.dialog.querySelector('[data-status]')!.textContent='先收好手里的物品，再点单或取杯。';
 }
 async interact(x:number,y:number){
  const world=onlineWorld();if(!world?.bridge.user?.role||!world.bridge.connected||!world.bridge.controller)return;
  this.at=nearCoffee(x,y)?'order':'take';this.account=world.bridge.user.id;
  if(!this.dialog.open)this.dialog.showModal();this.render('正在同步订单…');await this.sync();
 }
 private async sync(){
  const epoch=this.epoch,account=this.account;this.busy=true;this.render('正在同步订单…');
  try{const result=await api<any>('coffee-orders');if(!this.valid(epoch,account))return;if(result.self?.id!==account){this.close();return;}this.order=result.order;this.uncertain=false;this.intent=null;this.busy=false;this.render();}
  catch(e){if(this.valid(epoch,account)){this.busy=false;this.uncertain=true;this.render((e as Error).message);}}
 }
 private async act(action:string){
  if(this.busy)return;if(action==='sync'){await this.sync();return;}
  const world=onlineWorld();if(!world||world.bridge.user?.id!==this.account||!world.bridge.connected||!world.bridge.controller){this.close();return;}
  const epoch=this.epoch,account=this.account;this.busy=true;this.render('正在处理…');
  try{
   await world.checkpointPosition();if(!this.valid(epoch,account))return;
   this.intent??={client:world.client,action,requestId:crypto.randomUUID(),revision:world.bridge.user?.revision,orderId:this.order?.id,expectedOrderVersion:this.order?.version};
   let result;try{result=await api<any>('coffee-orders',this.intent);}catch(e){
    if((e as any).status)throw e;
    // A missing response can follow a committed cup. Read personal state first.
    const synced=await api<any>('coffee-orders');if(!this.valid(epoch,account))return;
    if(synced.self?.id!==account){this.close();return;}
    const committed=action==='order'?synced.order?.status==='pending':synced.order?.id===this.intent.orderId&&synced.order?.status===(action==='take'?'taken':'cancelled');
    result=committed?synced:await api<any>('coffee-orders',this.intent);
   }
   if(!this.valid(epoch,account))return;
   if(result.self?.id!==account){this.close();return;}
   if(result.self.revision<(world.bridge.user?.revision??0)){await this.sync();return;}
   world.receive(result);
   this.order=result.order;this.intent=null;this.uncertain=false;this.busy=false;this.render();
  }catch(e){if(this.valid(epoch,account)){this.busy=false;this.uncertain=true;this.render((e as Error).message);}}
 }
 update(){if(this.dialog.open&&(onlineWorld()?.bridge.user?.id!==this.account||!onlineWorld()?.bridge.connected||!onlineWorld()?.bridge.controller))this.close();}
 close(){this.epoch++;this.busy=false;if(this.dialog.open)this.dialog.close();}
 dispose(){this.close();this.dialog.remove();}
}
