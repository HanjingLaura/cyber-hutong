import Phaser from 'phaser';
import { ShopActor } from './shop-actor';
import { playerInventory, type ItemName } from './player-inventory';
import { PerlerBoard, BEAD_COLORS } from './perler-board';
import { registerFrames } from './frames';
import {sharedAction} from './multiplayer/world-client';

const tableRows=[144,250];
const seats=Array.from({length:8},(_,i)=>({x:[184,268,356,446][i%4],y:i<4?220:326,approach:i<4?232:338}));
type Target={kind:'seat'|'iron'|'gallery'|'stash';x:number;y:number;index:number};
const targets:Target[]=[...seats.map((s,index)=>({kind:'seat' as const,x:s.x,y:s.approach,index})),{kind:'iron',x:560,y:170,index:0},{kind:'gallery',x:551,y:307,index:0},{kind:'stash',x:91,y:319,index:0}];
declare global{interface Window{__perlerPreview?:{getState:()=>unknown}}}

export class PerlerShopScene extends Phaser.Scene{
  private actor!:ShopActor;private workshop!:PerlerBoard;private boardArt:Phaser.GameObjects.Graphics[]=[];
  private chairs:Phaser.GameObjects.Image[]=[];
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private x=320;private y=335;private facing=2;private seated:number|null=null;private lastSeat=4;
  private returnPoint={x:320,y:335};private stored:{name:ItemName;seasoning:string[]}|null=null;
  private message='靠近圆凳按 E 拼豆，右上方是熨烫台。';
  constructor(){super('perler');}
  preload(){const load=(k:string,u:string)=>{if(!this.textures.exists(k))this.load.image(k,u);};load('perler-room-v2',new URL('../assets/drafts/perler-shop-v2.png',import.meta.url).href);load('perler-furniture-v2',new URL('../assets/drafts/perler-furniture-v2.png',import.meta.url).href);}
  create(){
    this.add.image(0,0,'perler-room-v2').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    const furniture=registerFrames(this,'perler-furniture-v2',2,1,false,{x:[0,.8,1],y:[0,1]});
    for(const top of tableRows){
      this.add.image(320,top,'perler-furniture-v2',furniture[0].name).setOrigin(.5,0).setDisplaySize(360,60).setDepth(top+61);
      this.boardArt.push(this.add.graphics().setDepth(top+61.5));
    }
    seats.forEach((seat,index)=>{
      const chair=this.add.image(seat.x,seat.y,'perler-furniture-v2',furniture[1].name).setOrigin(.5,1).setDisplaySize(30,34).setDepth(seat.y);
      chair.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
        if(this.workshop.dialog.open)return;
        if(this.seated===index){this.stand();return;}
        if(this.seated!==null)return;
        if(Math.hypot(this.x-seat.x,this.y-seat.approach)>=27){this.message='走近这把凳子再坐下。';return;}
        this.sit(index);
      });this.chairs.push(chair);
    });
    this.actor=new ShopActor(this);
    this.workshop=new PerlerBoard(()=>this.drawBoards());this.drawBoards();
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!,clear=()=>this.input.keyboard?.resetKeys();
    const action=(event:KeyboardEvent)=>{
      if(!this.sys.isActive()||event.repeat||this.workshop.dialog.open||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(event.code==='KeyE'){event.preventDefault();this.interact();}
      if(event.code==='Escape'&&this.seated!==null){event.preventDefault();this.stand();}
      if(event.code==='KeyF'&&this.seated!==null){event.preventDefault();this.workshop.open(this.seated);}
    };
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.once('shutdown',()=>{this.workshop.dispose();window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    this.events.on('sleep',()=>{clear();this.workshop.close();if(this.seated!==null)this.stand();});
    this.workshop.dialog.addEventListener('close',()=>{clear();if(this.seated!==null)this.stand();});
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive()&&!this.workshop.dialog.open)this.interact();});
    document.querySelector('#perler-continue')!.addEventListener('click',()=>{if(this.sys.isActive()&&this.seated!==null)this.workshop.open(this.seated);});
    window.__perlerPreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,seated:this.seated,seats:seats.map((s,index)=>({...s,index,interactive:!!this.chairs[index].input})),nearest:this.nearest(),hand:playerInventory.hand,stored:this.stored,workshop:this.workshop.getState(),message:this.message})};world.focus();
  }
  private nearest(){return targets.filter(t=>Math.hypot(this.x-t.x,this.y-t.y)<27).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0];}
  private stand(){this.seated=null;this.x=this.returnPoint.x;this.y=this.returnPoint.y;this.facing=0;this.message='作品仍在这张底板上，下次可以继续。';}
  private sit(index:number){
    if(playerInventory.hand){this.message='拼豆需要空手，先存到左下方储物格。';return;}
    this.input.keyboard?.resetKeys();this.returnPoint={x:this.x,y:this.y};this.seated=index;this.lastSeat=index;
    this.x=seats[index].x;this.y=seats[index].y-4;this.facing=2;
    this.message='E / Esc 结束拼豆。';
    this.workshop.open(index);
  }
  private interact(){
    if(this.seated!==null){this.stand();return;}
    const t=this.nearest();if(!t)return;
    if(t.kind==='stash'){
      if(sharedAction('perler:stash',playerInventory.hand?'put':'take',{slot:0}))return;
      if(playerInventory.hand){if(this.stored){this.message='先拿回储物格里的物品。';return;}this.stored={name:playerInventory.hand,seasoning:[...playerInventory.noodleSeasoning]};playerInventory.hand=null;this.message='物品存好了。';}
      else if(this.stored){playerInventory.hand=this.stored.name;playerInventory.noodleSeasoning=[...this.stored.seasoning];this.stored=null;this.message='拿回了物品。';}
      else this.message='可以暂存手中物品，再去拼豆。';return;
    }
    if(t.kind==='gallery'){this.workshop.open(this.lastSeat,true);return;}
    if(playerInventory.hand){this.message='拼豆和熨烫需要空手，先存到左下方储物格。';return;}
    this.input.keyboard?.resetKeys();
    if(t.kind==='iron'){this.workshop.open(this.lastSeat);this.message='在熨烫台处理刚才的底板。';return;}
    this.sit(t.index);
  }
  private canWalk(x:number,y:number){
    if(x<35+(350-y)*.025||x>605-(350-y)*.025||y<124||y>341)return false;
    if(x>126&&x<514&&tableRows.some(top=>y>top-8&&y<top+68))return false;
    if(seats.some(s=>Math.abs(x-s.x)<22&&Math.abs(y-s.y)<6))return false;
    if(x>527&&y<168)return false; // ironing cabinet, including sprite-width clearance
    if(x<81&&y>230&&y<317)return false; // storage cabinet
    if(x>565&&y>246&&y<327)return false; // display easel
    if(x<70&&y<131)return false; // planter and side bench
    return true;
  }
  private drawBoards(){
    this.boardArt.forEach(art=>art.clear());
    seats.forEach((s,index)=>{const left=s.x-27,top=tableRows[index<4?0:1]+3;const cells=this.workshop.cellsAt(index),art=this.boardArt[index<4?0:1];
      art.fillStyle(0x9c8a68).fillRect(left-1,top-1,27,23).fillStyle(0xf5eee0).fillRect(left,top,25,21);
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)art.fillStyle(0xb8b0a0).fillRect(Math.round(left+3+x*1.2),Math.round(top+2+y*1.05),.65,.65);
      art.fillStyle(0x6a6557).fillRect(s.x+5,top,16,22);
      for(let row=0;row<3;row++)for(let col=0;col<2;col++)art.fillStyle(Phaser.Display.Color.HexStringToColor(BEAD_COLORS[(index*3+row*2+col)%BEAD_COLORS.length]).color).fillRect(s.x+7+col*6,top+2+row*6,5,5);
      cells.forEach((color,i)=>{if(color<0)return;art.fillStyle(Phaser.Display.Color.HexStringToColor(BEAD_COLORS[color]).color).fillRect(Math.round(left+3+i%16*1.2),Math.round(top+2+Math.floor(i/16)*1.05),1.3,1.1);});
    });
  }
  update(_time:number,delta:number){
    if(!this.actor)return;let moving=false;
    const focused=[document.querySelector('.world'),this.game.canvas].includes(document.activeElement);
    if(this.seated===null&&!this.workshop.dialog.open&&focused){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;}
    }
    this.actor.draw(this.x,this.y,this.facing,moving,delta,this.seated!==null,this.y+(this.seated!==null?6:1),this.seated!==null?54:undefined,0,this.seated!==null?(this.seated<4?190:296):undefined);
    const t=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=this.workshop.dialog.open||this.seated===null&&!t;
    button.textContent=this.seated!==null?'起身':t?{seat:'坐下拼豆',iron:'使用熨烫台',gallery:'查看作品',stash:'存放 / 拿回物品'}[t.kind]:'靠近圆凳或熨烫台';
    document.querySelector('#mode')!.textContent=this.seated!==null?'坐着拼豆':moving?'在拼豆店走动':'站在拼豆店';
    document.querySelector('#hint')!.textContent=this.message;
    document.querySelector('#perler-hand')!.textContent=`手中：${playerInventory.hand??'空'} · 储物格：${this.stored?.name??'空'}`;
    document.querySelector('#perler-count')!.textContent=`作品 ${this.workshop.works.length} 件 · 八张独立底板`;
    (document.querySelector('#perler-continue') as HTMLButtonElement).hidden=this.seated===null;
    document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=this.seated!==null?'E / Esc 结束拼豆':t?`E · ${button.textContent}`:'靠近圆凳按 E 拼豆';
  }
}
