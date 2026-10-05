export const BEAD_COLORS=['#fff4dc','#303438','#eb6269','#ffae54','#f5d965','#82bd68','#339a91','#71cce0','#478fc2','#7267b4','#b58bd0','#ee94bd','#a2684c','#ddd4c1','#a3acb4','#654e47'];
import {saveProgress,onlineWorld,personalProgress} from './multiplayer/world-client';
export const BOARD_SIZE=16;
export type BeadWork={cells:number[];pattern:string;created:number;key?:string};
type BoardState={cells:number[];pattern:string;fused:boolean};
export const beadTemplates:Record<string,string[]>={
  '爱心':['................','................','...RRR....RRR...','..RRRRR..RRRRR..','.RRRRRRRRRRRRRR.','.RRRRRRRRRRRRRR.','.RRRRRRRRRRRRRR.','..RRRRRRRRRRRR..','...RRRRRRRRRR...','....RRRRRRRR....','.....RRRRRR.....','......RRRR......','.......RR.......','................','................','................'],
  '星星':['................','.......YY.......','.......YY.......','......YYYY......','......YYYY......','..YYYYYYYYYYYY..','...YYYYYYYYYY...','....YYYYYYYY....','.....YYYYYY.....','....YYYYYYYY....','....YYY..YYY....','...YYY....YYY...','...YY......YY...','................','................','................'],
  '小花':['................','......PPP.......','.....PPPPP......','...PPPPYPPPP....','..PPPYYYYYPPP...','...PPPPYPPPP....','.....PPPPP......','......PPP.......','.......G........','....GG.G........','.....GGG.GG.....','.......GGG......','.......G........','.......G........','................','................'],
};
const templateColors:Record<string,number>={R:2,Y:4,P:11,G:5};
export function guideCells(name:string){return (beadTemplates[name]??Array(16).fill('.'.repeat(16))).flatMap(row=>[...row].map(c=>templateColors[c]??-1));}
export function drawBead(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,color:number,fused=false){
  ctx.fillStyle=BEAD_COLORS[color];ctx.fillRect(x+1,y+1,size-2,size-2);
  ctx.fillStyle='rgba(255,255,255,.4)';ctx.fillRect(x+2,y+2,size-4,2);
  ctx.fillStyle='rgba(0,0,0,.24)';ctx.fillRect(x+size-3,y+3,2,size-5);ctx.fillRect(x+3,y+size-3,size-5,2);
  if(!fused){ctx.fillStyle='#5e635a';ctx.fillRect(x+Math.floor(size/2)-1,y+Math.floor(size/2)-1,3,3);}
}
function validCells(value:unknown):value is number[]{return Array.isArray(value)&&value.length===256&&value.every(c=>Number.isInteger(c)&&c>=-1&&c<BEAD_COLORS.length);}
const empty=()=>Array<number>(256).fill(-1);

