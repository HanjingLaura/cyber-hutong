import {sceneWalkable} from '../shared/walkability.mjs';
import Phaser from 'phaser';
import { preloadGuest, placeGuest, guestBlocks } from './easter-eggs';
import geometry from '../shared/interactions.json';
import { registerRegions } from './frames';
import { playerInventory } from './player-inventory';

// Three rows, two blocks of three, with a clear central and side aisle.
const seats=Object.entries(geometry.concert.seats).map(([id,s])=>({id,x:s.at[0],y:s.at[1],approachY:s.approach[1],row:id.charCodeAt(0)-65,column:Number(id[1])-1}));
declare global { interface Window { __concertPreview?: { getState: () => unknown } } }
export class ConcertScene extends Phaser.Scene {
  private actor=false;
  private backs:Phaser.GameObjects.Image[]=[];
  private chairs:Phaser.GameObjects.Image[]=[];
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private x=320;
  private y=340;
  private facing=2;
  private seated:number|null=null;
  constructor(){super('concert');}
  preload(){
    preloadGuest(this,'zhu');
    const load=(k:string,u:string)=>{if(!this.textures.exists(k))this.load.image(k,u);};
    load('concert-room',new URL('../assets/drafts/concert-room-v4.png',import.meta.url).href);
    load('concert-chair',new URL('../assets/drafts/concert-chair-v1.png',import.meta.url).href);
  }
  create(){
    placeGuest(this,'zhu');
    const texture=this.textures.get('concert-room'),source=texture.getSourceImage() as HTMLImageElement;
    const stageHeight=Math.round(source.height*.557);
    if(!texture.has('stage'))texture.add('stage',0,0,0,source.width,stageHeight);
    if(!texture.has('floor'))texture.add('floor',0,0,stageHeight,source.width,source.height-stageHeight);
    this.add.image(0,0,'concert-room','stage').setOrigin(0).setDisplaySize(640,154).setDepth(-100);
    this.add.image(0,154,'concert-room','floor').setOrigin(0).setDisplaySize(640,206).setDepth(-100);
    const [chair]=registerRegions(this,'concert-chair',[{name:'chair',x0:0,y0:0,x1:1,y1:1}]);
    // A crop of the SAME sprite provides the foreground backrest, so its edges
    // and pixel scale always match the complete chair, rather than separate art.
    const backHeight=Math.round(chair.height*.60);
    if(!this.textures.get('concert-chair').has('backrest'))this.textures.get('concert-chair').add('backrest',0,chair.x,chair.y,chair.width,backHeight);
    seats.forEach(seat=>{
      const height=[36,42,48][seat.row],width=[24,28,32][seat.row],foot=seat.y+10,top=foot-height;
      this.add.ellipse(seat.x,foot-1,width+10,8,0x111324,.6).setDepth(-90);
      this.chairs.push(this.add.image(seat.x,foot,'concert-chair','chair').setOrigin(.5,1).setDisplaySize(width,height).setDepth(foot));
      this.backs.push(this.add.image(seat.x,top,'concert-chair','backrest').setOrigin(.5,0)
        .setDisplaySize(width,height*backHeight/chair.height).setDepth(seat.y+2).setVisible(true));
    });
    this.actor=true;
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!;
    const action=(event:KeyboardEvent)=>{
      if(!this.sys.isActive()||event.repeat||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(event.code==='KeyE'){event.preventDefault();this.interact();}
      if(event.code==='Escape'&&this.seated!==null){event.preventDefault();this.stand();}
    };
    const clear=()=>this.input.keyboard?.resetKeys();
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.once('shutdown',()=>{window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    this.events.on('sleep',clear);
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive())this.interact();});
    window.__concertPreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,seated:this.seated===null?null:seats[this.seated].id,nearest:this.nearest()?.id,seatCount:seats.length,rows:3,seats,hand:playerInventory.hand})};
    world.focus();
  }
  private nearest(){
    if(this.seated!==null)return;
    return seats.filter(s=>Math.abs(this.y-s.approachY)<19&&Math.hypot(this.x-s.x,this.y-s.approachY)<25)
      .sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.approachY)-Math.hypot(this.x-b.x,this.y-b.approachY))[0];
  }
  private stand(){
    if(this.seated===null)return;
    const seat=seats[this.seated];this.seated=null;this.x=seat.x;this.y=seat.approachY;this.facing=2;
  }
  private interact(){
    if(this.seated!==null){this.stand();return;}
    const seat=this.nearest();if(!seat)return;
    this.seated=seats.indexOf(seat);this.x=seat.x;this.y=seat.y;this.facing=2;
  }
  private canWalk(x:number,y:number){return !guestBlocks('zhu',x,y)&&sceneWalkable('concert',x,y);}
  update(_time:number,delta:number){
    if(!this.actor)return;
    let moving=false;
    const focused=document.activeElement===document.querySelector('.world')||document.activeElement===this.game.canvas;
    if(focused&&this.seated===null){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
      const dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){
        const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;
        if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;
        if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;
        this.facing=dx?dx>0?1:3:dy>0?0:2;moving=ox!==this.x||oy!==this.y;
      }
    }
    
    this.backs.forEach((image,i)=>image.setVisible(true).setDepth(seats[i].y+2));
    this.chairs.forEach((image,i)=>image.setDepth(this.seated===i?seats[i].y-1:seats[i].y+10));
    const seat=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=this.seated===null&&!seat;
    button.textContent=this.seated!==null?'离开座位':seat?`坐到 ${seat.id}`:'';
    document.querySelector('#mode')!.textContent='';
    document.querySelector('#hint')!.textContent=this.seated!==null?'Esc 起身':'E 坐下';
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=this.seated!==null?'E / Esc 起身':seat?`E 坐下`:'E 坐下';
    document.querySelector('#concert-state')!.textContent=this.seated===null?'A / B / C ':'';
  }
}
