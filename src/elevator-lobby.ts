import Phaser from 'phaser';
import {sharedAction} from './multiplayer/world-client';
import { ShopActor } from './shop-actor';
import { playerInventory } from './player-inventory';

// Calibrated to the generated image's inner jambs, rather than the requested prompt coordinates.
const entrances=[{x:201,y:84,width:98,height:147},{x:420,y:84,width:102,height:147}];
declare global{interface Window{__elevatorPreview?:{getState:()=>unknown}}}
export class ElevatorLobbyScene extends Phaser.Scene{
  private actor!:ShopActor;private panels:Phaser.GameObjects.Graphics[]=[];private indicators!:Phaser.GameObjects.Graphics;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private x=320;private y=310;private facing=2;
  private doors=[{progress:0,open:false},{progress:0,open:false}];
  constructor(){super('elevator');}
  preload(){if(!this.textures.exists('elevator-room'))this.load.image('elevator-room',new URL('../assets/drafts/elevator-lobby-v1.png',import.meta.url).href);}
  create(){
    this.add.image(0,0,'elevator-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    entrances.forEach(e=>{
      const panel=this.add.graphics().setDepth(-80),mask=this.add.graphics().fillStyle(0xffffff).fillRect(e.x,e.y,e.width,e.height);
      this.children.remove(mask);
      if(this.game.renderer.type===Phaser.WEBGL)panel.enableFilters().filters!.external.addMask(mask,false,this.cameras.main).autoUpdate=false;
      else panel.setMask(mask.createGeometryMask());
      this.panels.push(panel);
    });
    this.indicators=this.add.graphics().setDepth(-70);this.actor=new ShopActor(this);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!,clear=()=>this.input.keyboard?.resetKeys();
    const action=(event:KeyboardEvent)=>{if(!this.sys.isActive()||event.repeat||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;if(event.code==='KeyE'){event.preventDefault();this.interact();}};
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.on('sleep',clear);
    this.events.once('shutdown',()=>{window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive()){this.interact();world.focus();}});
    window.__elevatorPreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,nearest:this.nearest(),doors:this.doors.map((d,i)=>({...d,state:this.state(i)})),hand:playerInventory.hand})};
    world.focus();
  }
  private nearest(){return entrances.map((e,index)=>({index,x:e.x+e.width/2,y:e.y+e.height+22})).filter(t=>Math.hypot(this.x-t.x,this.y-t.y)<36).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0]?.index;}
  private state(i:number){const d=this.doors[i];return d.progress<=0?'已关闭':d.progress>=1?'已打开':d.open?'正在打开':'正在关闭';}
  private interact(){const index=this.nearest();if(index===undefined)return;if(sharedAction(`elevator:door-${index}`,'toggle'))return;this.doors[index].open=!this.doors[index].open;}
  private canWalk(x:number,y:number){
    // Cabins are visible scenery only: opening a door never removes this boundary.
    if(x<43||x>597||y<242||y>340)return false;
    if(x>328&&x<390&&y<257)return false;
    if(x<107&&y<264)return false;
    return true;
  }
  private drawDoors(){
    this.indicators.clear();
    entrances.forEach((e,i)=>{
      const art=this.panels[i],half=e.width/2,travel=Math.round(this.doors[i].progress*half);
      art.clear();
      for(const [side,left] of [[0,e.x-travel],[1,e.x+half+travel]]){
        art.fillStyle(0x828e94).fillRect(left,e.y,half,e.height);
        art.fillStyle(0xadb4b8).fillRect(left+3,e.y+2,half-6,e.height-4);
        art.fillStyle(0x909b9f).fillRect(left+half*.52,e.y+2,half*.35,e.height-4);
        art.fillStyle(0xd2d5d4).fillRect(left+6,e.y+2,3,e.height-4);
        art.fillStyle(0x626f77).fillRect(side===0?left+half-2:left,e.y,2,e.height);
        for(let row=13;row<e.height;row+=19)art.fillStyle(0xa0a9ab).fillRect(left+10,e.y+row,Math.max(1,half-23),1);
      }
      // Small pixel indicator in the header, with no extra labels over the scene.
      const center=e.x+half;
      this.indicators.fillStyle(0x202d2d).fillRect(center-10,e.y-16,20,8);
      this.indicators.fillStyle(this.doors[i].open?0xabc887:0xd3b46a).fillRect(center-2,e.y-14,4,4);
    });
  }
  update(_time:number,delta:number){
    if(!this.actor)return;let moving=false;
    const focused=[document.querySelector('.world'),this.game.canvas].includes(document.activeElement);
    if(focused){const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;}}
    this.doors.forEach(d=>{d.progress=Phaser.Math.Clamp(d.progress+(d.open?1:-1)*Math.min(delta,50)/700,0,1);});
    this.drawDoors();this.actor.draw(this.x,this.y,this.facing,moving,delta);
    const index=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=index===undefined;button.textContent=index===undefined?'靠近电梯门':`${this.doors[index].open?'关闭':'打开'} ${index+1} 号电梯`;
    document.querySelector('#mode')!.textContent=moving?'在电梯间走动':'站在电梯间';
    document.querySelector('#hint')!.textContent='靠近电梯按 E 开关门；暂不进入轿厢。';
    document.querySelector('#elevator-state')!.textContent=`1 号 · ${this.state(0)}　2 号 · ${this.state(1)}`;
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=index===undefined?'靠近电梯按 E 开关门':`E · ${button.textContent}`;
  }
}
