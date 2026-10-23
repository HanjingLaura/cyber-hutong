import {bindSceneEvent} from './scene-dom';
import {restoreWorldFocus} from './world-focus';
import {sceneWalkable} from '../shared/walkability.mjs';
import {gachaImages,gachaNames,gachaItems,registerGachaTextures} from './gacha-assets';
import {playerInventory,type ItemName} from './player-inventory';
import Phaser from 'phaser';
import {setGuide} from './hud';
import { preloadGuest, placeGuest, guestBlocks } from './easter-eggs';
import { gacha } from './gacha';
import {onlineWorld} from './multiplayer/world-client';
import { registerRegions } from './frames';
import { blindBoxes, type Theme, toyNames, toyImage, type ToyRecord } from './blind-box';

type Source = 'shelf' | 'machine';
const shopFloor=new Phaser.Geom.Polygon([200,150,237.5,150,237.5,287.5,405,287.5,405,150,460,150,550,305,415,310,415,345,225,345,225,310,85,305]);
declare global { interface Window { __popPreview?: { getState: () => unknown } } }
export class PopMartScene extends Phaser.Scene {
  private actor=false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private x = 320; private y = 316; private facing = 2;
  private source: Source = 'shelf';
  private theme: Theme = 'all';
  private selected: number | null = null;
  private busy = false;
  private menuRevision=0;
  private requestCurrent?:()=>boolean;
  private boxImages: string[] = [];
  private machineArt!:HTMLImageElement;
  private gachaImages:string[]=[];
  private capsule:'idle'|'spinning'|'ready'|'opened'='idle';
  private capsuleToy=0;
  private spinStarted=0;
  private revealTimer?: ReturnType<typeof setTimeout>;
  private targets = [{ id: 'shelf' as Source, name: '陈列台', x: 320, y: 290 }, { id: 'machine' as Source, name: '扭蛋机', x: 438, y: 162 }];
  constructor() { super('pop'); }
  preload() {
    preloadGuest(this,'buzz');
    const load=(key:string,url:string)=>{if(!this.textures.exists(key))this.load.image(key,url);};
    load('pop-room', new URL('../assets/drafts/popmart-store-v3.png', import.meta.url).href);
    load('pop-stand', new URL('../assets/drafts/popmart-stand-v2.png', import.meta.url).href);
    load('pop-props', new URL('../assets/drafts/popmart-props-v1.png', import.meta.url).href);
    load('pop-boxes', new URL('../assets/props/blind-box-packaging.png', import.meta.url).href);
    load('pop-machine', new URL('../assets/props/capsule-machine.png', import.meta.url).href);
  }
  private get menu() { return document.querySelector<HTMLDialogElement>('#blind-menu')!; }
  // The shelf is a 160px island, so measure to its edge rather than its centre; matches server/world.mjs checkNear.
  private reach(t:{id:Source;x:number;y:number}) { return t.id==='shelf' ? Math.hypot(Math.max(240-this.x,0,this.x-400),Math.max(171-this.y,0,this.y-283)) : Math.hypot(t.x-this.x,t.y-this.y); }
  // The exit sits right in front of the shelf: facing the shelf means E opens it, otherwise E leaves.
  prefersInteraction() { return this.facing===2 && this.nearest()?.id==='shelf'; }
  private nearest() { return this.targets.filter(t => this.reach(t) < (t.id==='shelf'?36:39)).sort((a,b) => this.reach(a) - this.reach(b))[0]; }
  create() {
    placeGuest(this,'buzz');
    this.add.image(0,0,'pop-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    // Only the display silhouette occludes people; a rectangular background
    // crop also painted the aisle over their feet.
    if(!this.textures.exists('pop-island-occluder')){
      const texture=this.textures.createCanvas('pop-island-occluder',306,274)!;
      const ctx=texture.context;
      const outline=[[0,274],[300,274],[300,213],[290,114],[280,72],[233,72],[233,48],[218,41],[202,20],[165,0],[132,0],[108,9],[88,37],[95,48],[68,44],[61,63],[60,74],[28,74],[23,114],[11,114]];
      ctx.save();ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
      ctx.drawImage(this.textures.get('pop-room').getSourceImage() as HTMLImageElement,488,282,306,274,0,0,306,274);ctx.restore();texture.refresh();
    }
    this.add.image(244,141,'pop-island-occluder').setOrigin(0).setDisplaySize(153,137).setDepth(278);
    registerRegions(this, 'pop-props', [{name:'display',x0:0,y0:0,x1:.65,y1:1},{name:'machine',x0:.65,y0:0,x1:1,y1:1}]);
    registerRegions(this, 'pop-stand', [{name:'stand',x0:0,y0:0,x1:1,y1:1}]);
    const thumbs = (key: string, frames: {x:number;y:number;width:number;height:number}[]) => frames.map(frame => {
      const canvas=document.createElement('canvas'); canvas.width=frame.width; canvas.height=frame.height;
      canvas.getContext('2d')!.drawImage(this.textures.get(key).getSourceImage() as HTMLImageElement,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height);
      return canvas.toDataURL();
    });
    this.machineArt=new Image();
    this.machineArt.src=thumbs('pop-machine',[{x:0,y:0,width:82,height:190}])[0];
    void this.loadGacha();
    this.boxImages=thumbs('pop-boxes',[0,1,2].map(index=>({x:index*48,y:0,width:48,height:64})));
    this.actor=true;
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    const world = document.querySelector<HTMLElement>('.world')!;
    const action = (event: KeyboardEvent) => {
      if (!this.sys.isActive() || event.repeat) return;
      if (this.menu.open) {
        if (event.code === 'KeyE') { event.preventDefault(); this.extract(); }
        return;
      }
      if (document.activeElement !== world && document.activeElement !== this.game.canvas) return;
      if (event.code === 'KeyE') { event.preventDefault(); const target = this.nearest(); if (target) this.open(target.id); }
    };
    window.addEventListener('keydown', action);
    const clear = () => this.input.keyboard?.resetKeys();
    world.addEventListener('blur', clear); window.addEventListener('blur', clear);
    this.events.once('shutdown', () => { this.invalidateMenu();window.removeEventListener('keydown',action); world.removeEventListener('blur',clear); window.removeEventListener('blur',clear); });
    bindSceneEvent(this, document.querySelector('#interact')!, 'click', () => { if (!this.sys.isActive()) return; const target = this.nearest(); if (target) this.open(target.id); });
    bindSceneEvent(this, document.querySelector('#blind-close')!, 'click', () => this.menu.close());
    bindSceneEvent(this, document.querySelector('#blind-extract')!, 'click', () => this.extract());
    bindSceneEvent(this, document.querySelector('#blind-refill')!, 'click', () => { if (this.busy) return;const service=onlineWorld(),current=this.menuContext();if(service?.bridge.user?.role){void service.action('pop:'+this.theme,'refill').then(()=>{if(current())this.render();}).catch(e=>{if(current())service.notice(e.message);});return;}blindBoxes.refill(this.source,this.theme); this.selected=null; this.render(); });
    this.menu.addEventListener('cancel', event => { if(this.busy) event.preventDefault(); });
    bindSceneEvent(this, this.menu, 'close', () => { this.invalidateMenu();clear(); restoreWorldFocus(this.menu); });
    this.events.on('sleep', () => { clear();this.invalidateMenu();if(this.menu.open) this.menu.close(); });
    window.__popPreview = { getState: () => ({ ready:true, active:this.sys.isActive(),x:this.x,y:this.y,nearest:this.nearest()?.id,selected:this.selected,busy:this.busy,open:this.menu.open,source:this.source,theme:this.theme,remaining:blindBoxes.stock(this.source,this.theme).filter(t=>t!==null).length,capsule:this.capsule,gachaCounts:[...gacha.counts],collection:blindBoxes.data.collection.map(r=>({...r,name:toyNames[r.toy]})) }) };
    this.renderCollection(); world.focus();
  }
  private async loadGacha(){
    try{const images=await gachaImages();if(!this.sys.game)return;this.gachaImages=images;registerGachaTextures(this);this.renderCollection();if(this.menu?.open)this.render();}
    catch{onlineWorld()?.notice('玩具图片未载入，重新打开面板可重试');}
  }
  private open(source: Source) {
    this.invalidateMenu();
    if(!this.gachaImages.length)void this.loadGacha();
    this.source=source; this.selected=null; this.input.keyboard?.resetKeys();
    document.querySelector('#blind-result')!.replaceChildren();
    if(source==='machine'&&this.capsule==='opened')this.capsule='idle';
    this.render(); this.menu.showModal();
  }
  private invalidateMenu(){this.menuRevision++;if(this.revealTimer)clearTimeout(this.revealTimer);this.revealTimer=undefined;this.requestCurrent=undefined;this.busy=false;this.capsule='idle';}
  private menuContext(){
    const revision=this.menuRevision,service=onlineWorld(),account=service?.bridge.user?.id,scene=service?.bridge.active,epoch=service?.epoch,authenticated=!!service?.bridge.user?.role;
    return ()=>revision===this.menuRevision&&this.menu.open&&this.sys.isActive()&&onlineWorld()===service&&service?.bridge.user?.id===account&&service?.bridge.active===scene&&service?.epoch===epoch&&(!authenticated||!!(service?.bridge.connected&&service.bridge.controller));
  }
  private render() {
    document.querySelector('#blind-title')!.textContent=this.source==='machine' ? '扭蛋机' : '挑一盒';
    this.menu.dataset.source=this.source;
    this.menu.dataset.theme=this.theme;
    document.querySelector<HTMLElement>('#blind-themes')!.hidden=true;
    document.querySelector<HTMLElement>('.blind-glass')!.hidden=this.source==='machine';
    const machine=document.querySelector<HTMLElement>('#blind-machine-art')!;
    machine.hidden=this.source!=='machine';
    if(this.source==='machine')this.drawGacha();
    const list=document.querySelector('#blind-boxes')!;
    list.innerHTML=blindBoxes.stock(this.source,this.theme).map((toy,i)=>`<button type="button" class="blind-slot" data-box="${i}" aria-pressed="${this.selected===i}" ${toy===null || this.busy?'disabled':''} aria-label="${String.fromCharCode(65+Math.floor(i/6))}${i%6+1}${toy===null?' 已取走':''}">${toy===null?'<span class="sold-box"></span>':`<img class="box-art" alt="未拆封盲盒" src="${this.boxImages[i%3]}"/>`}<span>${String.fromCharCode(65+Math.floor(i/6))}${i%6+1}</span></button>`).join('');
    list.querySelectorAll<HTMLButtonElement>('[data-box]').forEach(button=>button.addEventListener('click',()=>{
      if(this.busy) return; this.selected=Number(button.dataset.box); document.querySelector('#blind-result')!.replaceChildren(); this.render();
    }));
    const extract=document.querySelector<HTMLButtonElement>('#blind-extract')!;
    extract.disabled=this.busy||(this.source==='shelf'&&this.selected===null);
    extract.textContent=this.busy?'…':this.source==='machine'?(this.capsule==='ready'?'打开扭蛋':'转动'):this.selected===null?'选一盒':'拆开';
    document.querySelector<HTMLButtonElement>('#blind-close')!.disabled=this.busy;
    document.querySelector<HTMLButtonElement>('#blind-refill')!.disabled=this.busy;
    document.querySelector<HTMLElement>('#blind-help')!.hidden=true;
  }
  private extract() {
    if(!this.sys.isActive() || !this.menu.open || this.busy) return;
    if(this.source==='machine'){this.extractCapsule();return;}
    if(this.selected===null)return;
    const service=onlineWorld();
    const current=this.menuContext();
    this.requestCurrent=current;
    if(service?.bridge.user?.role){this.busy=true;this.render();void service.action('pop:'+this.theme,'draw',{slot:this.selected}).then(data=>{if(!current())return;this.busy=false;this.selected=null;this.render();const record=data.progress.filter((p:any)=>p.kind==='toy').at(-1)?.data;if(record)this.result(record);this.renderCollection();}).catch(e=>{if(!current())return;this.busy=false;this.render();service.notice(e.message);});return;}
    const record=blindBoxes.take(this.source,this.theme,this.selected); if(!record) return;
    this.busy=true; this.render();
    document.querySelector('#blind-result')!.innerHTML='<p class="opening-box">…</p>';
    this.revealTimer=setTimeout(()=>{
      if(!current())return;
      this.busy=false; this.selected=null;
      this.render(); this.result(record); this.renderCollection();
    },750);
    this.events.once('shutdown',()=>{if(this.revealTimer)clearTimeout(this.revealTimer);});
  }
  private result(record: ToyRecord) {
    const result=document.querySelector('#blind-result')!;
    const name=toyNames[record.toy];result.innerHTML=`<div class="blind-reveal"><img alt="${name}" src="${toyImage(record.toy)}"/><div><strong>${name}</strong></div></div>`;
  }
  private extractCapsule(){
    const result=document.querySelector('#blind-result')!;
    if(this.capsule==='ready'){
      this.capsule='opened';
      if(!onlineWorld()?.bridge.user?.role)playerInventory.hand=gachaItems[this.capsuleToy] as ItemName;
      result.innerHTML=`<img alt="${gachaNames[this.capsuleToy]}" src="${this.gachaImages[this.capsuleToy]}"/><strong>${gachaNames[this.capsuleToy]}</strong>`;
      this.render();return;
    }
    const service=onlineWorld();
    if(playerInventory.hand){if(service)service.notice('手上有东西');else result.textContent='手上有东西';return;}
    const current=this.menuContext();
    this.requestCurrent=current;
    if(service?.bridge.user?.role){this.busy=true;this.capsule='spinning';this.spinStarted=Date.now();this.render();void service.action('pop:classic','gacha').then(data=>{if(!current())return;this.capsuleToy=data.progress.filter((p:any)=>p.kind==='gacha').at(-1)?.data.toy??0;this.busy=false;this.capsule='ready';this.render();this.renderCollection();}).catch(e=>{if(!current())return;this.busy=false;this.capsule='idle';this.render();service.notice(e.message);});return;}
    this.busy=true;this.capsule='spinning';this.spinStarted=Date.now();
    result.replaceChildren();this.render();
    this.revealTimer=setTimeout(()=>{
      if(!current())return;
      this.capsuleToy=gacha.draw();gacha.collect(this.capsuleToy);
      this.busy=false;this.capsule='ready';this.render();this.renderCollection();
    },950);
  }
  private drawGacha(){
    const canvas=document.querySelector<HTMLCanvasElement>('#gacha-art')!,ctx=canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,82,190);
    if(this.machineArt.complete&&this.machineArt.naturalWidth)ctx.drawImage(this.machineArt,0,0);
    // Animation anchors belong to the standalone 82x190 machine sprite.
    const rect=(color:string,x:number,y:number,w:number,h:number)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    const phase=this.capsule==='spinning'?Math.floor((Date.now()-this.spinStarted)/90)%4:0;
    if(this.capsule==='spinning'){
      rect('#f1ddbd',14,116,20,23);rect('#53515b',17,119,14,17);
      if(phase%2===0)rect('#dce2dc',23,119,3,17);else rect('#dce2dc',17,126,14,3);
      rect('#9695a1',23,126,3,3);
    }
    if(this.capsule==='spinning'||this.capsule==='ready'){
      const elapsed=Date.now()-this.spinStarted;
      if(this.capsule==='spinning'&&elapsed<450)return;
      const fall=this.capsule==='spinning'?Math.min(1,(elapsed-450)/500):1;
      const y=Math.round(119+fall*fall*39),x=47;
      ctx.save();ctx.beginPath();ctx.rect(44,142,25,34);ctx.clip();
      rect('#34323e',x-1,y+3,20,12);rect('#34323e',x+2,y,14,18);
      rect('#e99bb7',x+2,y+2,14,7);rect('#f3c6d6',x+4,y+2,6,3);
      rect('#b6d0d4',x+2,y+10,14,6);rect('#e5eeee',x+4,y+10,5,3);
      rect('#6a687d',x+1,y+8,16,2);
      ctx.restore();
    }
  }
  private renderCollection() {
    const records=blindBoxes.data.collection;
    const owned=(toy:number)=>records.filter(r=>r.toy===toy).length;
    document.querySelector('#pop-count')!.textContent=`${new Set(records.map(r=>r.toy)).size} / ${toyNames.length}`;
    document.querySelector('#pop-collection')!.innerHTML=toyNames.map((name,toy)=>{const n=owned(toy);return `<div class="lineup-toy${n?'':' locked'}" title="${name}"><img alt="${name}" src="${toyImage(toy)}"/>${n>1?`<b>×${n}</b>`:''}</div>`;}).join('');
    document.querySelector('#pop-legacy')!.textContent='';
  }
  private canWalk(x:number,y:number){return !guestBlocks('buzz',x,y)&&sceneWalkable('pop',x,y);}
  update(_time:number,delta:number) {
    if(!this.actor)return;
    if(this.menu.open&&this.busy&&this.requestCurrent&&!this.requestCurrent()){this.invalidateMenu();this.menu.close();}
    if(this.menu.open&&this.source==='machine')this.drawGacha();
    const focused=document.activeElement===document.querySelector('.world')||document.activeElement===this.game.canvas;
    let moving=false;
    if(focused&&!this.menu.open){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
      const dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){
        const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy), ox=this.x,oy=this.y;
        if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;
        if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;
        this.facing=dx?dx>0?1:3:dy>0?0:2; moving=ox!==this.x||oy!==this.y;
      }
    }
    
    const target=this.nearest(), button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=!target; button.textContent=target?target.id==='machine'?'转动扭蛋机':'挑选陈列台盲盒':'';
    document.querySelector('#mode')!.textContent='';
    document.querySelector('#hint')!.textContent=target?.id==='machine'?'E 扭蛋':target?'E 挑一盒':'';
    setGuide('WASD / 方向键移动',target?`E · ${target.id==='machine'?'扭蛋机':'挑一盒'}`:'');
  }
}
