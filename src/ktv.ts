import Phaser from 'phaser';
import geometry from '../shared/interactions.json';
import {changeKtvPlayer,emptyKtvPlayer,ktvBeatResult,ktvLights,ktvPlayback,ktvSongs,ktvTargets,ktvWalkable,type KtvPlayer} from '../shared/ktv.mjs';
import {KtvAudio} from './ktv-audio';
import {onlineWorld,releaseDevice,sharedAction,useDevice} from './multiplayer/world-client';
import {playerInventory} from './player-inventory';
import './ktv.css';

const seats=Object.entries(geometry.ktv.seats).map(([id,s])=>({id,x:s.at[0],y:s.at[1],ax:s.approach[0],ay:s.approach[1]}));
type Target={kind:'seat'|'terminal'|'mic'|'lights';id?:string;x:number;y:number};
const labels={seat:'坐到沙发',terminal:'点歌',mic:'拿麦唱歌',lights:'切换灯光'};
declare global{interface Window{__ktvPreview?:{getState:()=>unknown}}}

export class KtvScene extends Phaser.Scene{
 private actor=false;private x=580;private y=321;private facing=2;
 private mode:'walk'|'sit'|'sing'='walk';private seated:string|null=null;
 private keys!:Record<string,Phaser.Input.Keyboard.Key>;
 private player:KtvPlayer=emptyKtvPlayer();private light=0;
 private audio=new KtvAudio();private audioEnabled=false;private audioPending=false;
 private screen!:Phaser.GameObjects.Graphics;private lighting!:Phaser.GameObjects.Graphics;
 private microphones!:Phaser.GameObjects.Graphics;
 private title!:Phaser.GameObjects.Text;private lyric!:Phaser.GameObjects.Text;
 private nextLine!:Phaser.GameObjects.Text;private screenStatus!:Phaser.GameObjects.Text;
 private menu!:HTMLDialogElement;private dock!:HTMLElement;
 private busy=false;private message='走到点歌台，按 E 点歌';private score=0;
 private hits=new Set<number>();private songSession='';private previousElapsed=0;private lastView='';private lastBeatView='';
 constructor(){super('ktv');}
 preload(){if(!this.textures.exists('ktv-room'))this.load.image('ktv-room',new URL('../assets/drafts/ktv-room-v1.png',import.meta.url).href);}
 create(){
  this.add.image(0,0,'ktv-room').setOrigin(0).setDisplaySize(640,360).setDepth(-100);
  this.screen=this.add.graphics().setDepth(-90);
  const text={fontFamily:'Microsoft YaHei, sans-serif',fontSize:'8px',color:'#f6eed8'};
  this.title=this.add.text(380,61,'KTV',{...text,fontSize:'9px'}).setDepth(-80);
  this.lyric=this.add.text(445,87,'走到右侧点歌台',{...text,fontSize:'10px'}).setOrigin(.5).setDepth(-80);
  this.nextLine=this.add.text(445,103,'点一首，一起唱',text).setOrigin(.5).setDepth(-80);
  this.screenStatus=this.add.text(380,117,'等待点歌',{...text,fontSize:'7px'}).setDepth(-80);
  this.lighting=this.add.graphics().setDepth(-70);
  this.microphones=this.add.graphics();
  const panel=this.add.graphics().setDepth(-60);panel.fillStyle(0x312c31).fillRect(598,229,7,13).fillStyle(0xd3c299).fillRect(600,232,3,4);
  this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
  const world=document.querySelector<HTMLElement>('.world')!;
  this.menu=document.createElement('dialog');this.menu.id='ktv-menu';this.menu.setAttribute('aria-labelledby','ktv-menu-title');
  this.menu.innerHTML=`<div class="ktv-heading"><h2 id="ktv-menu-title">点歌台</h2><button type="button" data-ktv-close>返回包厢</button></div><p data-ktv-now></p><div class="ktv-actions"><button type="button" data-ktv-play>暂停</button><button type="button" data-ktv-skip>切歌</button></div><h3>歌曲</h3><div class="ktv-library"></div><small>原创短曲 · 每首 32 拍 · 配合屏幕按拍唱歌</small><h3>已点歌曲</h3><ol data-ktv-queue></ol><p data-ktv-message role="status"></p>`;
  for(const song of ktvSongs){const row=document.createElement('div');row.className='ktv-song';const label=document.createElement('span');label.textContent=song.name;const detail=document.createElement('small');detail.textContent=song.bpm+' BPM';label.append(detail);const button=document.createElement('button');button.type='button';button.textContent='点歌';button.dataset.ktvSong=song.id;button.onclick=()=>void this.control('queue',song.id);row.append(label,button);this.menu.querySelector('.ktv-library')!.append(row);}
  this.menu.querySelector('[data-ktv-close]')!.addEventListener('click',()=>this.menu.close());
  this.menu.querySelector('[data-ktv-play]')!.addEventListener('click',()=>void this.control('play'));
  this.menu.querySelector('[data-ktv-skip]')!.addEventListener('click',()=>void this.control('skip'));
  this.menu.addEventListener('close',()=>{this.keys&&this.input.keyboard?.resetKeys();world.focus();});world.append(this.menu);
  this.dock=document.createElement('div');this.dock.id='ktv-dock';this.dock.innerHTML='<p id="ktv-now">等待点歌</p><button id="ktv-sound" type="button" aria-pressed="false">开启伴奏</button><div id="ktv-beat" hidden role="img" aria-label="等待歌曲开始">'+Array.from({length:8},(_,i)=>`<span aria-hidden="true">${i+1}</span>`).join('')+'</div><div id="ktv-sing-actions" hidden><button id="ktv-hit" type="button">唱一拍</button><button id="ktv-stop" type="button">放回麦克风</button></div><output id="ktv-score" aria-live="polite"></output>';world.append(this.dock);
  if(this.touch)this.message='走到右侧点歌台，点击互动点歌';
  const bind=(selector:string,fn:()=>void)=>{const element=document.querySelector(selector)!;const handler=()=>{if(this.sys.isActive()){fn();world.focus();}};element.addEventListener('click',handler);this.events.once('shutdown',()=>element.removeEventListener('click',handler));};
  bind('#interact',()=>this.interact());bind('#ktv-hit',()=>this.hit());bind('#ktv-stop',()=>this.stand());bind('#ktv-sound',()=>void this.toggleSound());
  const clear=()=>this.input.keyboard?.resetKeys();
  const action=(e:KeyboardEvent)=>{
   if(!this.sys.isActive()||e.repeat||document.querySelector('dialog[open]')||![world,this.game.canvas].includes(document.activeElement as HTMLElement))return;
   if(e.code==='KeyE'){e.preventDefault();this.interact();}
   if(e.code==='Escape'){e.preventDefault();this.stand();}
   if(e.code==='Space'&&this.mode==='sing'){e.preventDefault();this.hit();}
  };
  const visibility=()=>{if(document.hidden)this.audio.stop();else if(this.audioEnabled)void this.audio.enable().catch(()=>this.disableSound());};
  window.addEventListener('keydown',action);window.addEventListener('blur',clear);world.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility);
  this.events.on('sleep',()=>{this.stand();this.audio.stop();this.audioEnabled=false;this.dock.hidden=true;if(this.menu.open)this.menu.close();clear();});
  this.events.on('wake',()=>{this.dock.hidden=false;this.lastView='';});
  this.events.once('shutdown',()=>{this.audio.dispose();this.menu.remove();this.dock.remove();window.removeEventListener('keydown',action);window.removeEventListener('blur',clear);world.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);});
  window.__ktvPreview={getState:()=>({ready:this.actor,active:this.sys.isActive(),x:this.x,y:this.y,facing:this.facing,mode:this.mode,seated:this.seated,seats,targets:ktvTargets,nearest:this.nearest(),player:this.player,playback:ktvPlayback(this.player,this.now()),light:ktvLights[this.light],sound:this.audioEnabled,score:this.score,hits:[...this.hits],message:this.message})};
  this.actor=true;this.dock.hidden=!this.sys.isActive();world.focus();
 }
 private now(){return Date.now()+(onlineWorld()?.clockOffset??0);}
 private get touch(){return document.documentElement.classList.contains('touch-ui');}
 applyKtv(id:string,state:Record<string,unknown>){if(id==='player')this.player=state as unknown as KtvPlayer;if(id==='lights')this.light=Number(state.mode??0);this.lastView='';}
 private nearest():Target|undefined{
  const targets:Target[]=[...seats.map(s=>({kind:'seat' as const,id:s.id,x:s.ax,y:s.ay})),...Object.entries(ktvTargets).map(([kind,at])=>({kind:kind as Target['kind'],x:at[0],y:at[1]}))];
  return targets.filter(t=>Math.hypot(this.x-t.x,this.y-t.y)<27).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y))[0];
 }
 private interact(){
  if(this.mode!=='walk'){this.stand();return;}const target=this.nearest();if(!target)return;
  if(target.kind==='terminal'){this.input.keyboard?.resetKeys();this.renderMenu();this.menu.showModal();return;}
  if(target.kind==='lights'){if(sharedAction('ktv:lights','light'))return;this.light=(this.light+1)%ktvLights.length;this.message='灯光：'+ktvLights[this.light];return;}
  if(target.kind==='seat'){
   if(onlineWorld()?.bridge.players.some(p=>p.scene==='ktv'&&p.seat===target.id&&p.role!==onlineWorld()?.bridge.user?.role)){this.message='这个座位已经有人了';return;}
   const seat=seats.find(s=>s.id===target.id)!;this.mode='sit';this.seated=seat.id;this.x=seat.x;this.y=seat.y;this.facing=seat.id.startsWith('L')?1:0;
  }
  if(target.kind==='mic'){
   if(playerInventory.hand){this.message='先把手里的物品放下，再拿麦';return;}
   if(useDevice('mic',()=>this.interact()))return;
   this.mode='sing';this.x=399;this.y=205;this.facing=0;this.score=0;this.hits.clear();this.message=this.touch?'拍点亮起时，点击「唱一拍」':'跟着拍点，按 Space 唱一拍';
  }
  this.input.keyboard?.resetKeys();
 }
 stand(){
  if(this.mode==='sing'){releaseDevice('mic');[this.x,this.y]=ktvTargets.mic;}
  if(this.seated){const seat=seats.find(s=>s.id===this.seated)!;this.x=seat.ax;this.y=seat.ay;}
  this.mode='walk';this.seated=null;this.facing=0;this.input.keyboard?.resetKeys();
 }
 private async control(action:string,song?:string){
  if(this.busy||!this.sys.isActive()||this.mode!=='walk'||Math.hypot(this.x-ktvTargets.terminal[0],this.y-ktvTargets.terminal[1])>30)return;
  this.busy=true;this.renderMenu();
  try{
   const service=onlineWorld();if(service?.bridge.user?.role)await service.action('ktv:player',action,{song});else this.player=changeKtvPlayer(this.player,action,song,this.now());
   this.message=action==='queue'?'已加入点歌队列':action==='skip'?'已切歌':this.player.playing?'继续播放':'已暂停';
  }catch(error){this.message=(error as Error).message;}finally{this.busy=false;this.lastView='';this.renderMenu();}
 }
 private disableSound(){this.audioEnabled=false;this.audio.stop();this.message='伴奏未开启，请重试';}
 private async toggleSound(){
  if(this.audioPending)return;if(this.audioEnabled){this.audioEnabled=false;this.audio.stop();return;}
  this.audioPending=true;try{await this.audio.enable();if(this.sys.isActive()&&!document.hidden)this.audioEnabled=true;else this.audio.stop();}catch{this.disableSound();}finally{this.audioPending=false;}
 }
 private hit(){
  if(this.mode!=='sing')return;const playback=ktvPlayback(this.player,this.now());
  if(!playback.song||!playback.playing){this.message='等歌曲开始，再跟拍唱';return;}
  const result=ktvBeatResult(playback.elapsed,playback.song.bpm);if(result.index>=32||this.hits.has(result.index))return;
  this.hits.add(result.index);this.score+=result.points;this.message=result.grade;
 }
 private renderMenu(){
  const playback=ktvPlayback(this.player,this.now());
  this.menu.querySelector('[data-ktv-now]')!.textContent=playback.song?`${playback.playing?'正在唱':'已暂停'}：${playback.song.name}`:'还没有点歌，选一首开始';
  this.menu.querySelector('[data-ktv-message]')!.textContent=this.message;
  const list=this.menu.querySelector('[data-ktv-queue]')!;list.replaceChildren();
  for(const [index,id] of playback.queue.entries()){const item=document.createElement('li');item.textContent=(ktvSongs.find(s=>s.id===id)?.name??id)+(index===0?' · 当前':'');list.append(item);}
  if(!playback.queue.length){const item=document.createElement('li');item.textContent='队列为空';list.append(item);}
  const play=this.menu.querySelector<HTMLButtonElement>('[data-ktv-play]')!;play.textContent=playback.playing?'暂停':'继续播放';
  this.menu.querySelectorAll<HTMLButtonElement>('button:not([data-ktv-close])').forEach(button=>button.disabled=this.busy||(!button.dataset.ktvSong&&!playback.song)||(!!button.dataset.ktvSong&&playback.queue.length>=12));
 }
 update(_time:number,delta:number){
  if(!this.actor)return;const focused=[document.querySelector('.world'),this.game.canvas].includes(document.activeElement);
  this.dock.hidden=false;
  if(this.mode==='walk'&&focused&&!document.querySelector('dialog[open]')){
   const dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
   if(dx||dy){const step=108*Math.min(delta,32)/1000/Math.hypot(dx,dy);if(ktvWalkable(this.x+dx*step,this.y))this.x+=dx*step;if(ktvWalkable(this.x,this.y+dy*step))this.y+=dy*step;this.facing=dx?dx>0?1:3:dy>0?0:2;}
  }
  const now=this.now(),playback=ktvPlayback(this.player,now),song=playback.song,beat=song?playback.elapsed/(60000/song.bpm):0;
  const session=song?.id??'';if(session!==this.songSession||playback.elapsed+200<this.previousElapsed){this.songSession=session;this.hits.clear();this.score=0;}this.previousElapsed=playback.elapsed;
  if(this.audioEnabled&&song&&playback.playing&&!document.hidden)this.audio.update(song,playback.elapsed);
  this.screen.clear().fillStyle(0x102c36).fillRect(375,57,139,66);
  const line=Math.min(3,Math.floor(beat/8));this.title.setText(song?song.name:'KTV');this.lyric.setText(song?song.lines[line]:'走到右侧点歌台');this.nextLine.setText(song?song.lines[(line+1)%4]:'点一首，一起唱');
  this.screenStatus.setText(song?`${playback.playing?'播放':'暂停'} · ${song.bpm} BPM · ${Math.min(32,Math.floor(beat)+1)}/32 拍`:'等待点歌');
  const beatIndex=Math.floor(beat)%8,pulse=!!song&&playback.playing&&beat%1<.2,beatView=`${beatIndex}:${pulse}:${this.mode}:${playback.playing}`;
  if(beatView!==this.lastBeatView){this.lastBeatView=beatView;const meter=this.dock.querySelector<HTMLElement>('#ktv-beat')!;meter.hidden=this.mode!=='sing';meter.setAttribute('aria-label',song?`${playback.playing?'拍点':'已暂停'}：第 ${beatIndex+1} 拍，共 8 拍`:'等待歌曲开始');meter.querySelectorAll('span').forEach((mark,i)=>{mark.classList.toggle('is-current',!!song&&playback.playing&&i===beatIndex);mark.classList.toggle('is-pulse',pulse&&i===beatIndex);});}
  for(let i=0;i<8;i++)this.screen.fillStyle(song&&playback.playing&&Math.floor(beat)%8===i?0xf5cf7e:0x4d7d81).fillRect(470+i*5,116,3,3);
  const color=[0xffc172,0xb28bff,Math.floor(beat)%2?0x75dbd8:0xe0a0dc][this.light]??0xffc172;
  this.lighting.clear();if(this.light>0){this.lighting.fillStyle(color,.09).fillRect(0,0,640,360);for(let i=0;i<9;i++)this.lighting.fillStyle(color,.36).fillRect(90+i*57,290+(i%3)*15,4,3);}
  this.microphones.clear();const people=onlineWorld()?.bridge.players??[],localRole=onlineWorld()?.bridge.user?.role;
  const singers=people.filter(p=>p.scene==='ktv'&&p.activity==='sing'&&p.role!==localRole);if(this.mode==='sing')singers.push({x:this.x,y:this.y} as typeof singers[number]);
  for(const singer of singers)this.microphones.fillStyle(0xc6d3d4).fillRect(singer.x+8,singer.y-39,4,6).fillStyle(0x22232a).fillRect(singer.x+9,singer.y-33,2,10);
  this.microphones.setDepth(220);
  const target=this.nearest(),button=document.querySelector<HTMLButtonElement>('#interact')!;
  button.disabled=this.mode==='walk'&&!target;button.textContent=this.mode==='sing'?'放回麦克风':this.mode==='sit'?'起身':target?labels[target.kind]:'';
  document.querySelector('#mode')!.textContent='';document.querySelector('#hint')!.textContent=this.message;
  document.querySelector('#guide-title')!.textContent='WASD / 方向键移动';document.querySelector('#guide-action')!.textContent=this.mode==='sing'?'Space 唱一拍 · E 放回麦克风':this.mode==='sit'?'E / Esc 起身':target?'E · '+labels[target.kind]:'右侧点歌台点歌 · 麦克风前唱歌';
  const signature=JSON.stringify([song?.id,playback.playing,playback.queue,this.mode,this.audioEnabled,this.score,this.message,this.busy]);
  if(signature!==this.lastView){this.lastView=signature;this.dock.querySelector('#ktv-now')!.textContent=song?`${playback.playing?'正在唱':'已暂停'}：${song.name}`:this.touch?'等待点歌 · 右侧点歌台点击互动':'等待点歌 · 右侧点歌台按 E';const sound=this.dock.querySelector<HTMLButtonElement>('#ktv-sound')!;sound.textContent=this.audioEnabled?'关闭伴奏':'开启伴奏';sound.setAttribute('aria-pressed',String(this.audioEnabled));this.dock.querySelector<HTMLElement>('#ktv-sing-actions')!.hidden=this.mode!=='sing';this.dock.querySelector('#ktv-score')!.textContent=this.mode==='sing'?`${this.score} 分 · ${this.message}`:'';if(this.menu.open)this.renderMenu();}
 }
}
