import Phaser from 'phaser';
import {CoffeeWindow} from './coffee-window';
import {sceneWalkable} from '../shared/walkability.mjs';
import geometry from '../shared/interactions.json';
import {bindSceneEvent,sceneLabels} from './scene-dom';
import {setGuide} from './hud';
import {onlineWorld} from './multiplayer/world-client';
import {api} from './multiplayer/api';
import {showMemoryTicket} from './ticket-view';
import {PlaceChairs,preloadPlaceChairs} from './place-chairs';
import {registerFrames} from './frames';
import {preloadSceneProp} from './scene-props';
import {stepRide,type RideMotion} from './ride-physics.mjs';
import {stepSkate} from './skateboard-physics.mjs';
import {campusCones,scooterWalkable,skateboardWalkable,safeOutdoorPoint,walkerScooterPathClear,scooterDismountPoint} from '../shared/outdoor-collision.mjs';
type Place='manner'|'yousheng'|'google'|'meeting'|'street'|'campus';
type Ride={x:number;y:number;facing:number;seats:Record<string,{role:string;x:number;y:number}|null>};
const backgrounds={
 manner:new URL('../assets/drafts/manner-room.png',import.meta.url).href,
 yousheng:new URL('../assets/maps/places/yousheng.png',import.meta.url).href,
 google:new URL('../assets/maps/places/google.png',import.meta.url).href,
 meeting:new URL('../assets/maps/places/meeting.png',import.meta.url).href,
 street:new URL('../assets/maps/places/street.png',import.meta.url).href,
 campus:new URL('../assets/maps/places/campus.png',import.meta.url).href,
};
declare global{interface Window{__memoryPlacePreviews?:Record<string,{getState:()=>any}>}}
/** One lifecycle for memory locations; the multiplayer bridge remains the avatar owner. */
export class MemoryPlaceScene extends Phaser.Scene{
 actor=false;x=580;y=330;facing=2;seated:string|null=null;mode='walk';
 private coffee?:CoffeeWindow;private chairs?:PlaceChairs;private scooterBasket?:Phaser.GameObjects.Image;private driving=false;
 private keys!:Record<string,Phaser.Input.Keyboard.Key>;private art!:Phaser.GameObjects.Graphics;private scooter?:Phaser.GameObjects.Image;private board?:Phaser.GameObjects.Image;
 private riding=false;private pose:RideMotion={x:320,y:310,speed:0,heading:Math.PI};
 private parkedBoard={x:320,y:310,heading:Math.PI};
 private ride:Ride|null=null;private slot:string|null=null;private busy=false;private pendingOperation?:()=>boolean;private polling=false;private rideEpoch=0;private nextPoll=0;private nextDrive=0;private message='';private sittingBoard=false;private checkpoint=0;private laps=0;
 constructor(readonly place:Place){super(place);}
 preload(){if(this.place==='google')preloadSceneProp(this,'ticket-counter');preloadPlaceChairs(this,this.place);if(this.place==='campus'){if(!this.textures.exists('skateboard'))this.load.image('skateboard',new URL('../assets/props/skateboard.png',import.meta.url).href);if(!this.textures.exists('traffic-cone'))this.load.image('traffic-cone',new URL('../assets/props/traffic-cone-v2.png',import.meta.url).href);}if(!this.textures.exists('place-'+this.place))this.load.image('place-'+this.place,backgrounds[this.place]);if(this.place==='street'&&!this.textures.exists('pink-scooter'))this.load.image('pink-scooter',new URL('../assets/props/pink-scooter.png',import.meta.url).href);}
 create(){
  if(this.place==='google')this.add.image(58,208,'ticket-counter').setOrigin(0).setDisplaySize(55,22).setDepth(230);
  this.add.image(0,0,'place-'+this.place).setOrigin(0).setDisplaySize(640,360).setDepth(-100);
  this.chairs=new PlaceChairs(this,this.place);
  if(this.place==='manner'){this.coffee=new CoffeeWindow(this);sceneLabels(this,[{text:'MANNER COFFEE',x:282,y:38,width:113,height:27},{text:'点单',x:238,y:181,width:44,height:18},{text:'取杯',x:418,y:181,width:44,height:18}]);}
  this.art=this.add.graphics();if(this.place==='street'){
   sceneLabels(this,[{text:'成府路',x:245,y:91,width:48,height:14},{text:'成府路站',x:14,y:119,width:34,height:16}]);
   this.scooter=this.add.image(320,285,'pink-scooter').setOrigin(.5,1).setDisplaySize(92,46);
   const image=this.textures.get('pink-scooter').getSourceImage();
   this.scooterBasket=this.add.image(320,285,'pink-scooter').setOrigin(.5,1).setDisplaySize(92,46).setCrop(image.width*.78,image.height*.28,image.width*.22,image.height*.33);
  }
  if(this.place==='campus'){
   this.board=this.add.image(this.parkedBoard.x,this.parkedBoard.y+1,'skateboard').setOrigin(.5,.5).setDisplaySize(48,16);
   const cone=registerFrames(this,'traffic-cone',1,1)[0];
   for(const {x,y} of campusCones){this.add.graphics().setDepth(y-1).fillStyle(0x111d35,.3).fillEllipse(x+3,y+4,21,6);this.add.image(x,y+5,'traffic-cone',cone.name).setOrigin(.5,1).setDisplaySize(18,26).setDepth(y+5);}
  }this.actor=true;
  this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
  window.__memoryPlacePreviews??={};window.__memoryPlacePreviews[this.place]={getState:()=>({ready:this.actor,x:this.x,y:this.y,facing:this.facing,seated:this.seated,mode:this.mode,riding:this.riding,speed:this.pose.speed,slot:this.slot,laps:this.laps,chairs:this.chairs?.getState()})};
  const key=(e:KeyboardEvent)=>{if(!this.sys.isActive()||e.repeat||!this.input.keyboard?.enabled||document.querySelector('dialog[open]'))return;
   if(e.code==='KeyE'){e.preventDefault();void this.interact();}
   if(e.code==='Escape'){e.preventDefault();void this.leave();}
   if(e.code==='KeyF'&&this.place==='campus'&&this.riding)this.sittingBoard=!this.sittingBoard;
  };window.addEventListener('keydown',key);
  bindSceneEvent(this,document.querySelector('#interact')!,'click',()=>{if(this.sys.isActive())void this.interact();});
  this.events.on('sleep',()=>{this.input.keyboard?.resetKeys();this.rideEpoch++;this.pendingOperation=undefined;this.busy=false;this.riding=false;this.slot=null;this.nextPoll=0;});
  this.events.once('shutdown',()=>{this.rideEpoch++;this.pendingOperation=undefined;this.busy=false;this.actor=false;window.removeEventListener('keydown',key);delete window.__memoryPlacePreviews?.[this.place];});
 }
 stand(){void this.leave(true);}
 private near(x:number,y:number){return Math.hypot(this.x-x,this.y-y)<36;}
 private nearBoard(){return this.near(this.parkedBoard.x,this.parkedBoard.y);}
 private walkable(x:number,y:number){return sceneWalkable(this.place,x,y)&&(this.place!=='street'||walkerScooterPathClear(this.x,this.y,x,y,this.ride??{x:320,y:285}));}
 private route(){return this.place==='street'?[[90,320],[90,248],[550,248],[550,320]]:[[100,320],[150,250],[490,250],[540,320]];}
 private seats(){return (geometry as any)[this.place]?.seats??{};}
 private nearestSeat(){return Object.entries<any>(this.seats()).find(([,s])=>this.near(...s.approach as [number,number]));}
 private refreshOperation(){if(this.pendingOperation&&!this.pendingOperation()){this.pendingOperation=undefined;this.busy=false;}}
 private operationContext(){
  const world=onlineWorld(),account=world?.bridge.user?.id,epoch=this.rideEpoch,worldEpoch=world?.epoch;
  return ()=>epoch===this.rideEpoch&&this.sys.isActive()&&onlineWorld()===world&&world?.bridge.user?.id===account&&world?.epoch===worldEpoch&&(!account||!!world?.bridge.connected&&!!world.bridge.controller);
 }
 private beginOperation(){
  const current=this.operationContext();this.pendingOperation=current;this.busy=true;return current;
 }
 private finishOperation(current:()=>boolean){if(this.pendingOperation===current){this.pendingOperation=undefined;this.busy=false;}}
 private async leave(force=false){
  this.refreshOperation();if(this.busy)return;
  if(this.seated){const s=this.seats()[this.seated];[this.x,this.y]=s.approach;this.seated=null;return;}
  if(!this.riding)return;if(!force&&this.pose.speed>8){this.message='先松开方向键停稳';return;}
  this.rideEpoch++;const current=this.beginOperation();try{if(this.place==='street'){if(onlineWorld()?.bridge.user?.role){const r=await api<any>('ride',{client:onlineWorld()!.client,action:'leave'});if(!current())return;this.ride=r.ride;}[this.x,this.y]=scooterDismountPoint(this.x,this.y,this.ride??{x:this.x,y:this.y});}if(this.place==='campus'){this.parkedBoard={x:this.x,y:this.y,heading:this.pose.heading};[this.x,this.y]=safeOutdoorPoint('campus',this.x,this.y);}this.riding=false;this.slot=null;this.pose.speed=0;}catch(e){if(current())this.message=(e as Error).message;}finally{this.finishOperation(current);}
 }
 private async interact(){
  this.refreshOperation();if(this.busy)return;if(this.coffee?.near(this.x,this.y)){await this.coffee.interact(this.x,this.y);return;}if(this.seated||this.riding){await this.leave();return;}
  if(this.place==='google'&&this.near(85,230)){await this.ticket();return;}
  if(this.place==='meeting'&&this.near(85,220)){this.message=this.message==='生日会'?'会议进行中':'生日会';return;}
  const seat=this.nearestSeat();if(seat){this.seated=seat[0];[this.x,this.y]=seat[1].at;this.facing=seat[1].facing;return;}
  if(this.place==='street'&&this.near(this.ride?.x??320,this.ride?.y??310)){
   const service=onlineWorld();if(!service?.bridge.user?.role){this.riding=true;this.slot='driver';this.x=this.ride?.x??320;this.y=this.ride?.y??285;this.pose={x:this.x,y:this.y,speed:0,heading:Math.PI};return;}
   this.rideEpoch++;const current=this.beginOperation();try{const slot=['driver','rear','front'].find(s=>!this.ride?.seats[s]);if(!slot)throw Error('车上已满');const r=await api<any>('ride',{client:service.client,action:'join',slot});if(!current())return;this.ride=r.ride;this.slot=slot;this.riding=true;this.facing=r.ride.facing;this.pose={x:r.ride.x,y:r.ride.y,speed:0,heading:[Math.PI/2,0,-Math.PI/2,Math.PI][r.ride.facing]};}catch(e){if(current())this.message=(e as Error).message;}finally{this.finishOperation(current);}return;
  }
  if(this.place==='campus'&&this.nearBoard()){this.riding=true;this.x=this.parkedBoard.x;this.y=this.parkedBoard.y;this.pose={x:this.x,y:this.y,speed:0,heading:this.parkedBoard.heading};this.message='';}
 }
 private async ticket(){
  const world=onlineWorld();if(!world?.bridge.user?.role){this.message='登录后领取自己的纪念票';return;}
  const current=this.beginOperation();try{const result=await api<any>('ticket',{client:world.client,action:'claim'});if(!current())return;world.receive(result);showMemoryTicket(result.ticket);}catch(e){if(current())this.message=(e as Error).message;}finally{this.finishOperation(current);}
 }
 private async poll(){
  if(this.polling||this.busy||!onlineWorld()?.bridge.user?.role)return;this.polling=true;const current=this.operationContext();
  try{const r=await api<any>('ride?client='+encodeURIComponent(onlineWorld()!.client));if(!current())return;this.ride=r.ride;const own=Object.entries<any>(r.ride.seats).find(([,s])=>s?.role===onlineWorld()?.bridge.user?.role);if(own){const resumed=!this.riding||this.slot!==own[0];this.slot=own[0];this.riding=true;if(this.slot!=='driver'||resumed){this.x=own[1].x;this.y=own[1].y;this.facing=r.ride.facing;if(resumed)this.pose={x:r.ride.x,y:r.ride.y,speed:0,heading:[Math.PI/2,0,-Math.PI/2,Math.PI][r.ride.facing]};}}else if(this.riding){this.riding=false;this.slot=null;this.pose.speed=0;}}
  catch(e){if(current())this.message=(e as Error).message;}finally{this.polling=false;}
 }
 private async drive(){
  if(this.driving||this.busy)return;
  const service=onlineWorld();if(!service?.bridge.user?.role)return;
  const current=this.operationContext();this.driving=true;
  try{
   const r=await api<any>('ride',{client:service.client,action:'drive',x:this.x,y:this.y,facing:this.facing});
   if(current())this.ride=r.ride;
  }catch(e){
   if(!current())return;
   this.message=(e as Error).message;this.pose.speed=0;
   if(this.ride){this.x=this.pose.x=this.ride.x;this.y=this.pose.y=this.ride.y;}
  }finally{this.driving=false;}
 }
 update(time:number,delta:number){
  if(!this.actor)return;this.refreshOperation();this.coffee?.update();const active=!!this.input.keyboard?.enabled&&!document.querySelector('dialog[open]');
  const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
  if(this.riding&&(this.place==='campus'||this.slot==='driver')){
   const input={x:active?dx:0,y:active?dy:0};
   const floor=(x:number,y:number)=>this.place==='street'?scooterWalkable(x,y):skateboardWalkable(x,y);
   this.pose=this.place==='campus'?stepSkate(this.pose,input,delta,floor):stepRide(this.pose,input,delta,floor);this.x=this.pose.x;this.y=this.pose.y;this.facing=Math.abs(Math.cos(this.pose.heading))>.5?(Math.cos(this.pose.heading)>0?1:3):(Math.sin(this.pose.heading)>0?0:2);
   const points=this.route();if(Math.hypot(this.x-points[this.checkpoint][0],this.y-points[this.checkpoint][1])<25){this.checkpoint=(this.checkpoint+1)%points.length;if(!this.checkpoint)this.laps++;this.message=`完成 ${this.laps} 圈 · 下一个路标 ${this.checkpoint+1}/4`;}
   if(this.place==='street'&&time>this.nextDrive&&!this.driving&&!this.busy){this.nextDrive=time+250;void this.drive();}
  }else if(active&&!this.seated&&!this.riding&&(dx||dy)){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy);if(this.walkable(this.x+dx*step,this.y))this.x+=dx*step;if(this.walkable(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?(dx>0?1:3):(dy>0?0:2);}
  if(this.place==='street'&&time>this.nextPoll){this.nextPoll=time+1000;void this.poll();}
  this.mode=this.riding?(this.place==='campus'?(this.sittingBoard?'skate-sit':'skateboard'):this.slot==='front'?'scooter-basket':'scooter'):this.seated?'sit':'walk';
  this.chairs?.update(id=>this.seated===id||!!onlineWorld()?.bridge.players.some(p=>p.scene===this.place&&p.seat===id));
  this.drawObject();const button=document.querySelector<HTMLButtonElement>('#interact')!;
  const can=this.coffee?.near(this.x,this.y)||this.seated||this.riding||this.nearestSeat()||this.place==='google'&&this.near(85,230)||this.place==='meeting'&&this.near(85,220)||this.place==='campus'&&this.nearBoard()||this.place==='street'&&this.near(this.ride?.x??320,this.ride?.y??310);
  button.disabled=!can||this.busy;button.textContent=this.place==='manner'?'点单 / 取咖啡':this.seated?'起身':this.riding?(this.place==='campus'?'停稳下板':'停稳下车'):this.place==='google'&&this.near(85,230)?'领取 / 查看纪念票':this.nearestSeat()?'坐下':this.place==='meeting'?'切换会议画面':this.place==='campus'?'滑滑板':'骑粉色电动车';
  setGuide(this.riding?(this.place==='campus'?'WASD / 方向键移动 · 松开停稳 · F 坐姿':'WASD / 方向键移动 · 松开停稳'):'WASD / 方向键移动',can?'E · '+button.textContent:'');document.querySelector('#mode')!.textContent=this.riding?`${this.place==='campus'?(this.sittingBoard?'坐着滑板':'滑滑板'):'电动车'} · ${Math.round(this.pose.speed/5)} km/h`:this.seated?'坐着参会':'散步';document.querySelector('#hint')!.textContent=this.message;
 }
 private drawObject(){
  const g=this.art;g.clear();
  if(this.place==='street'){const x=this.riding&&this.slot==='driver'?this.x:this.ride?.x??320,y=this.riding&&this.slot==='driver'?this.y:this.ride?.y??285,flip=(this.riding?this.facing:this.ride?.facing)===3;this.scooter?.setPosition(x,y).setDepth(y-1).setFlipX(flip);this.scooterBasket?.setPosition(x,y).setDepth(y+3).setFlipX(flip);}
  if(this.place==='campus'){
   const x=this.riding?this.x:this.parkedBoard.x,y=this.riding?this.y:this.parkedBoard.y;
   g.setDepth(-5).fillStyle(0x24372f,.18).fillEllipse(x,y+10,43.2,7);
   // The deck's center surface is texture row 7 of 16: align it with the sole
   // anchor, rather than centering the transparent sprite below the rider.
   this.board?.setPosition(Math.round(x),Math.round(y)+1).setDepth(y+2).setDisplaySize(48,16).setRotation(0).setFlipX(false);
  }
  if(this.riding){const p=this.route()[this.checkpoint];g.lineStyle(2,0xe5d69c).strokeCircle(p[0],p[1],12);}
  if(this.place==='meeting'&&this.message==='生日会'){g.setDepth(150);g.fillStyle(0xd49c91).fillRect(237,86,100,55);g.fillStyle(0xffe9b3).fillRect(270,116,36,17).fillStyle(0xda816a).fillRect(271,112,34,5).fillStyle(0xffd576).fillRect(286,104,3,8);}
 }
}
