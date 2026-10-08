import {sceneWalkable} from '../shared/walkability.mjs';
import { BASE } from './base';
import Phaser from 'phaser';
import { ArcadeGames, type ArcadeKind } from './arcade-games';
import { registerFrames } from './frames';
const machines=[{kind:'mines' as ArcadeKind,name:'扫雷',x:95,y:205},{kind:'spider' as ArcadeKind,name:'蜘蛛纸牌',x:182,y:205},{kind:'claw' as ArcadeKind,name:'抓娃娃',x:269,y:205},{kind:'basketball' as ArcadeKind,name:'投篮',x:125,y:339},{kind:'hockey' as ArcadeKind,name:'空气曲棍球',x:434,y:322}];
const webMachines=[
  {kind:'plane',name:'大飞机',x:356,y:205,url:'https://hanjing-laura.vercel.app/BitePass'},
  {kind:'octopus',name:'章鱼接龙',x:443,y:205,url:'https://hanjing-laura.vercel.app/zhangyu'},
  {kind:'moles',name:'胡同地鼠',x:530,y:205,url:BASE+'moles/'},
];
const bench={x:535,y:342,approachX:584,approachY:330};
declare global {interface Window{__arcadePreview?:{getState:()=>unknown}}}
export class ArcadeScene extends Phaser.Scene {
  private actor=false;
  private games!:ArcadeGames;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private x=320;
  private y=320;
  private facing=2;
  private seated:string|null=null;private returnPoint={x:584,y:330};
  constructor(){super('arcade');}
  preload(){const load=(k:string,u:string)=>{if(!this.textures.exists(k))this.load.image(k,u);};load('arcade-room',new URL('../assets/drafts/arcade-room-v3.png',import.meta.url).href);load('arcade-props-v2',new URL('../assets/drafts/arcade-props-v2.png',import.meta.url).href);}
  private nearest(){return [...machines,...webMachines].filter(m=>Math.hypot(this.x-m.x,this.y-m.y)<30).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0];}
  private play(machine:(typeof machines)[number]|(typeof webMachines)[number]){this.input.keyboard?.resetKeys();if('url' in machine){window.open(machine.url,'_blank','noopener,noreferrer');}else this.games.open(machine.kind);}
  create(){
    this.add.image(0,0,'arcade-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    for(const machine of [...machines.slice(0,3),...webMachines]){
      this.add.zone(machine.x,126,76,110).setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(this.games.dialog.open)return;if(Math.hypot(this.x-machine.x,this.y-machine.y)<30)this.play(machine);else document.querySelector('#hint')!.textContent='走近一点';});
    }
    const frames=registerFrames(this,'arcade-props-v2',3,1);
    const basketball=this.add.image(125,330,'arcade-props-v2',frames[0].name).setOrigin(.5,1).setDisplaySize(84,124).setDepth(330);
    const hockey=this.add.image(434,304,'arcade-props-v2',frames[1].name).setOrigin(.5,1).setDisplaySize(135,75).setDepth(304);
    const seat=this.add.image(bench.x,bench.y,'arcade-props-v2',frames[2].name).setOrigin(.5,1).setDisplaySize(88,42).setDepth(342);
    [basketball,hockey].forEach((image,index)=>image.setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(this.games.dialog.open)return;const target=machines[index+3];if(Math.hypot(this.x-target.x,this.y-target.y)<35){this.games.open(target.kind);}else document.querySelector('#hint')!.textContent='走近一点';}));
    seat.setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(!this.games.dialog.open&&(this.seated!==null||this.nearBench()))this.interact();});
    this.actor=true;this.games=new ArcadeGames();
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!;
    const action=(event:KeyboardEvent)=>{
      if(!this.sys.isActive()||event.repeat||this.games.dialog.open||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(event.code==='KeyE'){event.preventDefault();this.interact();}
      if(event.code==='Escape'&&this.seated!==null){event.preventDefault();this.stand();}
    };
    const clear=()=>this.input.keyboard?.resetKeys();
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.once('shutdown',()=>{this.games.dispose();window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    this.events.on('sleep',()=>{clear();if(this.games.dialog.open)this.games.dialog.close();if(this.seated!==null)this.stand();});
    this.games.dialog.addEventListener('close',clear);
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive()&&!this.games.dialog.open)this.interact();});
    window.__arcadePreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,seated:this.seated,machines:[...machines,...webMachines],bench,nearest:this.nearest()?.kind,open:this.games.dialog.open})};world.focus();
  }
  private nearBench(){return Math.hypot(this.x-bench.approachX,this.y-bench.approachY)<24;}
  private stand(){this.seated=null;this.x=this.returnPoint.x;this.y=this.returnPoint.y;this.facing=0;}
  private interact(){if(this.seated!==null){this.stand();return;}if(this.nearBench()){this.returnPoint={x:this.x,y:this.y};this.seated='bench';this.x=bench.x;this.y=bench.y-3;this.facing=0;this.input.keyboard?.resetKeys();return;}const machine=this.nearest();if(machine){this.input.keyboard?.resetKeys();this.play(machine);}}
  private canWalk(x:number,y:number){return sceneWalkable('arcade',x,y);}
  update(_time:number,delta:number){
    if(!this.actor)return;
    let moving=false;
    const focused=document.activeElement===document.querySelector('.world')||document.activeElement===this.game.canvas;
    if(focused&&!this.games.dialog.open&&this.seated===null){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
      const dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;
        if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;
        this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;
      }
    }
    
    const target=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=!target&&!this.nearBench()&&!this.seated;button.textContent=this.seated?'起身':this.nearBench()?'坐下休息':target?`玩${target.name}`:'';
    document.querySelector('#mode')!.textContent=this.games.dialog.open?'正在玩游戏':this.seated?'':moving?'在娱乐室走动':'站在娱乐室';
    document.querySelector('#hint')!.textContent=this.seated?'E / Esc 起身':this.nearBench()?'E · 坐下休息':target?`E · ${target.name}`:'E 玩游戏';
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=this.seated?'E / Esc 起身':this.nearBench()?'E · 坐下休息':target?`E · ${target.name}`:'E 玩游戏';
  }
}
