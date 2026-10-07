import Phaser from 'phaser';
import { playerInventory, type ItemName } from './player-inventory';
import { preloadGuest, placeGuest, guestBlocks } from './easter-eggs';
import {sharedAction,useDevice,releaseDevice,onlineWorld} from './multiplayer/world-client';

type Mode='walk'|'run'|'curl'|'rest'|'breathe';
type Target={kind:'run'|'curl'|'rest'|'breathe'|'water'|'stash';x:number;y:number;index:number};
const treadmills=[225,320,415];
const benches=[{x:88,y:211,approachX:165,approachY:221},{x:551,y:184,approachX:551,approachY:206}];
const targets:Target[]=[
  ...treadmills.map((x,index)=>({kind:'run' as const,x,y:155,index})),
  {kind:'curl',x:123,y:110,index:0},
  ...benches.map((b,index)=>({kind:'rest' as const,x:b.approachX,y:b.approachY,index})),
  {kind:'breathe',x:561,y:302,index:0},{kind:'water',x:46,y:307,index:0},{kind:'stash',x:91,y:304,index:0},
];
const names={run:'使用跑步机',curl:'哑铃弯举',rest:'坐下休息',breathe:'呼吸练习',water:'接一瓶水',stash:'储物架'};
declare global {interface Window{__gymPreview?:{getState:()=>unknown}}}

