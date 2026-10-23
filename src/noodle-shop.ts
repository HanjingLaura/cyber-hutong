import {preloadNoodleArt,decorateNoodleShop} from './noodle-art';
import {bindSceneEvent} from './scene-dom';
import {sceneWalkable} from '../shared/walkability.mjs';
import Phaser from 'phaser';
import {setGuide} from './hud';
import { preloadNoodleFurniture, registerNoodleFurniture } from './noodle-furniture';
import { playerInventory, items, type ItemName } from './player-inventory';
import { registerProductTextures,preloadProductTextures } from './product-textures';
import {restoreWorldFocus} from './world-focus';
import {noodleTables as tables,noodleSeats as seats,noodleSlotPosition,noodleTableReachable} from '../shared/noodle.mjs';
import {setupNoodleTable} from './noodle-table';
import {setupNoodleOrders} from './noodle-orders';
import {sharedAction} from './multiplayer/world-client';

type Dish={name:ItemName;seasoning:string[]};
type Target={kind:'drinks'|'utensils'|'noodles'|'chicken'|'seat'|'table';index:number;x:number;y:number};
const equipment:Target[]=[
  {kind:'drinks',index:0,x:104,y:181},{kind:'utensils',index:0,x:156,y:181},
  {kind:'noodles',index:0,x:280,y:181},{kind:'chicken',index:0,x:476,y:181},
];


declare global {interface Window {__noodlePreview?:{getState:()=>unknown}}}

