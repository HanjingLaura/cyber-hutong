import Phaser from 'phaser';
import {sharedAction} from './multiplayer/world-client';
import { preloadGuest, placeGuest, guestBlocks } from './easter-eggs';
import { playerInventory } from './player-inventory';

const centers = [88, 173, 259, 344];
const sinkCenters = [459, 534];
const portals = [{x:54,width:63},{x:136,width:70},{x:229,width:67},{x:312,width:66}];
const seatedFootY = 208;
type Target = { kind:'door'|'toilet'|'sink'; index:number; distance:number };
declare global { interface Window { __bathroomPreview?: { getState: () => unknown } } }

/** Door thresholds, toilet seat anchors and walkable bays share the same layout. */
export class BathroomScene extends Phaser.Scene {
  private actor=false;
  private doors: Phaser.GameObjects.Graphics[] = [];
  private angles=centers.map(()=>0);
  private doorMotion=centers.map(()=>({angle:0}));
  private open = centers.map(()=>false);
  private turning = centers.map(()=>false);
  private keys!: Record<string,Phaser.Input.Keyboard.Key>;
  private water!: Phaser.GameObjects.Graphics;
  private x = 570;
  private y = 295;
  private facing = 3;
  private seated: number|null = null;
  private washing: number|null = null;
  private washStarted = 0;
  private message = 'E 开门 · E 坐下';
  constructor(){super('bathroom');}
  preload(){
    preloadGuest(this,'ferret');
    if(!this.textures.exists('bathroom-room'))this.load.image('bathroom-room',new URL('../assets/drafts/bathroom-room-v4.png',import.meta.url).href);
  }
  create(){
    placeGuest(this,'ferret');
    this.add.image(0,0,'bathroom-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    // Plumbing and partitions are painted together; only doors are movable.
    centers.forEach((_,i)=>{this.doors.push(this.add.graphics().setDepth(209));this.paintDoor(i);});
    this.water=this.add.graphics().setDepth(215);
    this.actor=true;
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!;
    const action=(event:KeyboardEvent)=>{
      if(!this.sys.isActive()||event.repeat||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(event.code==='KeyE'){event.preventDefault();this.interact();}
      if(event.code==='Escape'&&this.seated!==null){event.preventDefault();this.stand();}
      if(event.code==='KeyF'){
        const index=this.seated??(this.nearest()?.kind==='sink'?null:this.nearest()?.index);
        if(index!==undefined&&index!==null){event.preventDefault();this.toggleDoor(index);}
      }
    };
    const clear=()=>this.input.keyboard?.resetKeys();
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.once('shutdown',()=>{window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    this.events.on('sleep',clear);
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive())this.interact();});
    document.querySelector('#bathroom-door')!.addEventListener('click',()=>{
      if(!this.sys.isActive())return;
      const target=this.nearest(),index=this.seated??(target&&target.kind!=='sink'?target.index:null);
      if(index!==null)this.toggleDoor(index);
    });
    window.__bathroomPreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,seated:this.seated,doors:[...this.open],turning:[...this.turning],washing:this.washing,nearest:this.nearest(),hand:playerInventory.hand,seatAnchors:centers.map(x=>({x,y:seatedFootY})),sinkCount:2})};
    world.focus();
  }
  private nearest():Target|undefined {
    if(this.seated!==null)return;
    const candidates:Target[]=[];
    centers.forEach((x,index)=>{
      const distance=Math.hypot(this.x-x,this.y-226);
      if(distance<33)candidates.push({kind:this.open[index]?'toilet':'door',index,distance});
    });
    sinkCenters.forEach((x,index)=>{
      const distance=Math.hypot(this.x-x,this.y-233);
      if(distance<30)candidates.push({kind:'sink',index,distance});
    });
    return candidates.sort((a,b)=>a.distance-b.distance)[0];
  }
  private toggleDoor(index:number){
    if(this.turning[index])return;
    if(sharedAction(`bathroom:door-${index}`,'toggle'))return;
    if(this.turning[index])return;
    // Closing cannot trap a walking actor crossing the threshold.
    if(this.open[index]&&this.seated!==index&&Math.abs(this.x-centers[index])<33&&this.y<218){
      this.message='先出门';return;
    }
    this.setDoorOpen(index,!this.open[index]);
  }
  setDoorOpen(index:number,opening:boolean){
    if(this.open[index]===opening&&!this.turning[index])return;
    this.open[index]=opening;this.turning[index]=true;
    const pose=this.doorMotion[index];
    this.tweens.killTweensOf(pose);pose.angle=this.angles[index];
    this.tweens.add({targets:pose,angle:opening?Math.PI/2:0,duration:260,ease:'Sine.easeInOut',onUpdate:()=>{this.angles[index]=pose.angle;this.paintDoor(index);},onComplete:()=>{this.turning[index]=false;}});
  }
  private paintDoor(index:number){
    const g=this.doors[index],p=portals[index],a=this.angles[index];
    const farX=Math.round(p.x+p.width*Math.cos(a)+10*Math.sin(a)),dy=Math.round(24*Math.sin(a));
    const points=[new Phaser.Math.Vector2(p.x,77),new Phaser.Math.Vector2(farX,77+dy),new Phaser.Math.Vector2(farX,206+dy),new Phaser.Math.Vector2(p.x,206)];
    g.setDepth(209+Math.max(0,dy));
    g.clear().fillStyle(0xd8c3a2).lineStyle(1,0x514b3e).fillPoints(points,true).strokePoints(points,true);
    g.lineStyle(2,0xf2e2bf).lineBetween(p.x+2,79,p.x+2,204);
    const hx=Math.round(p.x+(farX-p.x)*.84),hy=Math.round(147+dy*.84);
    g.fillStyle(0x494d4a).fillRect(hx,hy,2,5).fillRect(p.x,102,2,5).fillRect(p.x,177,2,5);
  }

  private stand(){
    if(this.seated===null)return;
    const index=this.seated;
    if(this.turning[index])return;
    if(!this.open[index])this.toggleDoor(index);
    this.seated=null;this.x=centers[index];this.y=235;this.facing=0;
    this.message='';
  }
  private interact(){
    if(this.washing!==null)return;
    if(this.seated!==null){this.stand();return;}
    const target=this.nearest();if(!target)return;
    if(target.kind==='door'){this.toggleDoor(target.index);return;}
    if(target.kind==='toilet'){
      if(this.turning[target.index])return;
      this.seated=target.index;this.x=centers[target.index];this.y=seatedFootY;this.facing=0;
      this.message=`F 门 · Esc 起身`;return;
    }
    this.washing=target.index;this.x=sinkCenters[target.index];this.y=237;this.facing=2;this.washStarted=this.time.now;
    this.message='';
    this.time.delayedCall(1500,()=>{this.washing=null;this.message='';this.water.clear();});
  }
  private canWalk(x:number,y:number){
    if(guestBlocks('ferret',x,y))return false;
    // An outward door occupies the aisle as well as changing its appearance.
    if(portals.some((p,i)=>{
      const a=this.angles[i];if(a<.05)return false;
      const dx=p.width*Math.cos(a)+10*Math.sin(a),dy=24*Math.sin(a);
      const t=Phaser.Math.Clamp(((x-p.x)*dx+(y-206)*dy)/(dx*dx+dy*dy),0,1);
      return Math.hypot(x-p.x-dx*t,y-206-dy*t)<7;
    }))return false;
    const right=Math.min(608,526+(y-175)*1.35);
    if(x<48||x>right||y<174||y>316)return false;
    if(y<218&&x>406)return false;
    if(y<218&&x<=406){
      const index=centers.findIndex(cx=>Math.abs(x-cx)<26);
      if(index<0||!this.open[index]||this.turning[index])return false;
      if(Math.abs(x-centers[index])<22&&y<205)return false;
    }
    return true;
  }
  update(_time:number,delta:number){
    if(!this.actor)return;
    let moving=false;
    const focused=document.activeElement===document.querySelector('.world')||document.activeElement===this.game.canvas;
    if(focused&&this.seated===null&&this.washing===null){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
      const dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){
        const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;
        if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;
        if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;
        this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;
      }
    }
    
    this.water.clear();
    if(this.washing!==null){
        const x=sinkCenters[this.washing],phase=Math.floor((this.time.now-this.washStarted)/100)%3;
        this.water.lineStyle(2,0xb4e1ed).lineBetween(x,141,x,149)
          .fillStyle(0xd4f3f6).fillRect(x-4+phase*2,150,2,2).fillRect(x+3-phase,151,2,2);
    }
    const target=this.nearest(),doorIndex=this.seated??(target&&target.kind!=='sink'?target.index:null);
    const button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=this.washing!==null||this.seated===null&&!target;
    button.textContent=this.seated!==null?'起身':target?.kind==='door'?`打开 ${target.index+1} 号隔间`:target?.kind==='toilet'?`坐到 ${target.index+1} 号马桶`:target?.kind==='sink'?'洗手':'';
    const doorButton=document.querySelector<HTMLButtonElement>('#bathroom-door')!;
    doorButton.disabled=doorIndex===null||doorIndex!==null&&this.turning[doorIndex];
    doorButton.textContent=doorIndex===null?'':`${this.open[doorIndex]?'关':'开'}门`;
    document.querySelector('#mode')!.textContent=this.seated!==null?`坐在 ${this.seated+1} 号马桶上`:this.washing!==null?'正在洗手':moving?'在厕所走动':'站在厕所';
    document.querySelector('#hint')!.textContent=this.message;
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=this.seated!==null?'E / Esc 起身 · F 开关隔间门':target?`E · ${button.textContent}${target.kind==='toilet'?' · F 关门':''}`:'E 开门 / 坐下 · E 洗手';
    document.querySelector('#bathroom-state')!.textContent='';
  }
}