export class GymScene extends Phaser.Scene {
  private actor=false;
  private belt!:Phaser.GameObjects.Graphics;private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private x=320;private y=290;private facing=2;private mode:Mode='walk';private machine=0;
  private elapsed=0;private distance=0;private speeds=[4,7,10];private speedIndex=0;
  private reps=0;private liftStart:number|null=null;private breaths=0;private breathTime=0;
  private returnPoint={x:320,y:290};
  private stored:{name:ItemName;seasoning:string[]}[]=[];
  private message='靠近器械按 E。';
  private dialog=document.querySelector<HTMLDialogElement>('#gym-storage')!;
  constructor(){super('gym');}
  preload(){
    preloadGuest(this,'tutu');
    const load=(k:string,u:string)=>{if(!this.textures.exists(k))this.load.image(k,u);};
    load('gym-room',new URL('../assets/drafts/gym-room-v1.png',import.meta.url).href);
  }
  create(){
    this.add.image(0,0,'gym-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    placeGuest(this,'tutu');
    this.actor=true;
    this.belt=this.add.graphics().setDepth(0);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!;
    const action=(event:KeyboardEvent)=>{
      if(!this.sys.isActive()||event.repeat||this.dialog.open||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(event.code==='KeyE'){event.preventDefault();this.interact();}
      if(event.code==='Escape'&&this.mode!=='walk'){event.preventDefault();this.stop();}
      if(event.code==='Space'&&this.mode==='curl'){event.preventDefault();this.lift();}
      if(event.code==='KeyF'&&this.mode==='run'){event.preventDefault();this.changeSpeed();}
    };
    const clear=()=>this.input.keyboard?.resetKeys();
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.once('shutdown',()=>{window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    this.events.on('sleep',()=>{clear();if(this.mode!=='walk')this.stop();if(this.dialog.open)this.dialog.close();});
    document.querySelector('#gym-storage-close')!.addEventListener('click',()=>this.dialog.close());
    this.dialog.addEventListener('close',()=>{clear();world.focus();});
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive()&&!this.dialog.open)this.interact();});
    document.querySelector('#gym-rep')!.addEventListener('click',()=>{if(this.sys.isActive())this.lift();});
    document.querySelector('#gym-speed')!.addEventListener('click',()=>{if(this.sys.isActive())this.changeSpeed();});
    window.__gymPreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,mode:this.mode,nearest:this.nearest(),machine:this.machine,speed:this.speeds[this.speedIndex],distance:this.distance,elapsed:this.elapsed,reps:this.reps,lifting:this.liftStart!==null,breaths:this.breaths,hand:playerInventory.hand,stored:this.stored,message:this.message})};
    world.focus();
  }
  private nearest(){return targets.filter(t=>Math.hypot(this.x-t.x,this.y-t.y)<29).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0];}
  private changeSpeed(){if(this.mode==='run')this.speedIndex=(this.speedIndex+1)%this.speeds.length;}
  private lift(){if(this.mode==='curl'&&this.liftStart===null){this.liftStart=this.time.now;this.message='举起，再慢慢放下。';}}
  private stop(){if(this.mode==='run'||this.mode==='curl')releaseDevice(this.mode==='run'?`run-${this.machine}`:'curl');this.mode='walk';this.liftStart=null;this.breathTime=0;this.x=this.returnPoint.x;this.y=this.returnPoint.y;this.facing=0;this.message='训练结束。';this.belt.clear();}
  private begin(kind:Mode,index:number){
    this.machine=index;this.mode=kind;this.input.keyboard?.resetKeys();
    if(kind==='run'){this.returnPoint={x:treadmills[index],y:155};this.x=treadmills[index];this.y=127;this.facing=2;this.message='F 切换速度，E / Esc 下机。';return;}
    this.returnPoint={x:this.x,y:this.y};
    if(kind==='curl'){this.x=123;this.y=115;this.facing=0;this.message='Space 举一次哑铃，E / Esc 放回。';}
    if(kind==='rest'){this.x=benches[index].x;this.y=benches[index].y;this.facing=0;this.message='E / Esc 起身。';}
    if(kind==='breathe'){this.x=561;this.y=297;this.facing=0;this.breathTime=0;this.message='跟着节奏吸气、呼气，E / Esc 结束。';}
  }
  private storage(){
    const list=document.querySelector('#gym-storage-items')!;list.replaceChildren();
    const make=(label:string,disabled:boolean,run:()=>void)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=disabled;button.addEventListener('click',()=>{run();this.dialog.close();});list.append(button);};
    make(playerInventory.hand?`存放${playerInventory.hand}`:'存放手中物品',!playerInventory.hand||this.stored.length>=6,()=>{if(sharedAction('gym:stash','put',{slot:onlineWorld()?.objects.get('gym:stash')?.slots?.findIndex(i=>!i)??0}))return;if(playerInventory.hand&&this.stored.length<6){this.stored.push({name:playerInventory.hand,seasoning:[...playerInventory.noodleSeasoning]});playerInventory.hand=null;this.message='物品已存好，可以训练了。';}});
    this.stored.forEach((item,index)=>make(`拿回${item.name}`,!!playerInventory.hand,()=>{if(sharedAction('gym:stash','take',{slot:(item as typeof item & {slot?:number}).slot??index}))return;if(!playerInventory.hand){playerInventory.hand=item.name;playerInventory.noodleSeasoning=[...item.seasoning];this.stored.splice(index,1);this.message=`拿回了${item.name}。`;}}));
    this.input.keyboard?.resetKeys();this.dialog.showModal();
  }
  private interact(){
    if(this.mode!=='walk'){this.stop();return;}
    const target=this.nearest();if(!target)return;
    if(playerInventory.hand&&['run','curl'].includes(target.kind)){this.message='训练需要空手，先存放物品。';return;}
    if(['run','curl'].includes(target.kind)){
      const kind=target.kind as 'run'|'curl';
      const index=target.index;
      const device=kind==='run'?`run-${index}`:'curl';
      if(useDevice(device,()=>{if(this.sys.isActive()&&this.mode==='walk')this.begin(kind,index);}))return;
      this.begin(kind,index);return;
    }
    if(target.kind==='stash'){this.storage();return;}
    if(target.kind==='water'){
      if(playerInventory.hand){this.message='手里已有物品，先存到旁边储物架。';return;}
      if(sharedAction('gym:water','supply',{item:'水'}))return;
      playerInventory.hand='水';playerInventory.noodleSeasoning=[];this.message='接了一瓶水，可以带去其他场景。';return;
    }
    this.begin(target.kind,target.index);
  }
  private canWalk(x:number,y:number){
    if(guestBlocks('tutu',x,y))return false;
    const inset=32+(350-y)*.09;if(x<inset||x>640-inset||y<90||y>338)return false;
    if(treadmills.some(cx=>Math.abs(x-cx)<31&&y<143))return false;
    if(x<90&&y<178)return false; // dumbbell rack
    if(x>490&&y<185)return false; // barbell and bench
    if(x>74&&x<143&&y>140&&y<211)return false; // adjustable bench
    if(x<90&&y>218&&y<305)return false; // drinking water and shelf
    if(x>565&&y>210&&y<266)return false; // rolled mats
    return true;
  }
  update(_time:number,delta:number){
    if(!this.actor)return;
    let moving=false;const dt=Math.min(delta,50);
    const focused=document.activeElement===document.querySelector('.world')||document.activeElement===this.game.canvas;
    if(this.mode==='walk'&&!this.dialog.open&&focused){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;}
    }
    this.belt.clear();
    if(this.mode==='curl'){
      
      let frame=0;
      if(this.liftStart!==null){const age=this.time.now-this.liftStart;frame=age<170?1:age<400?2:1;if(age>=620){this.reps++;this.liftStart=null;frame=0;this.message=`完成 ${this.reps} 次弯举。`;}}
      void frame;
    }else{
      if(this.mode==='run'){
        this.elapsed+=dt/1000;this.distance+=this.speeds[this.speedIndex]*dt/3600;
        const shift=Math.floor(this.elapsed*this.speeds[this.speedIndex]*4)%12;
        for(let y=82+shift;y<131;y+=12)this.belt.fillStyle(0x505860).fillRect(this.x-16,y,32,1);
      }
      if(this.mode==='breathe'){this.breathTime+=dt;while(this.breathTime>=8000){this.breaths++;this.breathTime-=8000;}}
      
    }
    const target=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=this.dialog.open||this.mode==='walk'&&!target;button.textContent=this.mode==='walk'?target?names[target.kind]:'靠近器械':this.mode==='run'?'下跑步机':this.mode==='curl'?'放回哑铃':this.mode==='rest'?'起身':'结束练习';
    document.querySelector('#mode')!.textContent={walk:moving?'在健身房走动':'站在健身房',run:'正在跑步',curl:'哑铃弯举',rest:'坐下休息',breathe:'呼吸练习'}[this.mode];
    document.querySelector('#hint')!.textContent=this.message;
    document.querySelector('#gym-stats')!.textContent=`跑步 ${this.distance.toFixed(1)} 米 · ${Math.floor(this.elapsed)} 秒 · 弯举 ${this.reps} 次 · 呼吸 ${this.breaths} 轮`;
    document.querySelector('#gym-hand')!.textContent=`手中：${playerInventory.hand??'空'} · 储物架 ${this.stored.length}/6`;
    document.querySelector<HTMLButtonElement>('#gym-rep')!.hidden=this.mode!=='curl';document.querySelector<HTMLButtonElement>('#gym-rep')!.disabled=this.liftStart!==null;
    document.querySelector<HTMLButtonElement>('#gym-speed')!.hidden=this.mode!=='run';document.querySelector('#gym-speed')!.textContent=`速度 ${this.speeds[this.speedIndex]} km/h · F`;
    document.querySelector('#gym-breath')!.textContent=this.mode==='breathe'?this.breathTime<4000?'吸气…':'呼气…':'';
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=this.mode==='run'?'F 调速 · E / Esc 下机':this.mode==='curl'?'Space 举起 / 放下 · E / Esc 结束':this.mode!=='walk'?'E / Esc 结束':target?`E · ${names[target.kind]}`:'靠近器械按 E';
  }
}
