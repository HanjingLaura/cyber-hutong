import Phaser from 'phaser';
import { playerInventory, type ItemName } from './player-inventory';
import { DanceBeat } from './dance-beat';
import { preloadGuest, placeGuest, guestBlocks } from './easter-eggs';
import {sharedAction} from './multiplayer/world-client';

type Mode = 'walk' | 'dance' | 'practice' | 'sit';
const sequence = [3, 2, 1, 0, 3, 1, 2, 0];
const arrows = ['↓', '→', '↑', '←'];
const targets = [{kind:'music',x:83,y:179}, {kind:'mirror',x:320,y:186}, {kind:'floor',x:320,y:267}, {kind:'bench',x:166,y:289}, {kind:'stash',x:565,y:178}] as const;
const names = {music:'开关音响',mirror:'对镜跳舞',floor:'跟拍练习',bench:'坐下休息',stash:'存放 / 拿回物品'};
declare global { interface Window { __dancePreview?: {getState:()=>unknown} } }

export class DanceStudioScene extends Phaser.Scene {
  mirrorMask!:Phaser.Display.Masks.GeometryMask;
  private actor=false;
  private keys!:Record<string, Phaser.Input.Keyboard.Key>;
  private beat = new DanceBeat(); private mode:Mode = 'walk';
  private x=320; private y=298; private facing=2;
  private returnPoint={x:320,y:298}; private stored:{name:ItemName;seasoning:string[]}|null=null;
  private results:('hit'|'miss'|null)[]=[]; private score=0; private best=0;
  private message='靠近镜子、音响或长凳按 E。'; private revision=0;
  private beatMarks!:Phaser.GameObjects.Graphics;
  constructor(){super('dance');}
  preload(){
    preloadGuest(this,'lulu');
    const load=(k:string,u:string)=>{if(!this.textures.exists(k))this.load.image(k,u);};
    load('dance-room',new URL('../assets/drafts/dance-room-v1.png',import.meta.url).href);
  }
  create(){
    this.add.image(0,0,'dance-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    this.mirrorMask=this.add.graphics().fillStyle(0xffffff).fillRect(118,35,404,96).setVisible(false).createGeometryMask();
    placeGuest(this,'lulu');
    this.actor=true;
    this.beatMarks=this.add.graphics().setDepth(350);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!;
    const clear=()=>this.input.keyboard?.resetKeys();
    const action=(e:KeyboardEvent)=>{
      if(!this.sys.isActive()||e.repeat||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(e.code==='KeyE'){e.preventDefault();this.interact();}
      if(e.code==='Escape'&&this.mode!=='walk'){e.preventDefault();this.stop();}
      if(e.code==='KeyF'&&this.mode!=='practice'){e.preventDefault();void this.tempo();}
      const direction:Record<string,number>={ArrowDown:0,KeyS:0,ArrowRight:1,KeyD:1,ArrowUp:2,KeyW:2,ArrowLeft:3,KeyA:3};
      if(this.mode==='practice'&&direction[e.code]!==undefined){e.preventDefault();this.press(direction[e.code]);}
    };
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.on('sleep',()=>{this.stop();this.beat.stop();clear();});
    this.events.once('shutdown',()=>{this.revision++;this.beat.dispose();window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    const bind=(id:string,fn:()=>void)=>document.querySelector(id)!.addEventListener('click',()=>{if(this.sys.isActive()){fn();world.focus();}});
    bind('#interact',()=>this.interact());
    bind('#dance-start',()=>{if(this.nearFloor())void this.start('dance');});
    bind('#dance-practice',()=>{if(this.nearFloor())void this.start('practice');});
    bind('#dance-tempo',()=>void this.tempo());
    bind('#dance-music',()=>{if(this.beat.playing){if(this.mode==='dance'||this.mode==='practice')this.stop();this.beat.stop();}else void this.beat.start().catch(()=>{this.message='音响未能播放，请再试一次。';});});
    window.__dancePreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,mode:this.mode,nearest:this.nearest(),playing:this.beat.playing,bpm:this.beat.bpm,epoch:this.beat.epoch,score:this.score,best:this.best,results:this.results,hand:playerInventory.hand,stored:this.stored,message:this.message})};
    world.focus();
  }
  private nearest(){return targets.filter(t=>Math.hypot(this.x-t.x,this.y-t.y)<36).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0];}
  private nearFloor(){return this.mode==='walk'&&this.x>185&&this.x<465&&this.y>160&&this.y<330;}
  private async tempo(){
    if(this.mode==='practice')return;
    const values=[90,120,150];this.beat.bpm=values[(values.indexOf(this.beat.bpm)+1)%3];
    if(this.beat.playing)await this.beat.start();
  }
  private async start(mode:'dance'|'practice'){
    if(this.mode!=='walk')return;
    if(playerInventory.hand){this.message='手上有东西';return;}
    const revision=++this.revision;
    try{await this.beat.start();}catch{this.message='音响未能播放，请再试一次。';return;}
    if(revision!==this.revision||!this.sys.isActive())return;
    this.returnPoint={x:this.x,y:this.y};this.x=320;this.y=249;this.facing=2;this.mode=mode;
    this.results=sequence.map(()=>null);this.score=0;this.input.keyboard?.resetKeys();
    this.message=mode==='dance'?'Esc 停止':'方向键跟拍 · Esc 结束';
  }
  private stop(){
    this.revision++;
    this.beat.stop();
    if(this.mode!=='walk'){this.x=this.returnPoint.x;this.y=this.returnPoint.y;this.facing=0;this.message='结束';}
    this.mode='walk';this.input.keyboard?.resetKeys();
  }
  private press(direction:number){
    const period=60000/this.beat.bpm,position=(performance.now()-this.beat.epoch)/period-4,index=Math.round(position);
    if(index<0||index>=sequence.length||this.results[index]!==null||Math.abs(position-index)*period>160)return;
    this.results[index]=direction===sequence[index]?'hit':'miss';
    if(this.results[index]==='hit'){this.score++;this.message='踩中节拍！';}else this.message='错拍';
  }
  private interact(){
    if(this.mode!=='walk'){this.stop();return;}
    const target=this.nearest();if(!target)return;
    if(target.kind==='mirror'||target.kind==='floor'){void this.start(target.kind==='mirror'?'dance':'practice');return;}
    if(target.kind==='music'){if(this.beat.playing)this.beat.stop();else void this.beat.start().catch(()=>{this.message='音响未能播放，请再试一次。';});return;}
    if(target.kind==='stash'){
      if(sharedAction('dance:stash',playerInventory.hand?'put':'take',{slot:0}))return;
      if(playerInventory.hand){if(this.stored){this.message='储物格已满';return;}this.stored={name:playerInventory.hand,seasoning:[...playerInventory.noodleSeasoning]};playerInventory.hand=null;this.message='物品已存好。';}
      else if(this.stored){playerInventory.hand=this.stored.name;playerInventory.noodleSeasoning=[...this.stored.seasoning];this.stored=null;this.message='拿回物品。';}
      else this.message='储物架';return;
    }
    this.returnPoint={x:this.x,y:this.y};this.mode='sit';this.x=88;this.y=282;this.facing=0;this.message='Esc 起身';
  }
  private canWalk(x:number,y:number){
    if(guestBlocks('lulu',x,y))return false;
    if(x<30+(340-y)*.1||x>610-(340-y)*.1||y<177||y>338)return false;
    if(x<115&&y<171)return false;
    if(x>530&&y<169)return false;
    if(x<160&&y>239&&y<290)return false;
    return true;
  }
  update(_time:number,delta:number){
    if(!this.actor)return;
    const dt=Math.min(delta,50);let moving=false;
    const focused=[document.querySelector('.world'),this.game.canvas].includes(document.activeElement);
    if(this.mode==='walk'&&focused){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;}
    }
    const position=(performance.now()-this.beat.epoch)/(60000/this.beat.bpm);
    if(this.mode==='practice'){
      for(let i=0;i<8;i++)if(position>i+4+160/(60000/this.beat.bpm)&&this.results[i]===null)this.results[i]='miss';
      if(position>=12){this.best=Math.max(this.best,this.score);this.stop();this.message=`本轮 ${this.score} / 8 拍。最好 ${this.best} / 8。`;}
    }
    this.beatMarks.clear();
    if(this.beat.playing){
      const beat=((Math.floor(position)%4)+4)%4;
      for(let i=0;i<4;i++)this.beatMarks.fillStyle(i===beat?0xe5c56b:0x565d59).fillRect(299+i*11,335,7,3);
    }
    const target=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=this.mode==='walk'&&!target;
    button.textContent=this.mode==='walk'?target?names[target.kind]:'靠近镜子或设备':this.mode==='sit'?'起身':'结束跳舞';
    document.querySelector('#mode')!.textContent={walk:moving?'在舞室走动':'站在舞室',dance:'对镜跳舞',practice:'跟拍练习',sit:'坐下休息'}[this.mode];
    document.querySelector('#hint')!.textContent=this.message;
    document.querySelector('#dance-hand')!.textContent=`手中：${playerInventory.hand??'空'} · 储物格：${this.stored?.name??'空'}`;
    document.querySelector('#dance-music')!.textContent=this.beat.playing?'关闭音响':'播放节拍';
    document.querySelector('#dance-tempo')!.textContent=`${this.beat.bpm} BPM · F 调速`;
    (document.querySelector('#dance-tempo') as HTMLButtonElement).disabled=this.mode==='practice';
    for(const id of ['#dance-start','#dance-practice'])(document.querySelector(id) as HTMLButtonElement).disabled=!this.nearFloor();
    document.querySelector('#dance-score')!.textContent=`本轮 ${this.score} / 8 · 最好 ${this.best} / 8`;
    const current=Math.round(position)-4;
    document.querySelector('#dance-sequence')!.textContent=this.mode==='practice'?position<3.5?`准备 ${Math.max(1,4-Math.floor(position))}`:sequence.map((n,i)=>`${i===current?'[':''}${this.results[i]==='hit'?'✓':this.results[i]==='miss'?'×':arrows[n]}${i===current?']':''}`).join(' '):'← ↑ → ↓ · 四拍准备，八拍练习';
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=this.mode==='practice'?`${position<3.5?`准备 ${Math.max(1,4-Math.floor(position))}`:sequence.slice(Math.max(0,current),Math.max(0,current)+4).map(n=>arrows[n]).join(' ')} · ${this.score}/8 · Esc 结束`:this.mode!=='walk'?'E / Esc 结束':target?`E · ${names[target.kind]}`:'镜子前 E 跳舞 · 中央空地 E 跟拍';
  }
}
