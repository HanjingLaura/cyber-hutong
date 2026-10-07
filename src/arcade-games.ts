import { Mines, Spider } from './arcade-rules';
import { ArcadeSports } from './arcade-sports';
import {useDevice,releaseDevice,saveProgress,personalProgress,onlineWorld} from './multiplayer/world-client';
import {toyCanvas} from './gacha-assets';
export type ArcadeKind='mines'|'spider'|'claw'|'basketball'|'hockey';
const names={mines:'扫雷',spider:'蜘蛛纸牌',claw:'抓娃娃',basketball:'投篮',hockey:'空气曲棍球'};
const ranks=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
declare global {interface Window{__arcadeGamePreview?:{getState:()=>unknown}}}
/** Real local games; opening/closing the machine preserves the current round. */
export class ArcadeGames {
  readonly dialog=document.querySelector<HTMLDialogElement>('#arcade-game')!;
  private canvas=document.querySelector<HTMLCanvasElement>('#arcade-screen')!;
  private ctx=this.canvas.getContext('2d')!;
  private kind:ArcadeKind='mines';
  private mines=new Mines();
  private spider=new Spider();
  private selection:{column:number;index:number}|null=null;
  private message='';
  private clawX=320;
  private clawStartX=320;
  private phase:'ready'|'down'|'up'|'deliver'='ready';
  private phaseTime=0;
  private captured:number|null=null;
  private prizes=[140,220,300,380,460,530].map((x,i)=>({x,color:i%5}));
  private wins=0;
  private round:string|null=null;
  private waiting=false;
  private frame=0;
  private held=new Set<string>();
  private previous=0;
  private sports=new ArcadeSports();
  private listeners=new AbortController();
  constructor(){
    this.ctx.imageSmoothingEnabled=false;
    try{this.wins=Number(localStorage.getItem('hutong-claw-wins')??0)||0;}catch{/* optional */}
    this.listen(this.canvas,'contextmenu',e=>e.preventDefault());
    this.listen(this.canvas,'pointerdown',event=>{
      const rect=this.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*640/rect.width,y=(event.clientY-rect.top)*420/rect.height;
      if(this.kind==='mines'){
        const col=Math.floor((x-170)/30),row=Math.floor((y-65)/30);
        if(col>=0&&col<10&&row>=0&&row<10){event.button===2?this.mines.flag(row*10+col):this.mines.reveal(row*10+col);this.draw();}
      }else if(this.kind==='spider')this.cardClick(x,y);
      else if(this.kind==='basketball'||this.kind==='hockey'){this.sports.pointer(this.kind,x,y);this.draw();}
      else if(this.phase==='ready'){this.clawX=Math.max(110,Math.min(550,x));this.draw();}
    });
    this.listen(this.canvas,'pointermove',e=>{if(this.dialog.open&&(this.kind==='basketball'||this.kind==='hockey')){const rect=this.canvas.getBoundingClientRect();this.sports.pointer(this.kind,(e.clientX-rect.left)*640/rect.width,(e.clientY-rect.top)*420/rect.height);}});
    this.listen(document.querySelector('#arcade-close')!,'click',()=>this.dialog.close());
    this.listen(document.querySelector('#arcade-new')!,'click',()=>this.restart());
    this.listen(document.querySelector('#arcade-undo')!,'click',()=>{this.spider.undo();this.selection=null;this.message='';this.draw();});
    this.listen(document.querySelector('#arcade-action')!,'click',()=>this.action());
    const key=(event:KeyboardEvent)=>{
      if(!this.dialog.open)return;
      if(event.code==='KeyE'&&!event.repeat){event.preventDefault();event.stopImmediatePropagation();this.dialog.close();return;}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','Space','KeyE'].includes(event.code))event.preventDefault();
      this.held.add(event.code);
      if(!event.repeat&&['Space','KeyE'].includes(event.code)&&['claw','basketball'].includes(this.kind))this.action();
    };
    this.listen(window,'keydown',key);
    this.listen(window,'keyup',e=>this.held.delete(e.code));
    this.listen(window,'blur',()=>this.held.clear());
    this.listen(this.dialog,'close',()=>{if(this.kind==='claw'&&this.round&&!this.waiting){void onlineWorld()?.reward('claw-cancel',{round:this.round}).catch(()=>{});this.round=null;this.captured=null;this.phase='ready';}releaseDevice(this.kind);cancelAnimationFrame(this.frame);this.held.clear();document.querySelector<HTMLElement>('.world')!.focus();});
    window.__arcadeGamePreview={getState:()=>({kind:this.kind,open:this.dialog.open,sports:this.sports.state(),mines:{bombs:[...this.mines.bombs],open:[...this.mines.open],flags:[...this.mines.flags],outcome:this.mines.outcome},spider:{columns:this.spider.columns,stock:this.spider.stock.length,completed:this.spider.completed,moves:this.spider.moves},claw:{x:this.clawX,phase:this.phase,wins:this.wins,prizes:this.prizes}})};
  }
  private listen<K extends keyof HTMLElementEventMap>(target:EventTarget,type:K,listener:(event:HTMLElementEventMap[K])=>void){target.addEventListener(type,listener as EventListener,{signal:this.listeners.signal});}
  dispose(){if(this.dialog.open)this.dialog.close();cancelAnimationFrame(this.frame);this.held.clear();this.listeners.abort();}
  open(kind:ArcadeKind){
    if(useDevice(kind,()=>this.open(kind)))return;
    if(onlineWorld()?.bridge.user?.role)this.wins=personalProgress().find(p=>p.kind==='score'&&p.key==='claw')?.data.value??0;
    if(kind==='claw'&&this.phase==='ready')this.loadPrizes();
    this.kind=kind;this.recordedScore=-1;this.message='';this.held.clear();this.selection=null;
    document.querySelector('#arcade-title')!.textContent=names[kind];
    document.querySelector<HTMLElement>('#arcade-undo')!.hidden=kind!=='spider';
    document.querySelector<HTMLElement>('#arcade-action')!.hidden=kind==='mines'||kind==='hockey';
    document.querySelector('#arcade-action')!.textContent=kind==='basketball'?'投篮 · Space':kind==='claw'?'抓取 · Space':'发牌';
    document.querySelector('#arcade-help')!.textContent=kind==='basketball'?'鼠标 / ← → 瞄准 · Space 投篮 · 10 次机会':kind==='hockey'?'鼠标 / WASD 移动球锤 · 先得 5 分获胜':kind==='mines'?'点击翻格 · 右键插旗':kind==='spider'?'单花色 · 点牌，再点目标列 · K → A 收齐':'← → / A D 移动 · Space 抓取';
    this.dialog.showModal();this.draw();this.previous=performance.now();this.tick(this.previous);
  }
  private restart(){
    if(this.kind==='claw'&&(this.waiting||this.phase!=='ready'))return;
    if(this.kind==='basketball'||this.kind==='hockey')this.sports.reset(this.kind);
    if(this.kind==='mines')this.mines=new Mines();
    if(this.kind==='spider'){this.spider=new Spider();this.selection=null;}
    if(this.kind==='claw'){this.phase='ready';this.captured=null;this.loadPrizes();}
    this.message='';this.draw();
  }
  private action(){
    if(this.kind==='basketball')this.sports.shoot();
    if(this.kind==='spider'){if(!this.spider.deal())this.message='先填满空列';else this.message='';this.selection=null;this.draw();}
    if(this.kind==='claw'&&this.phase==='ready'&&!this.waiting&&this.prizes.length)void this.startClaw();
  }
  private loadPrizes(){const remaining=personalProgress().find(p=>p.kind==='claw'&&p.key==='machine')?.data.remaining??[0,1,2,3,4,5];this.prizes=(remaining.length?remaining:[0,1,2,3,4,5]).map((i:number)=>({x:[140,220,300,380,460,530][i],color:i%5}));}
  private async startClaw(){this.waiting=true;const aim=this.clawX;try{const service=onlineWorld();if(!service?.bridge.user?.role)throw Error('登录后可以抓取娃娃');const result=await service.reward('claw-start',{aim});if(!this.dialog.open){await service.reward('claw-cancel',{round:result.round});return;}this.round=result.round;this.phase='down';this.phaseTime=performance.now();this.clawStartX=this.clawX=aim;this.captured=null;this.message='';}catch(e){this.message=(e as Error).message;}finally{this.waiting=false;this.draw();}}
  private async finishClaw(){this.waiting=true;try{const result=await onlineWorld()!.reward('claw-finish',{round:this.round});this.wins=result.wins;if(Array.isArray(result.remaining))this.prizes=(result.remaining.length?result.remaining:[0,1,2,3,4,5]).map((i:number)=>({x:[140,220,300,380,460,530][i],color:i%5}));else if(result.won&&this.captured!==null)this.prizes.splice(this.captured,1);this.message=result.won?(result.collected?'抓到了，放进收藏':'抓到了，拿在手上'):'没抓到，再试一次';}catch(e){this.message=(e as Error).message;}finally{this.waiting=false;this.round=null;this.captured=null;this.phase='ready';this.clawX=110;this.draw();}}
  private step(column:number){return Math.min(17,265/Math.max(1,this.spider.columns[column].length));}
  private cardClick(x:number,y:number){
    const column=Math.floor((x-20)/60);if(column<0||column>9||y<70)return;
    const cards=this.spider.columns[column],index=Math.min(cards.length-1,Math.floor((y-70)/this.step(column)));
    if(this.selection){
      if(this.spider.move(this.selection.column,this.selection.index,column)){this.selection=null;this.message='';this.draw();return;}
      if(this.selection.column===column&&this.selection.index===index){this.selection=null;this.draw();return;}
    }
    if(this.spider.canSelect(column,index)){this.selection={column,index};this.message='';}else this.message='选择连续递减的明牌';
    this.draw();
  }
  private tick(now:number){
    if(!this.dialog.open)return;
    const delta=Math.min(40,now-this.previous);this.previous=now;
    if(this.kind==='basketball'||this.kind==='hockey'){this.sports.update(this.kind,delta,this.held);this.draw();}
    if(this.kind==='claw'){
      if(this.waiting){/* The server confirms each grab and delivery once. */}
      else if(this.phase==='ready'){
        const direction=Number(this.held.has('ArrowRight')||this.held.has('KeyD'))-Number(this.held.has('ArrowLeft')||this.held.has('KeyA'));
        this.clawX=Math.max(110,Math.min(550,this.clawX+direction*delta*.18));
      }else if(now-this.phaseTime>=800){
        if(this.phase==='down'){
          const index=this.prizes.findIndex(p=>Math.abs(p.x-this.clawX)<19);this.captured=index<0?null:index;this.phase='up';
        }else if(this.phase==='up')this.phase='deliver';
        else {
          void this.finishClaw();
        }
        this.phaseTime=now;
      }
      this.draw(now);
    }
    this.frame=requestAnimationFrame(time=>this.tick(time));
  }
  private rect(x:number,y:number,w:number,h:number,color:string){this.ctx.fillStyle=color;this.ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  private text(text:string,x:number,y:number,color='#e6e9d2',size=14){this.ctx.fillStyle=color;this.ctx.font=`${size}px monospace`;this.ctx.fillText(text,x,y);}
  private bomb(x:number,y:number){this.rect(x+7,y+6,14,14,'#222a36');this.rect(x+4,y+10,20,6,'#222a36');this.rect(x+10,y+3,6,20,'#222a36');this.rect(x+8,y+7,4,4,'#fff');}
  private plush(x:number,y:number,color:number){
    this.ctx.drawImage(toyCanvas(color,true),Math.round(x-20),Math.round(y-40),40,48);
  }
  private recordedScore=-1;
  private draw(now=performance.now()){
    const sports=this.sports.state();const value=this.kind==='basketball'?sports.basketball.score:this.kind==='hockey'?sports.hockey.goals[0]:this.kind==='claw'?this.wins:this.kind==='spider'&&this.spider.completed===8?Math.max(1,10000-this.spider.moves):this.kind==='mines'&&this.mines.outcome==='won'?1:0;
    if(this.kind!=='claw'&&value>0&&value!==this.recordedScore){this.recordedScore=value;saveProgress('score',this.kind,{value});}
    if(this.kind==='basketball'||this.kind==='hockey'){this.sports.draw(this.ctx,this.kind);return;}
    this.rect(0,0,640,420,this.kind==='spider'?'#19453d':'#172532');
    if(this.kind==='mines'){
      this.text(`地雷 ${15-this.mines.flags.size}`,170,40,'#f2bf75');
      for(let i=0;i<100;i++){
        const x=170+i%10*30,y=65+Math.floor(i/10)*30,open=this.mines.open.has(i);
        this.rect(x,y,29,29,open?'#b6c4bd':'#415e70');
        if(!open){this.rect(x,y,29,3,'#86a6b0');this.rect(x,y,3,29,'#86a6b0');this.rect(x+26,y+3,3,26,'#263b4b');}
        if(this.mines.flags.has(i)){this.rect(x+14,y+6,2,17,'#ddd');this.rect(x+6,y+6,10,8,'#dc8275');}
        if(this.mines.bombs.has(i)&&(open||this.mines.outcome==='lost'))this.bomb(x,y);
        else if(open&&this.mines.number(i))this.text(String(this.mines.number(i)),x+9,y+21,['','#285688','#246343','#a94850','#664d8e'][this.mines.number(i)]??'#292f43',18);
      }
      this.text(this.mines.outcome==='won'?'通关！':this.mines.outcome==='lost'?'踩到地雷了':'',170,395,'#ebbd87');
    }else if(this.kind==='spider'){
      this.text(`收齐 ${this.spider.completed}/8`,20,33);this.text(`步数 ${this.spider.moves}`,210,33);this.text(`待发 ${this.spider.stock.length}`,470,33);
      this.spider.columns.forEach((column,col)=>{
        const x=20+col*60;this.rect(x,70,49,59,'#12362f');
        column.forEach((card,index)=>{
          const y=70+index*this.step(col);this.rect(x,y,49,59,'#121b24');this.rect(x+2,y+2,45,55,card.up?'#e8e3c9':'#415f82');
          if(card.up){this.text(ranks[card.rank],x+5,y+15,'#293340',11);this.rect(x+31,y+8,7,7,'#293340');this.rect(x+29,y+11,11,5,'#293340');this.rect(x+33,y+14,3,5,'#293340');}
          else this.rect(x+7,y+6,35,5,'#7a91aa');
          if(this.selection?.column===col&&this.selection.index<=index){this.ctx.strokeStyle='#ebcf6d';this.ctx.lineWidth=2;this.ctx.strokeRect(x+1,y+1,47,57);}
        });
      });this.text(this.spider.completed===8?'通关！':this.message,20,406,'#edcf82',12);
    }else {
      this.rect(70,30,500,340,'#db8fa7');this.rect(82,43,476,265,'#83bbc2');this.rect(91,53,458,247,'#24434f');
      this.rect(93,65,454,7,'#a9c6cb');this.rect(86,313,116,45,'#272b36');this.rect(94,320,100,29,'#111b26');
      this.prizes.forEach((p,i)=>{if(i!==this.captured)this.plush(p.x,285,p.color);});
      const progress=Math.min(1,(now-this.phaseTime)/800);
      let y=95;
      if(this.phase==='down')y=95+progress*150;
      if(this.phase==='up')y=245-progress*150;
      if(this.phase==='deliver')this.clawX=this.clawStartX+(140-this.clawStartX)*progress;
      this.rect(this.clawX-2,72,4,y-72,'#b9c8c9');this.rect(this.clawX-9,y,18,9,'#ddd9c8');
      this.rect(this.clawX-17,y+8,5,18,'#a7bcc4');this.rect(this.clawX+12,y+8,5,18,'#a7bcc4');this.rect(this.clawX-12,y+21,5,7,'#ddd9c8');this.rect(this.clawX+7,y+21,5,7,'#ddd9c8');
      if(this.captured!==null)this.plush(this.clawX,y+57,this.prizes[this.captured].color);
      this.text(`抓到 ${this.wins}`,225,345,'#262b37');this.text(this.message,90,402,'#eccdb2',12);
    }
  }
}
