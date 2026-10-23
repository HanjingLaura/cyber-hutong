import './game.css';
import {characterRegistry,characterImage} from '../character-assets';
import {scenes,members,memberName,type Member} from './scenes';
import {clampCamera,worldPoint,dragCamera} from './camera.mjs';
import {createRound,startRound,tickRound,shoot,visibleHit} from './rules.mjs';
import {restoreWorldFocus} from '../world-focus';

const W=1280,H=720;
const load=(url:string)=>{const im=new Image();im.src=url;return im.decode().then(()=>im);};

/** One reusable round surface for both the arcade cabinet and direct preview. */
export class TTCGame {
 readonly dialog=document.createElement('dialog');
 private role:Member='cora';
 private sceneIndex=1;
 private camera=0;
 private revision=0;
 private drag:{id:number;x:number;y:number;camera:number;moved:boolean}|null=null;
 private get scene(){return scenes[this.sceneIndex];}
 private get targets(){return this.scene.targets;}
 private get name(){return memberName(this.role);}
 private canvas:HTMLCanvasElement;
 private ctx:CanvasRenderingContext2D;
 private world=document.createElement('canvas');
 private sprite=document.createElement('canvas');
 private round=createRound();
 private aim={x:W/2,y:H/2};
 private zoom=false;
 private heldZoom=false;
 private hintUntil=0;
 private hintTarget=-1;
 private hinted=false;
 private feedbackUntil=0;
 private feedback='';
 private raf=0;
 private ready=false;
 private loading:Promise<void>|null=null;
 private bg:HTMLImageElement|null=null;
 private alpha:Uint8ClampedArray|null=null;
 private controls=new AbortController();
 private lastStatus='';
 private opener:HTMLElement|null=null;
 constructor(){
  this.dialog.className='ttc-game';
  this.dialog.setAttribute('aria-labelledby','ttc-title');
  this.dialog.innerHTML=`<div class="ttc-layout">
   <header class="ttc-header"><div><h2 id="ttc-title">击倒TTC</h2><span class="ttc-scene-name">${this.scene.name}</span></div>
    <div class="ttc-target"><canvas width="72" height="72" aria-label="Cora 的头像"></canvas><div><span>本局目标</span><strong><b class="ttc-member-name">${this.name}</b> <small>0 / ${this.targets.length}</small></strong></div></div>
    <div class="ttc-clock"><span>剩余时间</span><strong>60<span>秒</span></strong></div>
    <button type="button" data-action="close" aria-label="退出游戏">退出</button>
   </header>
   <div class="ttc-picker"><label>寻找 <select aria-label="选择人物">${members.map(id=>`<option value="${id}">${memberName(id)}</option>`).join('')}</select></label><label>场景 <select aria-label="选择场景">${scenes.map((scene,i)=>`<option value="${i}" ${i===this.sceneIndex?'selected':''}>${scene.name}</option>`).join('')}</select></label><span>换人物或场景将重新开始</span></div>
   <div class="ttc-stage"><canvas class="ttc-scene" width="1280" height="720" tabindex="0" aria-label="左右拖动画面，A、D 移动视野，方向键移动准星，空格放大，回车射击。"></canvas>
    <div class="ttc-notice" role="status" aria-live="polite"><strong>找齐 ${this.targets.length} 个 Cora</strong><p>拖动画面找齐目标，放大对照头像。打空扣 3 秒。</p><button type="button" data-action="start" disabled>正在加载…</button></div>
    <p class="ttc-feedback" role="status" aria-live="polite"></p>
   </div>
   <div class="ttc-pan"><button type="button" data-action="left" aria-label="向左看">向左看</button><input type="range" min="0" max="880" value="0" step="1" aria-label="移动视野"><button type="button" data-action="right" aria-label="向右看">向右看</button></div>
   <footer class="ttc-footer"><p class="ttc-help">拖动画面 · 点击射击 · 空格放大</p><div class="ttc-actions">
    <button type="button" data-action="hint" disabled>提示一次</button>
    <button type="button" data-action="zoom" aria-pressed="false">放大</button>
    <button type="button" data-action="fire" disabled>射击</button>
    <button type="button" data-action="restart">重来</button>
   </div></footer></div>`;
  document.body.append(this.dialog);
  this.canvas=this.dialog.querySelector('.ttc-scene')!;
  this.ctx=this.canvas.getContext('2d')!;
  this.world.width=W;this.world.height=H;
  const signal=this.controls.signal;
  this.dialog.querySelector<HTMLSelectElement>('[aria-label="选择人物"]')!.addEventListener('change',e=>{this.role=(e.target as HTMLSelectElement).value as Member;void this.prepare();},{signal});
  this.dialog.querySelector<HTMLSelectElement>('[aria-label="选择场景"]')!.addEventListener('change',e=>{this.sceneIndex=Number((e.target as HTMLSelectElement).value);void this.prepare();},{signal});
  this.dialog.querySelector<HTMLInputElement>('[aria-label="移动视野"]')!.addEventListener('input',e=>this.pan(Number((e.target as HTMLInputElement).value)),{signal});
  this.dialog.addEventListener('click',e=>{
   const action=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
   if(action==='close')this.dialog.close();
   if(action==='start'||action==='restart'){if(this.ready)this.start();else if(!this.loading)void this.prepare();}
   if(action==='left')this.pan(this.camera-320);
   if(action==='right')this.pan(this.camera+320);
   if(action==='fire')this.fire();
   if(action==='zoom'){this.zoom=!this.zoom;this.button('zoom').setAttribute('aria-pressed',String(this.zoom));this.canvas.focus();}
   if(action==='hint'&&!this.hinted&&this.round.status==='playing'){this.hinted=true;this.hintTarget=this.targets.findIndex((_,i)=>!this.round.found.includes(i));this.hintUntil=performance.now()+2500;this.button('hint').disabled=true;this.pan(this.targets[this.hintTarget].x-W/2);this.say(this.targets[this.hintTarget].hint);this.canvas.focus();}
  },{signal});
  const point=(e:PointerEvent)=>{
   const b=this.canvas.getBoundingClientRect();
   this.aim={x:Math.max(0,Math.min(W,(e.clientX-b.left)*W/b.width)),y:Math.max(0,Math.min(H,(e.clientY-b.top)*H/b.height))};
   if(e.pointerType==='touch')this.dialog.querySelector('.ttc-help')!.textContent='左右滑动找人 · 轻触瞄准 · 点射击';
  };
  this.canvas.addEventListener('pointerdown',e=>{point(e);this.canvas.focus();this.canvas.setPointerCapture(e.pointerId);if(e.button===2)this.heldZoom=true;else this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,camera:this.camera,moved:false};},{signal});
  this.canvas.addEventListener('pointermove',e=>{
   point(e);if(!this.drag||this.drag.id!==e.pointerId)return;
   if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>7)this.drag.moved=true;
   if(this.drag.moved)this.pan(dragCamera(this.drag.camera,this.drag.x,e.clientX,this.canvas.getBoundingClientRect().width,this.scene.width));
  },{signal});
  this.canvas.addEventListener('pointerup',e=>{point(e);const moved=this.drag?.moved;this.drag=null;this.heldZoom=false;if(!moved&&e.pointerType==='mouse'&&e.button===0)this.fire();},{signal});
  this.canvas.addEventListener('pointercancel',()=>{this.drag=null;this.heldZoom=false;},{signal});
  this.canvas.addEventListener('lostpointercapture',()=>{this.drag=null;},{signal});
  this.canvas.addEventListener('contextmenu',e=>e.preventDefault(),{signal});
  this.canvas.addEventListener('keydown',e=>{
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Enter'].includes(e.code))e.preventDefault();
   if(e.code==='KeyA'||e.code==='KeyD'){e.preventDefault();this.pan(this.camera+(e.code==='KeyA'?-48:48));}
   const step=e.shiftKey?3:12;
   if(e.code==='ArrowLeft')this.aim.x=Math.max(0,this.aim.x-step);
   if(e.code==='ArrowRight')this.aim.x=Math.min(W,this.aim.x+step);
   if(e.code==='ArrowUp')this.aim.y=Math.max(0,this.aim.y-step);
   if(e.code==='ArrowDown')this.aim.y=Math.min(H,this.aim.y+step);
   if(e.code==='Space')this.heldZoom=true;
   if(e.code==='Enter'&&!e.repeat)this.fire();
  },{signal});
  this.canvas.addEventListener('keyup',e=>{if(e.code==='Space')this.heldZoom=false;},{signal});
  this.canvas.addEventListener('blur',()=>{this.heldZoom=false;},{signal});
  window.addEventListener('blur',()=>{this.heldZoom=false;},{signal});
  // Prevent world shortcuts while the native dialog owns focus.
  this.dialog.addEventListener('keydown',e=>{if(e.code!=='Escape')e.stopPropagation();},{signal});
  this.dialog.addEventListener('close',()=>{cancelAnimationFrame(this.raf);this.revision++;this.loading=null;this.drag=null;this.heldZoom=false;this.round=createRound();restoreWorldFocus(this.dialog,this.opener);},{signal});
 }
 private button(action:string){return this.dialog.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;}
 private pan(x:number){
  this.camera=clampCamera(x,this.scene.width);
  const slider=this.dialog.querySelector<HTMLInputElement>('[aria-label="移动视野"]')!;
  slider.max=String(this.scene.width-W);slider.value=String(this.camera);slider.disabled=this.scene.width<=W;
  this.button('left').disabled=this.camera<=0;this.button('right').disabled=this.camera>=this.scene.width-W;
 }
 async open(){
  if(!this.dialog.open){this.opener=document.activeElement as HTMLElement;this.dialog.showModal();}
  await this.prepare();
 }
 private async prepare(){
  const revision=++this.revision,scene=this.scene,role=this.role;
  this.ready=false;this.round=createRound();this.lastStatus='';this.hinted=false;this.hintUntil=0;this.feedbackUntil=0;this.drag=null;this.bg=null;this.pan(0);
  this.ctx.clearRect(0,0,W,H);this.world.width=scene.width;
  this.dialog.querySelector('.ttc-scene-name')!.textContent=scene.name;
  this.dialog.querySelector('.ttc-member-name')!.textContent=this.name;
  this.dialog.querySelector<HTMLCanvasElement>('.ttc-target canvas')!.getContext('2d')!.clearRect(0,0,72,72);
  this.updateUI(performance.now());this.button('start').disabled=true;this.button('start').textContent='正在加载…';
  const frame=characterRegistry.members[role].frames.find(f=>f.name==='idle-front')!;
  this.loading=Promise.all([load(scene.url),characterImage(frame.source)]).then(([bg,sheet])=>{
   if(revision!==this.revision||!this.dialog.open)return;
   this.bg=bg;const [x,y,w,h]=frame.rect;this.sprite.width=w;this.sprite.height=h;
   const c=this.sprite.getContext('2d')!;c.drawImage(sheet,x,y,w,h,0,0,w,h);this.alpha=c.getImageData(0,0,w,h).data;
   const portrait=this.dialog.querySelector<HTMLCanvasElement>('.ttc-target canvas')!;
   portrait.setAttribute('aria-label',this.name+' 的头像');portrait.getContext('2d')!.drawImage(this.sprite,0,0,w,h*.56,0,0,72,72);
   this.ready=true;this.button('start').disabled=false;this.button('start').textContent='开始寻找';
  });
  try{await this.loading;}catch{
   if(revision!==this.revision)return;
   this.dialog.querySelector('.ttc-notice strong')!.textContent='素材加载失败';this.dialog.querySelector('.ttc-notice p')!.textContent='检查网络后点击重试。';this.button('start').textContent='重试';this.button('start').disabled=false;
  }finally{if(revision===this.revision)this.loading=null;}
  if(revision===this.revision&&this.dialog.open){cancelAnimationFrame(this.raf);this.tick();}
 }
 private start(){
  this.pan(0);this.lastStatus='';startRound(this.round,performance.now());this.hinted=false;this.hintUntil=0;this.hintTarget=-1;this.feedbackUntil=0;this.zoom=false;this.heldZoom=false;
  this.aim={x:W/2,y:H/2};this.button('zoom').setAttribute('aria-pressed','false');this.button('hint').disabled=false;this.canvas.focus();
 }
 private say(text:string){this.feedback=text;this.feedbackUntil=performance.now()+1600;}
 private fire(){
  if(!this.ready||this.round.status!=='playing')return;
  const targetId=this.targets.findIndex((target,i)=>!this.round.found.includes(i)&&visibleHit(worldPoint(this.aim.x,this.aim.y,this.camera).x,this.aim.y,(u,v)=>{
   const x=Math.min(this.sprite.width-1,Math.floor(u*this.sprite.width)),y=Math.min(this.sprite.height-1,Math.floor(v*this.sprite.height));
   return this.alpha?.[(y*this.sprite.width+x)*4+3]??0;
  },target));
  const before=this.round.found.length;
  shoot(this.round,targetId<0?null:targetId,performance.now());const status=String(this.round.status),hit=this.round.found.length>before;
  this.say(status==='won'?'全部找到了！':status==='lost'?'时间到了':hit?`击中 ${this.name}！还剩 ${this.targets.length-this.round.found.length} 个`:'没打中，扣 3 秒');
  this.sound(hit);this.canvas.focus();
 }
 private sound(hit:boolean){
  try{const ac=new AudioContext(),o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(hit?620:160,ac.currentTime);o.frequency.exponentialRampToValueAtTime(hit?920:60,ac.currentTime+.12);g.gain.setValueAtTime(.045,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.15);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.16);o.onended=()=>void ac.close();}catch{/* Sound is optional. */}
 }
 private tick=()=>{
  if(!this.dialog.open)return;
  const now=performance.now();tickRound(this.round,now);this.draw(now);this.updateUI(now);this.raf=requestAnimationFrame(this.tick);
 };
 private updateUI(now:number){
  this.dialog.querySelector('.ttc-clock strong')!.innerHTML=`${Math.ceil(this.round.remaining)}<span>秒</span>`;
  this.dialog.querySelector('.ttc-target small')!.textContent=`${this.round.found.length} / ${this.targets.length}`;
  this.dialog.querySelector<HTMLElement>('.ttc-feedback')!.textContent=now<this.feedbackUntil?this.feedback:'';
  this.button('fire').disabled=this.round.status!=='playing';
  this.button('hint').disabled=this.round.status!=='playing'||this.hinted;
  if(this.lastStatus===this.round.status)return;this.lastStatus=this.round.status;
  const notice=this.dialog.querySelector<HTMLElement>('.ttc-notice')!;notice.hidden=this.round.status==='playing';
  const won=this.round.status==='won',lost=this.round.status==='lost';
  notice.querySelector('strong')!.textContent=won?`找齐了 ${this.name}`:lost?'时间到了':`找齐 ${this.targets.length} 个 ${this.name}`;
  notice.querySelector('p')!.textContent=won?`用了 ${Math.ceil(60-this.round.remaining-this.round.penalty)} 秒 · 射击 ${this.round.shots} 次`:lost?'圈出了剩余位置，再观察一次。':'拖动画面找齐目标，放大对照头像。打空扣 3 秒。';
  this.button('start').textContent=won||lost?'再玩一次':'开始寻找';
 }
 private draw(now:number){
  if(!this.bg)return;
  const world=this.world.getContext('2d')!;
  world.imageSmoothingEnabled=false;world.drawImage(this.bg,0,0,this.scene.width,H);
  this.targets.forEach((t,i)=>{
   // Found targets disappear; foreground clips and alpha hit tests share bounds.
   if(this.round.found.includes(i))return;
   if(this.round.status!=='ready'){
    world.save();world.beginPath();world.rect(t.x+t.w*t.revealLeft,t.y,t.w*(t.revealRight-t.revealLeft),t.visibleHeight);world.clip();
    world.filter=`brightness(${t.brightness}) saturate(.60) sepia(.14)`;world.drawImage(this.sprite,t.x,t.y,t.w,t.h);world.restore();
   }
   if((now<this.hintUntil&&i===this.hintTarget)||this.round.status==='lost'){
    world.beginPath();world.strokeStyle='#f3d387';world.lineWidth=3;world.arc(t.x+t.w/2,t.y+t.visibleHeight/2,this.round.status==='playing'?75:28,0,Math.PI*2);world.stroke();
   }
  });
  const c=this.ctx;c.imageSmoothingEnabled=false;c.drawImage(this.world,this.camera,0,W,H,0,0,W,H);
  if(this.round.status!=='playing')return;
  const {x,y}=this.aim;
  if(this.zoom||this.heldZoom){
   c.save();c.beginPath();c.arc(x,y,102,0,Math.PI*2);c.clip();
   c.translate(x,y);c.scale(3,3);c.drawImage(this.world,-x-this.camera,-y);c.restore();
   c.beginPath();c.arc(x,y,102,0,Math.PI*2);c.strokeStyle='#20271e';c.lineWidth=7;c.stroke();c.strokeStyle='#e7d9ae';c.lineWidth=2;c.stroke();
  }
  c.strokeStyle='#171d16';c.lineWidth=5;this.cross(c,x,y);c.strokeStyle='#f7e9bd';c.lineWidth=2;this.cross(c,x,y);
 }
 private cross(c:CanvasRenderingContext2D,x:number,y:number){c.beginPath();c.moveTo(x-17,y);c.lineTo(x-5,y);c.moveTo(x+5,y);c.lineTo(x+17,y);c.moveTo(x,y-17);c.lineTo(x,y-5);c.moveTo(x,y+5);c.lineTo(x,y+17);c.stroke();}
 dispose(){if(this.dialog.open)this.dialog.close();cancelAnimationFrame(this.raf);this.controls.abort();this.dialog.remove();}
}