export class PerlerBoard {
  readonly dialog=document.querySelector<HTMLDialogElement>('#perler-workshop')!;
  private canvas=document.querySelector<HTMLCanvasElement>('#perler-board')!;
  private ctx=this.canvas.getContext('2d')!;
  private boards=Array.from({length:8},()=>({cells:empty(),pattern:'自由',fused:false}));
  private histories=Array.from({length:8},()=>({undo:[] as number[][],redo:[] as number[][]}));
  works:BeadWork[]=[];
  seat=0; color=2; erasing=false; busy=false;
  private stroke:number[]|null=null;private last:number|null=null;private pointer:number|null=null;
  private timer?:ReturnType<typeof setTimeout>;
  private revision=0; private message='选一种颜色，点击或拖动放豆。';
  private galleryOnly=false;
  private listeners=new AbortController();
  constructor(private onChange:()=>void){
    try{const value=JSON.parse(localStorage.getItem('hutong-perler-v1')??'null');
      if(Array.isArray(value?.boards)&&value.boards.length===8)value.boards.forEach((b:BoardState,i:number)=>{if(b&&validCells(b.cells)&&['自由',...Object.keys(beadTemplates)].includes(b.pattern))this.boards[i]={cells:[...b.cells],pattern:b.pattern,fused:!!b.fused};});
      if(Array.isArray(value?.works))this.works=value.works.filter((w:BeadWork)=>w&&validCells(w.cells)&&typeof w.pattern==='string'&&Number.isFinite(w.created)).slice(-24);
    }catch{/* storage is optional */}
    this.ctx.imageSmoothingEnabled=false;
    const palette=document.querySelector('#perler-palette')!;palette.replaceChildren();
    BEAD_COLORS.forEach((color,i)=>{const button=document.createElement('button');button.type='button';button.style.background=color;button.setAttribute('aria-label',`颜色 ${i+1}`);button.dataset.color=String(i);this.listen(button,'click',()=>{this.color=i;this.erasing=false;this.render();});palette.append(button);});
    const select=document.querySelector<HTMLSelectElement>('#perler-pattern')!;
    select.replaceChildren();
    ['自由',...Object.keys(beadTemplates)].forEach(name=>{const option=document.createElement('option');option.textContent=name;select.append(option);});
    this.listen(select,'change',()=>{if(this.busy||this.board.fused)return;this.board.pattern=select.value;this.save();this.render();});
    const bind=(id:string,fn:()=>void)=>this.listen(document.querySelector(id)!,'click',fn);
    bind('#perler-close',()=>this.dialog.close());
    bind('#perler-eraser',()=>{this.erasing=!this.erasing;this.render();});
    bind('#perler-undo',()=>this.undo(false));bind('#perler-redo',()=>this.undo(true));
    bind('#perler-iron',()=>this.iron());
    bind('#perler-new',()=>{if(this.busy)return;this.commitStroke();this.history.undo.push([...this.board.cells]);this.history.redo=[];this.board.cells=empty();this.board.fused=false;this.message='换了新底板。';this.save();this.render();this.onChange();});
    this.listen(this.canvas,'contextmenu',e=>e.preventDefault());
    this.listen(this.canvas,'pointerdown',e=>{if(this.busy||this.board.fused||this.pointer!==null||![0,2].includes(e.button))return;e.preventDefault();this.pointer=e.pointerId;this.canvas.setPointerCapture(e.pointerId);this.stroke=[...this.board.cells];this.last=null;this.paint(e,e.button===2||this.erasing);});
    this.listen(this.canvas,'pointermove',e=>{if(e.pointerId===this.pointer)this.paint(e,(e.buttons&2)!==0||this.erasing);});
    const end=(e:PointerEvent)=>{if(e.pointerId===this.pointer)this.commitStroke();};
    this.listen(this.canvas,'pointerup',end);this.listen(this.canvas,'pointercancel',end);this.listen(this.canvas,'lostpointercapture',end);
    this.listen(this.dialog,'close',()=>{this.commitStroke();this.cancelIron();document.querySelector<HTMLElement>('.world')!.focus();});
    const exit=(e:KeyboardEvent)=>{if(this.dialog.open&&e.code==='KeyE'&&!e.repeat&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')){e.preventDefault();e.stopImmediatePropagation();this.close();}};
    this.listen(window,'keydown',exit);
    this.render();
  }
  private listen<K extends keyof HTMLElementEventMap>(target:EventTarget,type:K,listener:(event:HTMLElementEventMap[K])=>void){target.addEventListener(type,listener as EventListener,{signal:this.listeners.signal});}
  dispose(){this.close();this.listeners.abort();}
  get board(){return this.boards[this.seat];}
  private get history(){return this.histories[this.seat];}
  getState(){return {open:this.dialog.open,seat:this.seat,color:this.color,erasing:this.erasing,busy:this.busy,cells:[...this.board.cells],pattern:this.board.pattern,fused:this.board.fused,works:this.works.length,undo:this.history.undo.length,message:this.message};}
  cellsAt(seat:number){return this.boards[seat].cells;}
  open(seat:number,gallery=false){if(onlineWorld()?.bridge.user?.role){const progress=personalProgress();this.works=progress.filter(p=>p.kind==='bead').map(p=>({...p.data,key:p.key}));const draft=progress.find(p=>p.kind==='draft'&&p.key===String(seat));if(!this.dialog.open)this.boards[seat]=draft?structuredClone(draft.data):{cells:empty(),pattern:'自由',fused:false};}this.seat=seat;this.galleryOnly=gallery;this.dialog.dataset.gallery=String(gallery);this.message=gallery?this.works.length?'已熨烫的作品都收在这里。':'还没有作品，先到圆凳旁拼一张。':this.board.fused?'作品已熨烫，可以换新底板。':'选色放豆，右键或橡皮擦移除。';this.render();this.dialog.showModal();}
  close(){if(this.dialog.open)this.dialog.close();else this.cancelIron();}
  private paint(e:PointerEvent,erase:boolean){
    const rect=this.canvas.getBoundingClientRect();const px=(e.clientX-rect.left)*360/rect.width,py=(e.clientY-rect.top)*360/rect.height;
    const x=Math.floor((px-20)/20),y=Math.floor((py-20)/20);
    if(x<0||y<0||x>=16||y>=16){this.last=null;return;}
    const cell=y*16+x;
    if(this.last===null)this.board.cells[cell]=erase?-1:this.color;
    else{let x0=this.last%16,y0=Math.floor(this.last/16);const dx=Math.abs(x-x0),dy=-Math.abs(y-y0),sx=x0<x?1:-1,sy=y0<y?1:-1;let error=dx+dy;
      while(true){this.board.cells[y0*16+x0]=erase?-1:this.color;if(x0===x&&y0===y)break;const twice=2*error;if(twice>=dy){error+=dy;x0+=sx;}if(twice<=dx){error+=dx;y0+=sy;}}
    }
    this.last=cell;this.render();
  }
  private commitStroke(){
    const pointer=this.pointer;this.pointer=null;
    if(pointer!==null&&this.canvas.hasPointerCapture(pointer))this.canvas.releasePointerCapture(pointer);
    if(this.stroke&&this.stroke.some((c,i)=>c!==this.board.cells[i])){this.history.undo.push(this.stroke);if(this.history.undo.length>80)this.history.undo.shift();this.history.redo=[];this.save();this.onChange();}
    this.stroke=null;this.last=null;this.render();
  }
  private undo(redo:boolean){if(this.busy||this.board.fused)return;this.commitStroke();const from=redo?this.history.redo:this.history.undo,to=redo?this.history.undo:this.history.redo;const cells=from.pop();if(!cells)return;to.push([...this.board.cells]);this.board.cells=cells;this.save();this.render();this.onChange();}
  private cancelIron(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;this.revision++;this.busy=false;this.render();}
  private iron(){
    if(this.busy||this.board.fused||!this.board.cells.some(c=>c>=0))return;
    this.commitStroke();this.busy=true;this.message='覆上烫纸，正在熨烫…';this.render();const revision=++this.revision;
    this.timer=setTimeout(async()=>{if(revision!==this.revision||!this.dialog.open)return;this.timer=undefined;const work={cells:[...this.board.cells],pattern:this.board.pattern,created:Date.now()},board=this.board;
      try{if(onlineWorld()?.bridge.user?.role)await onlineWorld()!.saveNow('bead',String(work.created),work);else{this.works.push(work);this.works=this.works.slice(-24);}board.fused=true;this.message='熨烫完成，可以拿走或收进收藏。';this.save();this.onChange();}catch(e){this.message=(e as Error).message;}finally{this.busy=false;this.render();}
    },1000);
  }
  private save(){if(onlineWorld()?.bridge.user?.role){saveProgress('draft',String(this.seat),this.board);return;}try{localStorage.setItem('hutong-perler-v1',JSON.stringify({boards:this.boards,works:this.works}));}catch{/* keep working in memory */}}
  private async takeWork(work:BeadWork,collect:boolean){if(this.busy)return;this.busy=true;this.render();try{const service=onlineWorld();if(!service?.bridge.user?.role)throw Error('登录后可带走作品');const result=await service.reward('perler',{key:work.key??String(work.created),collect});this.message=result.collected?'作品已收进收藏，背包里可以取回。':'作品已拿在手里，可以带出拼豆室。';}catch(e){this.message=(e as Error).message;}finally{this.busy=false;this.render();}}
  render(){
    const ctx=this.ctx;ctx.fillStyle='#a88559';ctx.fillRect(0,0,360,360);ctx.fillStyle='#eae7d8';ctx.fillRect(14,14,332,332);
    const guide=guideCells(this.board.pattern);let correct=0,total=0;
    for(let i=0;i<256;i++){const x=20+i%16*20,y=20+Math.floor(i/16)*20;
      if(guide[i]>=0){total++;if(this.board.cells[i]===guide[i])correct++;ctx.globalAlpha=.22;ctx.fillStyle=BEAD_COLORS[guide[i]];ctx.fillRect(x+1,y+1,18,18);ctx.globalAlpha=1;}
      ctx.fillStyle='#b3b4a4';ctx.fillRect(x+9,y+9,2,2);
      if(this.board.cells[i]>=0)drawBead(ctx,x,y,20,this.board.cells[i],this.board.fused);
    }
    if(this.busy){ctx.fillStyle='#e9e3ceaa';ctx.fillRect(17,17,326,326);ctx.fillStyle='#cabda7';for(let y=20;y<340;y+=6)ctx.fillRect(20,y,320,1);}
    document.querySelector('#perler-progress')!.textContent=`${this.board.cells.filter(c=>c>=0).length} 颗${total?` · 图案 ${correct}/${total}`:''}`;
    document.querySelector('#perler-message')!.textContent=this.message;
    document.querySelector('#perler-title')!.textContent=this.galleryOnly?'作品架':`拼豆 · ${this.seat<4?'前排':'后排'} ${this.seat%4+1} 号`;
    for(const button of document.querySelectorAll<HTMLButtonElement>('#perler-palette button')){button.setAttribute('aria-pressed',String(!this.erasing&&Number(button.dataset.color)===this.color));button.disabled=this.busy||this.board.fused;}
    document.querySelector('#perler-eraser')!.setAttribute('aria-pressed',String(this.erasing));
    for(const id of ['#perler-eraser','#perler-undo','#perler-redo'])(document.querySelector(id) as HTMLButtonElement).disabled=this.busy||this.board.fused;
    (document.querySelector('#perler-undo') as HTMLButtonElement).disabled ||= this.history.undo.length===0;
    (document.querySelector('#perler-redo') as HTMLButtonElement).disabled ||= this.history.redo.length===0;
    (document.querySelector('#perler-iron') as HTMLButtonElement).disabled=this.busy||this.board.fused||!this.board.cells.some(c=>c>=0);
    (document.querySelector('#perler-new') as HTMLButtonElement).disabled=this.busy;
    const select=document.querySelector<HTMLSelectElement>('#perler-pattern')!;select.value=this.board.pattern;select.disabled=this.busy||this.board.fused;
    const gallery=document.querySelector('#perler-gallery')!;gallery.replaceChildren();
    for(const work of this.works.slice().reverse()){const entry=document.createElement('div'),canvas=document.createElement('canvas');entry.className='perler-work';canvas.width=128;canvas.height=128;canvas.setAttribute('aria-label',`${work.pattern}拼豆作品`);const context=canvas.getContext('2d')!;work.cells.forEach((c,i)=>{if(c>=0)drawBead(context,i%16*8,Math.floor(i/16)*8,8,c,true);});entry.append(canvas);const claimed=personalProgress().some(p=>p.kind==='reward'&&p.key==='bead:'+(work.key??work.created));
      if(claimed){const label=document.createElement('small');label.textContent='已带走 / 收藏';entry.append(label);}else for(const collect of [false,true]){const b=document.createElement('button');b.textContent=collect?'收藏':'拿走';b.disabled=this.busy||!collect&&!!onlineWorld()?.bridge.user?.hand;b.onclick=()=>void this.takeWork(work,collect);entry.append(b);}gallery.append(entry);}
    (document.querySelector('#perler-collection') as HTMLElement).hidden=this.works.length===0;
  }
}
