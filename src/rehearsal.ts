import Phaser from 'phaser';
import { registerRegions } from './frames';
import { ShopActor } from './shop-actor';
import { playerInventory } from './player-inventory';
import { Piano } from './piano';
import {useDevice,releaseDevice,onlineWorld} from './multiplayer/world-client';

const seats=[...[172,242,312,382].map((x,i)=>({id:`A${i+1}`,x,y:239})),...[118,180,242,304,366,428].map((x,i)=>({id:`B${i+1}`,x,y:309}))].map(s=>({...s,approachY:s.y+21}));
type Mode='walk'|'seat'|'piano'|'podium';
declare global{interface Window{__rehearsalPreview?:{getState:()=>unknown}}}
export class RehearsalScene extends Phaser.Scene{
  private actor!:ShopActor;private piano!:Piano;private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private chairs:Phaser.GameObjects.Image[]=[];private backs:Phaser.GameObjects.Image[]=[];
  private x=320;private y=339;private facing=2;private mode:Mode='walk';private seated:number|null=null;
  private returnPoint={x:320,y:339};private message='靠近椅子或琴凳按 E。';
  constructor(){super('rehearsal');}
  preload(){
    this.load.image('rehearsal-room',new URL('../assets/drafts/rehearsal-room-v1.png',import.meta.url).href);
    this.load.image('rehearsal-kit',new URL('../assets/drafts/rehearsal-kit-v1.png',import.meta.url).href);
    if(!this.textures.exists('concert-chair'))this.load.image('concert-chair',new URL('../assets/drafts/concert-chair-v1.png',import.meta.url).href);
  }
  create(){
    this.add.image(0,0,'rehearsal-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
    const kit=registerRegions(this,'rehearsal-kit',[{name:'piano',x0:0,y0:0,x1:.41,y1:1},{name:'stand',x0:.41,y0:0,x1:.65,y1:1},{name:'podium',x0:.65,y0:0,x1:1,y1:1}]);
    this.add.image(320,190,'rehearsal-kit',kit[2].name).setOrigin(.5,1).setDisplaySize(70,27).setDepth(190);
    this.add.image(536,222,'rehearsal-kit',kit[0].name).setOrigin(.5,1).setDisplaySize(110,90).setDepth(222);
    // The bench front is in front of the seated player's lower body.
    const bench=this.add.graphics().setDepth(225);
    bench.fillStyle(0x171b21).fillRect(519,211,34,14).fillRect(522,225,4,7).fillRect(546,225,4,7);
    bench.fillStyle(0x48505a).fillRect(520,211,32,2);
    bench.lineStyle(1,0x30363e).lineBetween(521,220,551,220);
    const [chair]=registerRegions(this,'concert-chair',[{name:'chair',x0:0,y0:0,x1:1,y1:1}]);
    const backHeight=Math.round(chair.height*.60),texture=this.textures.get('concert-chair');
    if(!texture.has('backrest'))texture.add('backrest',0,chair.x,chair.y,chair.width,backHeight);
    seats.forEach(s=>{
      this.add.image(s.x,s.y-38,'rehearsal-kit',kit[1].name).setOrigin(.5,1).setDisplaySize(26,44).setDepth(s.y-38);
      this.chairs.push(this.add.image(s.x,s.y+10,'concert-chair','chair').setOrigin(.5,1).setDisplaySize(28,42).setDepth(s.y+10));
      this.backs.push(this.add.image(s.x,s.y+10-42,'concert-chair','backrest').setOrigin(.5,0).setDisplaySize(28,42*backHeight/chair.height).setVisible(false));
    });
    this.actor=new ShopActor(this);this.piano=new Piano(()=>{});
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    const world=document.querySelector<HTMLElement>('.world')!,clear=()=>{this.input.keyboard?.resetKeys();this.piano.stop();};
    const action=(e:KeyboardEvent)=>{
      if(!this.sys.isActive()||document.querySelector('dialog[open]'))return;
      if(e.code==='Escape'&&this.mode!=='walk'&&!/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName??'')){e.preventDefault();this.stand();world.focus();return;}
      if(![world,this.game.canvas].includes(document.activeElement as HTMLElement)&&!(this.mode==='piano'&&document.querySelector('#rehearsal-piano')?.contains(document.activeElement)))return;
      if(this.mode==='piano'&&e.code!=='Escape'){if(this.piano.keyDown(e.code))e.preventDefault();return;}
      if(e.repeat)return;
      if(e.code==='KeyE'){e.preventDefault();this.interact();}
      if(e.code==='Escape'&&this.mode!=='walk'){e.preventDefault();this.stand();}
    };
    const release=(e:KeyboardEvent)=>this.piano.keyUp(e.code);
    window.addEventListener('keydown',action);window.addEventListener('keyup',release);window.addEventListener('blur',clear);
    // Pointer piano keys deliberately do not steal focus; sidebar actions restore it.
    world.addEventListener('blur',clear);
    this.events.on('sleep',()=>{clear();if(this.mode!=='walk')this.stand();});
    this.events.once('shutdown',()=>{this.piano.dispose();window.removeEventListener('keydown',action);window.removeEventListener('keyup',release);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);});
    document.querySelector('#interact')!.addEventListener('click',()=>{if(this.sys.isActive()){this.interact();world.focus();}});
    document.querySelector('#rehearsal-piano-close')!.addEventListener('click',()=>{if(this.sys.isActive()){this.stand();world.focus();}});
    window.__rehearsalPreview={getState:()=>({ready:true,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,mode:this.mode,seated:this.seated===null?null:seats[this.seated].id,seats,nearest:this.nearest(),notes:this.piano.active,notesPlayed:this.piano.notesPlayed,hand:playerInventory.hand,message:this.message})};world.focus();
  }
  private nearest(){
    const candidates=[...seats.map((s,i)=>({kind:'seat' as const,index:i,x:s.x,y:s.approachY})),{kind:'piano' as const,index:0,x:536,y:246},{kind:'podium' as const,index:0,x:320,y:219}];
    return candidates.filter(t=>Math.hypot(this.x-t.x,this.y-t.y)<25).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0];
  }
  private stand(){
    if(this.mode==='walk')return;
    const seat=this.seated===null?undefined:seats[this.seated];
    const exit=this.mode==='piano'?{x:536,y:246}:seat?{x:seat.x,y:seat.approachY}:{x:320,y:219};
    if(this.mode==='piano')releaseDevice('piano');
    this.piano.stop();this.mode='walk';this.seated=null;const point=this.freeExit(exit);this.x=point.x;this.y=point.y;this.facing=0;
    (document.querySelector('#rehearsal-piano') as HTMLElement).hidden=true;this.message='靠近座位或琴凳按 E。';this.input.keyboard?.resetKeys();
  }
  private freeExit(exit:{x:number;y:number}){
    const people=onlineWorld()?.bridge.players??[];
    const candidates=[exit,...[8,16,24].flatMap(d=>[{x:exit.x+d,y:exit.y},{x:exit.x-d,y:exit.y},{x:exit.x,y:exit.y+d}])];
    return candidates.find(point=>this.canWalk(point.x,point.y)&&!people.some(p=>p.role!==onlineWorld()?.bridge.user?.role&&p.scene==='rehearsal'&&Math.abs(p.x-point.x)<18&&Math.abs(p.y-point.y)<10))??exit;
  }
  private interact(){
    if(this.mode!=='walk'){this.stand();return;}
    const t=this.nearest();if(!t)return;
    if(t.kind==='piano'&&useDevice('piano',()=>this.interact()))return;
    if(t.kind==='piano'&&playerInventory.hand){this.message='手中有物品，先在其他场景放好再弹琴。';return;}
    this.returnPoint={x:this.x,y:this.y};this.mode=t.kind;this.facing=2;this.input.keyboard?.resetKeys();
    if(t.kind==='seat'){this.seated=t.index;this.x=seats[t.index].x;this.y=seats[t.index].y;this.message='坐在谱台前，E / E / Esc 起身。';}
    if(t.kind==='piano'){this.x=536;this.y=223;(document.querySelector('#rehearsal-piano') as HTMLElement).hidden=false;this.message='Z 行与 Q 行弹琴，可同时按多个键。↑ / ↓ 切换音区，Esc 起身。';}
    if(t.kind==='podium'){this.x=320;this.y=181;this.facing=0;this.message='站上指挥台，面向排练座位。E / Esc 下台。';}
  }
  private canWalk(x:number,y:number){
    if(x<45||x>600||y<179||y>347)return false;
    if(x>472&&x<600&&y<232)return false;
    if(x>278&&x<362&&y<198)return false;
    return !seats.some(s=>Math.abs(x-s.x)<20&&((y>s.y-14&&y<s.y+14)||(y>s.y-45&&y<s.y-31)));
  }
  update(_time:number,delta:number){
    if(!this.actor)return;let moving=false;
    // Recover old saved positions that landed inside a chair after standing.
    if(this.mode==='walk'&&!this.canWalk(this.x,this.y)){
      const chair=seats.find(s=>Math.abs(this.x-s.x)<20&&Math.abs(this.y-s.y)<20);
      const exit=chair?{x:chair.x,y:chair.approachY}:this.x>472&&this.y<232?{x:536,y:246}:undefined;
      if(exit){const point=this.freeExit(exit);this.x=point.x;this.y=point.y;}
    }
    const focused=[document.querySelector('.world'),this.game.canvas].includes(document.activeElement);
    if(this.mode==='walk'&&focused){
      const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy),ox=this.x,oy=this.y;if(this.canWalk(this.x+dx*step,this.y))this.x+=dx*step;if(this.canWalk(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;moving=this.x!==ox||this.y!==oy;}
    }
    this.actor.draw(this.x,this.y,this.facing,moving,delta,this.mode==='seat'||this.mode==='piano',this.y+1,undefined,this.mode==='piano'?this.piano.active.length?2:1:0);
    this.backs.forEach((back,i)=>back.setVisible(this.seated===i).setDepth(seats[i].y+2));
    this.chairs.forEach((chair,i)=>chair.setDepth(this.seated===i?seats[i].y-1:seats[i].y+10));
    const t=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled=this.mode==='walk'&&!t;button.textContent=this.mode!=='walk'?this.mode==='podium'?'下指挥台':'起身':t?t.kind==='seat'?`坐到 ${seats[t.index].id}`:t.kind==='piano'?'坐下弹钢琴':'上指挥台':'靠近椅子或琴凳';
    document.querySelector('#mode')!.textContent={walk:moving?'在排练厅走动':'站在排练厅',seat:`坐在 ${this.seated===null?'':seats[this.seated].id}`,piano:'正在弹钢琴',podium:'站在指挥台'}[this.mode];
    document.querySelector('#hint')!.textContent=this.message;
    document.querySelector('#rehearsal-state')!.textContent=`前排 4 席 · 后排 6 席 · 钢琴 ${this.piano.notesPlayed} 次触键`;
    document.querySelector('#guide-title')!.textContent='排练厅 · WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent=this.mode==='piano'?'Z / Q 两排弹琴 · ↑↓ 切换音区 · Esc 起身':this.mode!=='walk'?'E / Esc 起身':t?`E · ${button.textContent}`:'前排四席 · 后排六席 · 右侧钢琴';
  }
}
