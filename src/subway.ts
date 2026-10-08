import {sceneWalkable} from '../shared/walkability.mjs';
import Phaser from 'phaser';
import {sharedAction} from './multiplayer/world-client';
import { playerInventory } from './player-inventory';

// Inner door jambs in the station artwork, in the game's 640 × 360 coordinates.
const entrances = [{x:85,y:112,width:57,height:82},{x:289,y:112,width:62,height:82},{x:497,y:112,width:57,height:82}];
declare global { interface Window { __subwayPreview?: {getState:()=>unknown} } }
export class SubwayScene extends Phaser.Scene {
  private actor=false;
  private panels:Phaser.GameObjects.Graphics[]=[];
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private x=320; private y=305; private facing=2;
  private progress=0; private open=false;
  constructor(){super('subway');}
  preload(){if(!this.textures.exists('subway-room'))this.load.image('subway-room',new URL('../assets/drafts/wudaokou-station-v1.png',import.meta.url).href);}
  create(){
    this.add.image(0,0,'subway-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    entrances.forEach(e=>{
      const panel=this.add.graphics().setDepth(-80);
      const mask=this.add.graphics().fillStyle(0xffffff).fillRect(e.x,e.y,e.width,e.height);
      this.children.remove(mask);
      if(this.game.renderer.type===Phaser.WEBGL)panel.enableFilters().filters!.external.addMask(mask,false,this.cameras.main).autoUpdate=false;
      else panel.setMask(mask.createGeometryMask());
      this.panels.push(panel);
    });
    this.actor=true;
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!;
    const clear=()=>this.input.keyboard?.resetKeys();
    const action=(event:KeyboardEvent)=>{
      if(!this.sys.isActive()||event.repeat||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(event.code==='KeyE'){event.preventDefault();this.interact();}
    };
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.on('sleep',clear);
    this.events.once('shutdown',()=>{window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive()){this.interact();world.focus();}});
    window.__subwayPreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,nearest:this.nearest(),open:this.open,progress:this.progress,state:this.state(),doors:entrances,hand:playerInventory.hand})};
    world.focus();
  }
  private nearest(){return entrances.map((e,index)=>({index,x:e.x+e.width/2,y:242})).filter(e=>Math.hypot(this.x-e.x,this.y-e.y)<36).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0]?.index;}
  private state(){return '';}
  private interact(){if(this.nearest()!==undefined){if(sharedAction('subway:doors','toggle'))return;this.open=!this.open;}}
  private canWalk(x:number,y:number){return sceneWalkable('subway',x,y);}
  private drawDoors(){
    entrances.forEach((e,i)=>{
      const art=this.panels[i],half=e.width/2,travel=Math.round(this.progress*half);
      art.clear();
      for(const [side,left] of [[0,e.x-travel],[1,e.x+half+travel]]){
        art.fillStyle(0x566a76).fillRect(left,e.y,half,e.height);
        art.fillStyle(0xb9c6cc).fillRect(left+1,e.y+1,half-2,e.height-2);
        art.fillStyle(0xdce4e3).fillRect(left+3,e.y+2,2,e.height-4);
        art.fillStyle(0x8c9fa9).fillRect(left+half-5,e.y+2,3,e.height-4);
        art.fillStyle(0x183b61).fillRect(left,e.y+53,half,13);
        art.fillStyle(0x111f29).fillRect(left+5,e.y+10,half-10,36);
        art.fillStyle(0x3c6177).fillRect(left+7,e.y+12,half-14,31);
        art.fillStyle(0x7293a3).fillRect(left+8,e.y+14,2,25);
        art.fillStyle(0x596e7a).fillRect(left+5,e.y+e.height-8,half-10,2);
        art.fillStyle(0x233843).fillRect(side===0?left+half-1:left,e.y,1,e.height);
      }
    });
  }
  update(_time:number,delta:number){
    if(!this.actor)return;
    let moving=false;
    if([document.querySelector('.world'),this.game.canvas].includes(document.activeElement)){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;}
    }
    this.progress=Phaser.Math.Clamp(this.progress+(this.open?1:-1)*Math.min(delta,50)/750,0,1);
    this.drawDoors();
    const near=this.nearest()!==undefined,button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=!near;button.textContent=near?(this.open?'关闭车门':'打开车门'):'';
    document.querySelector('#mode')!.textContent='';
    document.querySelector('#hint')!.textContent='E 开关车门';
    document.querySelector('#subway-state')!.textContent=this.state();
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=near?`E · ${button.textContent}`:'E 开关车门';
  }
}