/** Service counters are painted into the room; seats and food remain interactive sprites. */
export class NoodleShopScene extends Phaser.Scene {
  private actor=false;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private x=320;private y=337;private facing=2;private seated:number|null=null;
  private dishes:(Dish|null)[][]=tables.map(()=>Array(6).fill(null));
  private dishImages:Phaser.GameObjects.Image[][]=[];
  private chairs:Phaser.GameObjects.Image[]=[];
  private toppings!:Phaser.GameObjects.Graphics;
  private message='先拿碗筷';
  private dialog=document.querySelector<HTMLDialogElement>('#noodle-menu')!;
  private tablePanel!:ReturnType<typeof setupNoodleTable>;
  private orderPanel!:ReturnType<typeof setupNoodleOrders>;
  constructor(){super('noodle');}
  preload(){preloadProductTextures(this);preloadNoodleArt(this);
    preloadNoodleFurniture(this);
    const load=(k:string,u:string)=>{if(!this.textures.exists(k))this.load.image(k,u);};
    load('noodle-room-v3',new URL('../assets/drafts/noodle-room-v3.png',import.meta.url).href);
  }
  create(){
    registerProductTextures(this);
    this.add.image(0,0,'noodle-room-v3').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    registerNoodleFurniture(this);
    this.orderPanel=setupNoodleOrders(this,()=>this.nearTable());
    decorateNoodleShop(this,index=>{if(!this.dialog.open&&!this.orderPanel.openNow&&this.nearTable()===index)this.orderPanel.open(index);});
    this.tablePanel=setupNoodleTable(this,()=>({dishes:this.dishes,seated:this.seated}),(t,slot,action,item)=>this.localTableAction(t,slot,action,item),table=>this.orderPanel.open(table));
    tables.forEach((t,index)=>{
      this.add.image(t.x,t.y,'noodle-wood-table').setOrigin(.5,1).setDisplaySize(136,50).setDepth(t.y);
      this.dishImages[index]=Array.from({length:6},(_,slot)=>this.add.image(noodleSlotPosition(index,slot).x,noodleSlotPosition(index,slot).y,'product-noodles').setOrigin(.5,1).setVisible(false).setDepth(t.y+.2).setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(!this.dialog.open&&!this.orderPanel.openNow&&this.nearTable()===index)this.openTable(index,slot);}));
    });
    seats.forEach((s,index)=>{const chair=this.add.image(s.x,s.y+3,'noodle-wood-stool').setOrigin(.5,1).setDisplaySize(24,23).setDepth(s.y+2);
      chair.setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(this.dialog.open||this.orderPanel.openNow)return;if(this.seated===index){this.stand();return;}if(this.seated!==null)return;if(Math.hypot(this.x-s.approach[0],this.y-s.approach[1])>=24){this.message='走近一点';return;}this.sit(index);});this.chairs.push(chair);});
    this.toppings=this.add.graphics().setDepth(265);
    this.actor=true;
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!;
    const action=(event:KeyboardEvent)=>{
      if(!this.sys.isActive()||event.repeat||this.dialog.open||this.orderPanel.openNow||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
      if(event.code==='KeyE'){event.preventDefault();this.interact();}
      if(event.code==='Escape'&&this.seated!==null){event.preventDefault();this.stand();}
      if(event.code==='KeyF'){event.preventDefault();const table=this.nearTable();if(table!==null)this.openTable(table);}
    };
    const clear=()=>this.input.keyboard?.resetKeys();
    window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);
    this.events.once('shutdown',()=>{window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    this.events.on('sleep',()=>{clear();if(this.dialog.open)this.dialog.close();});
    bindSceneEvent(this, document.querySelector('#noodle-close')!, 'click', ()=>this.dialog.close());
    bindSceneEvent(this, this.dialog, 'close', ()=>{clear();if(this.sys.isActive())restoreWorldFocus(this.dialog);});
    bindSceneEvent(this, document.querySelector('#interact')!, 'click', ()=>{if(this.sys.isActive()&&!this.dialog.open&&!this.orderPanel.openNow)this.interact();});
    bindSceneEvent(this, document.querySelector('#table-action')!, 'click', ()=>{if(this.sys.isActive()&&!this.dialog.open&&!this.orderPanel.openNow){const table=this.nearTable();if(table!==null)this.openTable(table);}});
    window.__noodlePreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,seated:this.seated,seats:seats.map((s,index)=>({...s,index,interactive:!!this.chairs[index].input})),equipment,nearest:this.nearest(),hand:playerInventory.hand,tables:this.dishes,seatCount:seats.length,menu:this.dialog.open,message:this.message})};
    world.focus();
  }
  private nearTable(){
    if(this.seated!==null)return seats[this.seated].table;
    const index=tables.findIndex((_t,index)=>noodleTableReachable(index,this.x,this.y));
    return index<0?null:index;
  }
  private nearest():Target|undefined{
    const targets=[...equipment,...seats.map((s,index)=>({kind:'seat' as const,index,x:s.approach[0],y:s.approach[1]})),...tables.map((t,index)=>({kind:'table' as const,index,x:t.x,y:t.y+21}))];
    return targets.filter(t=>Math.hypot(this.x-t.x,this.y-t.y)<(t.kind==='seat'?24:35)).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0];
  }
  private label(target:Target){return {drinks:'打开饮料柜',utensils:'拿碗筷',noodles:'取米线',chicken:'买鸡柳 / 炸鸡',seat:'坐下',table:'桌上物品 / 调料'}[target.kind];}
  private icon(name:ItemName){
    const item=items[name],texture=this.textures.get(item.texture),frame=texture.get(item.frame),source=texture.getSourceImage();
    const canvas=document.createElement('canvas');canvas.width=frame.cutWidth;canvas.height=frame.cutHeight;
    canvas.getContext('2d')!.drawImage(source as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,canvas.width,canvas.height);
    return canvas.toDataURL();
  }
  private menu(title:string,options:{name:string;item?:ItemName;disabled?:boolean;run:()=>void}[]){
    document.querySelector('#noodle-title')!.textContent=title;
    const choices=document.querySelector('#noodle-choices')!;choices.replaceChildren();
    options.forEach(option=>{
      const button=document.createElement('button');button.type='button';button.disabled=!!option.disabled;
      if(option.item){const img=document.createElement('img');img.src=this.icon(option.item);img.alt='';button.append(img);}
      const span=document.createElement('span');span.textContent=option.name;button.append(span);
      button.addEventListener('click',()=>{option.run();this.dialog.close();});choices.append(button);
    });
    document.querySelector('#noodle-menu-hand')!.textContent=`手中：${playerInventory.hand??'空'}`;
    this.input.keyboard?.resetKeys();this.dialog.showModal();
  }
  private take(name:ItemName){if(playerInventory.hand){this.message='手上有东西';return;}const source=name==='碗筷'?'utensils':['可乐','冰红茶'].includes(name)?'drinks':'chicken';if(sharedAction('noodle:'+source,'supply',{item:name}))return;playerInventory.hand=name;playerInventory.noodleSeasoning=[];this.message='';}
  private stand(){if(this.seated===null)return;const s=seats[this.seated];this.x=s.approach[0];this.y=s.approach[1];this.seated=null;this.facing=0;}
  private sit(index:number){const s=seats[index];this.input.keyboard?.resetKeys();this.seated=index;this.x=s.x;this.y=s.y;this.facing=s.facing;this.message='F 物品 · Esc 起身';document.querySelector<HTMLElement>('.world')!.focus();}
  private interact(){
    if(this.seated!==null){this.stand();return;}
    const target=this.nearest();if(!target)return;
    if(target.kind==='seat'){this.sit(target.index);return;}
    if(target.kind==='table'){this.openTable(target.index);return;}
    if(target.kind==='utensils'){this.take('碗筷');return;}
    if(target.kind==='noodles'){
      if(playerInventory.hand!=='碗筷'){this.message='先拿碗筷';return;}
      if(sharedAction('noodle:noodles','supply',{item:'米线'}))return;
      playerInventory.hand='米线';playerInventory.noodleSeasoning=[];this.message='';return;
    }
    const products:ItemName[]=target.kind==='drinks'?['可乐','冰红茶']:['鸡柳','炸鸡'];
    this.menu(target.kind==='drinks'?'饮料柜':'鸡柳大人',products.map(name=>({name,item:name,disabled:!!playerInventory.hand,run:()=>this.take(name)})));
  }
  private openTable(table:number,slot?:number){this.tablePanel.open(table,slot);}
  private localTableAction(table:number,slot:number,action:string,item?:string){
    const dish=this.dishes[table][slot],hand=playerInventory.hand;
    if(action==='put'&&hand&&!dish){this.dishes[table][slot]={name:hand,seasoning:hand==='米线'?[...playerInventory.noodleSeasoning]:[]};playerInventory.hand=null;playerInventory.noodleSeasoning=[];}
    if(action==='take'&&dish&&!hand){playerInventory.hand=dish.name;playerInventory.noodleSeasoning=[...dish.seasoning];this.dishes[table][slot]=null;}
    if(action==='season'&&dish?.name==='米线'&&item&&!dish.seasoning.includes(item))dish.seasoning.push(item);
    if(action==='consume'&&this.seated!==null&&dish)this.dishes[table][slot]=null;
    if(action==='consumeHand'&&this.seated!==null){playerInventory.hand=null;playerInventory.noodleSeasoning=[];}
  }
  private canWalk(x:number,y:number){return sceneWalkable('noodle',x,y);}
  update(_time:number,delta:number){
    if(!this.actor)return;
    this.orderPanel.update();
    let moving=false;
    const focused=document.activeElement===document.querySelector('.world')||document.activeElement===this.game.canvas;
    if(focused&&!this.dialog.open&&!this.orderPanel.openNow&&this.seated===null){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;}
    }
    
    this.toppings.clear();
    this.dishes.forEach((row,index)=>row.forEach((dish,slot)=>{
      const image=this.dishImages[index][slot];image.setVisible(!!dish);if(!dish)return;
      const item=items[dish.name];image.setTexture(item.texture,item.frame).setDisplaySize(item.width,item.height);
      dish.seasoning.forEach((name,i)=>this.toppings.fillStyle(name==='醋'?0x68452f:0xd1aa41).fillRect(image.x-2+i*4,image.y-7,2,2));
    }));
    const target=this.nearest(),table=this.nearTable(),button=document.querySelector<HTMLButtonElement>('#interact')!,tableButton=document.querySelector<HTMLButtonElement>('#table-action')!;
    button.disabled=this.dialog.open||this.orderPanel.openNow||this.seated===null&&!target;button.textContent=this.seated!==null?'起身':target?this.label(target):'';
    tableButton.hidden=table===null;tableButton.disabled=this.dialog.open||this.orderPanel.openNow;tableButton.textContent='桌上物品 / 调料';
    document.querySelector('#mode')!.textContent=this.seated!==null?'坐在米线店':moving?'在米线店走动':'站在米线店';
    document.querySelector('#hint')!.textContent=this.message;
    document.querySelector('#noodle-hand')!.textContent=`手中：${playerInventory.hand??'空'}`;
    setGuide('WASD / 方向键移动',this.seated!==null?'E / Esc 起身 · F 桌上物品':target?`E · ${this.label(target)}`:'');
  }
}
