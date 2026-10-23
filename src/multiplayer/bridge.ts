import {releaseScene} from '../scene-gate';
import Phaser from 'phaser';
import geometry from '../../shared/interactions.json';
import { project,visualFacing,type Facing } from '../layout';
import { playerInventory } from '../player-inventory';
import {seatSurface} from '../seating';
import {canWorkAt} from '../workstations';
import { TeamAvatar } from './avatar';
import { preloadCharacter } from '../character-assets';
import type { Player,Role,User } from './types';
import {onlineWorld} from './world-client';
import {shouldEnableGameKeyboard} from '../keyboard-gate.mjs';
import {traceInteraction,interactionDiagnostics} from '../interaction-diagnostics';
// Existing rooms retain their local object/gameplay controllers. This adapter is
// the sole boundary between their coordinates and the multiplayer presentation.
type Room=Phaser.Scene&Record<string,any>;
const previewKeys:Record<string,string>={manner:'__memoryPlacePreviews',hutong:'__hutongPreview',hawaii:'__hawaiiPreview',rest:'__restPreview',pop:'__popPreview',bathroom:'__bathroomPreview',concert:'__concertPreview',arcade:'__arcadePreview',noodle:'__noodlePreview',gym:'__gymPreview',dance:'__dancePreview',perler:'__perlerPreview',rehearsal:'__rehearsalPreview',elevator:'__elevatorPreview',subway:'__subwayPreview',ktv:'__ktvPreview',yousheng:'__memoryPlacePreviews',google:'__memoryPlacePreviews',meeting:'__memoryPlacePreviews',street:'__memoryPlacePreviews',campus:'__memoryPlacePreviews'};
export class MultiplayerBridge{
  user:User|null=null;players:Player[]=[];onlineRoles:Role[]=[];controller=true;connected=false;
  npcEpoch=0;claimedRoles:Role[]=[];
  transitioning=false;
  navigationRecovery=false;
  pendingSpawn:Player|null=null;
  travelId:string|undefined;
  private views=new Map<Phaser.Scene,Map<Role,TeamAvatar>>();private previous=new Map<string,{x:number;y:number}>();private mirrors=new Map<Phaser.Scene,Map<Role,TeamAvatar>>();
  private movedAt=new Map<string,number>();
  private remotePositions=new Map<Role,{x:number;y:number;scene:string;seat:string|null}>();
  private syncTimer:ReturnType<typeof setTimeout>|null=null;
  constructor(readonly game:Phaser.Game){
    void preloadCharacter('laura').catch(()=>{});
    game.events.on(Phaser.Core.Events.POST_STEP,(_time:number,delta:number)=>this.draw(delta||16));
    // Capture-phase sync runs before Phaser's bubble listener, so login/chat fields keep WASD/arrows.
    const sync=()=>this.syncKeyboardGate();
    const gate=(e:KeyboardEvent)=>{
      sync();
      if(e.code==='KeyE'&&!e.repeat){const scene=this.active,target=document.querySelector<HTMLButtonElement>('#interact');traceInteraction('key',{scene:scene?.sys.settings.key,focus:document.activeElement?.tagName,controller:this.controller,connected:this.connected,transitioning:this.transitioning,recovery:this.navigationRecovery,keyboard:scene?.input.keyboard?.enabled,input:scene?.input.enabled,target:target?.textContent,disabled:target?.disabled});queueMicrotask(()=>traceInteraction('key-result',{prevented:e.defaultPrevented}));}
      if(this.user?.role&&(!this.controller||!this.connected||this.transitioning||this.navigationRecovery)&&[document.querySelector('.world'),game.canvas].includes(document.activeElement)&&['KeyE','KeyF','Space','KeyV'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}
    };
    window.addEventListener('keydown',gate,true);
    (window as any).__interactionDiagnostics=interactionDiagnostics;
    window.addEventListener('keyup',sync,true);
    document.addEventListener('focusin',sync,true);
    document.addEventListener('focusout',sync,true);
    game.events.once('destroy',()=>{
      delete (window as any).__interactionDiagnostics;
      window.removeEventListener('keydown',gate,true);
      window.removeEventListener('keyup',sync,true);
      document.removeEventListener('focusin',sync,true);
      document.removeEventListener('focusout',sync,true);
      if(this.syncTimer)clearTimeout(this.syncTimer);
    });
  }
  /** Enable Phaser key capture/movement only with .world (or canvas) focus and no typing UI. */
  private syncKeyboardGate(){
    const scene=this.active;
    const enabled=!!scene&&!this.transitioning&&!this.navigationRecovery&&shouldEnableGameKeyboard({
      activeElement:document.activeElement,
      world:document.querySelector('.world'),
      canvas:this.game.canvas,
      dialogOpen:!!document.querySelector('dialog[open]'),
      controller:this.controller,
      userHasRole:!!this.user?.role,
      connected:this.connected,
    });
    // The manager belongs to the game, even between scene lifetimes. A scene
    // lookup cannot guard global WASD capture while loading or paused.
    if(this.game.input.keyboard)this.game.input.keyboard.preventDefault=enabled;
    const keyboard=scene?.input.keyboard;
    if(keyboard){if(!enabled&&keyboard.enabled)keyboard.resetKeys();keyboard.enabled=enabled;}
  }
  get active(){return this.game.scene.getScenes(true).find(s=>s.sys.settings.key in previewKeys) as Room|undefined;}
  state():Player|null{
    const scene=this.active;if(!scene)return null;
    const key=scene.sys.settings.key,previews=window as unknown as Record<string,any>,preview=previewKeys[key]==='__memoryPlacePreviews'?previews.__memoryPlacePreviews?.[key]:previews[previewKeys[key]],windowState=preview?.getState();
    if(!windowState?.ready)return null;
    const seat=windowState.seatedAt??windowState.seated??(windowState.mode==='rest'?`bench-${scene.machine}`:windowState.mode==='sit'?'bench':windowState.mode==='piano'?'piano':null);
    const old=this.previous.get(key),moving=old?Math.hypot(windowState.x-old.x,windowState.y-old.y)>.03:false;
    if(moving)this.movedAt.set(key,performance.now());
    const role=this.user?.role||'laura';
    const mode=windowState.mode??scene.mode??'walk',activity=['hutong','hawaii'].includes(key)?(seat?(canWorkAt(role,key,String(seat))?'working':'sit'):'walk'):['standing','walking'].includes(mode)?'walk':mode;
    return {role,name:role,scene:key,x:windowState.x,y:windowState.y,facing:windowState.facing??scene.facing??0,moving:moving||performance.now()-(this.movedAt.get(key)||0)<100||windowState.mode==='run',seat:seat===null?null:String(seat),hand:playerInventory.hand,revision:this.user?.revision||0,activity,travelId:this.travelId};
  }
  apply(p:Player){const scene=this.active;if(!scene||scene.sys.settings.key!==p.scene)return;if('actorX' in scene){scene.actorX=p.x;scene.actorY=p.y;}else{scene.x=p.x;scene.y=p.y;}scene.facing=p.facing;if(['manner','yousheng','google','meeting','street','campus'].includes(p.scene)){scene.seated=p.seat;scene.mode=p.seat?'sit':'walk';}this.previous.set(p.scene,{x:p.x,y:p.y});this.movedAt.set(p.scene,0);}
  stand(){const s=this.active;if(!s)return;if(typeof s.stand==='function')s.stand();else if(typeof s.stop==='function')s.stop();}
  clearTransition(){this.transitioning=false;this.navigationRecovery=false;this.pendingSpawn=null;if(this.syncTimer){clearTimeout(this.syncTimer);this.syncTimer=null;}}
  screen(p:Player){const scene=this.active,office=['hutong','hawaii'].includes(p.scene),reverse=office&&!!scene?.reverse;return {...project(p,reverse),facing:visualFacing(p.facing as Facing,reverse)};}
  private draw(delta:number){
    this.syncKeyboardGate();
    const scene=this.active;let local=this.state();if(!scene||!local)return;
    if(this.pendingSpawn?.scene===local.scene){this.apply(this.pendingSpawn);local=this.state()!;this.pendingSpawn=null;this.transitioning=false;releaseScene();if(this.syncTimer){clearTimeout(this.syncTimer);this.syncTimer=null;}}
    const self=this.pendingSpawn??this.players.find(p=>p.role===this.user?.role);
    scene.input.enabled=!this.transitioning&&!this.navigationRecovery&&(!this.user?.role||this.controller&&this.connected);
    // Only a viewer tab (or the initial spawn) follows the server's scene. The controlling tab is authoritative;
    // a stale/remote copy (other serverless instance, offline double) must never yank it to another room.
    if(this.user?.role&&self&&self.scene!==local.scene&&!this.transitioning&&(!this.controller||this.pendingSpawn)){
      this.transitioning=true;this.pendingSpawn=self;
      if(this.syncTimer)clearTimeout(this.syncTimer);
      this.syncTimer=setTimeout(()=>{this.transitioning=false;this.syncTimer=null;},12000);
      window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:self.scene==='hutong'?'culture':self.scene}));return;
    }
    if(this.user?.role&&!this.controller&&self?.scene===local.scene){this.apply(self);local={...self};}
    // Small feet footprints block entry, while an overlapping spawn can move out.
    const prev=this.previous.get(local.scene);
    const atX=local.x,atY=local.y;
    const belt=local.scene==='gym'&&atY<143&&[225,320,415].some(cx=>Math.abs(atX-cx)<31);
    const deviceLock=scene.mode==='run'||scene.mode==='curl'||scene.mode==='piano'||scene.mode==='scooter'||scene.mode==='scooter-basket'||scene.mode==='skateboard'||scene.mode==='skate-sit'||belt;
    if(prev&&this.controller&&local.seat===null&&!deviceLock&&this.players.some(p=>p.role!==this.user?.role&&p.scene===local!.scene&&Math.abs(p.x-local!.x)<18&&Math.abs(p.y-local!.y)<10&&Math.hypot(local!.x-p.x,local!.y-p.y)<Math.hypot(prev.x-p.x,prev.y-p.y))){this.apply({...local,...prev});local={...local,...prev,moving:false};}
    this.previous.set(local.scene,{x:local.x,y:local.y});
    if(!this.views.has(scene)){this.views.set(scene,new Map());scene.events.once('shutdown',()=>{this.views.get(scene)?.forEach(v=>v.destroy());this.views.delete(scene);});}
    const views=this.views.get(scene)!;const selfRole=this.user?.role??'laura',visible=this.players.filter(p=>p.scene===local!.scene&&p.role!==selfRole);
    visible.push({...local,role:this.user?.role??'laura'});
    for(const [id,v] of views)if(!visible.some(p=>p.role===id))v.hide();
    for(const [id,v] of this.mirrors.get(scene)??[])if(!visible.some(p=>p.role===id))v.hide();
    for(const p of visible){
      let view=views.get(p.role);if(!view){view=new TeamAvatar(scene,p.role);views.set(p.role,view);}
      const own=p.role===(this.user?.role??'laura');
      let rendered=p;
      if(!own){const old=this.remotePositions.get(p.role);const alpha=1-Math.exp(-Math.min(delta,100)/80);const continuous=old&&old.scene===p.scene&&old.seat===p.seat&&Math.hypot(p.x-old.x,p.y-old.y)<80;const position={x:continuous?old.x+(p.x-old.x)*alpha:p.x,y:continuous?old.y+(p.y-old.y)*alpha:p.y,scene:p.scene,seat:p.seat};this.remotePositions.set(p.role,position);rendered={...p,...position};}
      const point=this.screen(rendered),office=['hutong','hawaii'].includes(p.scene);
      const doorOpen=p.scene==='bathroom'&&p.seat?(onlineWorld()?.objects.get('bathroom:door-'+p.seat)?.open??scene.open?.[Number(p.seat)]??false):true;
      const showName=!(p.scene==='bathroom'&&p.seat&&!doorOpen);
      const height=p.scene==='concert'&&p.seat?({A:54,B:61.44,C:66}[p.seat[0]]??61.44):['perler','noodle','arcade'].includes(p.scene)&&p.seat?54:61.44;
      const chairLayer=office||['google','meeting'].includes(p.scene);
      view.draw(p,point.x,point.y,point.facing,delta,chairLayer,height,p.scene==='bathroom'&&p.seat?196:p.scene==='rehearsal'&&p.activity==='podium'?191:point.y+(p.scene==='arcade'&&p.seat?7:p.scene==='perler'&&p.seat?6:p.scene==='noodle'&&p.seat?4:1),showName,own&&this.controller?scene.mode:p.activity??'',office&&p.seat?point.y-(point.facing===0?17:27):seatSurface(p.scene,p.seat));
      if(p.scene==='dance'&&view.ready){
        if(!this.mirrors.has(scene)){this.mirrors.set(scene,new Map());scene.events.once('shutdown',()=>{this.mirrors.get(scene)?.forEach(v=>v.destroy());this.mirrors.delete(scene);});}
        const mirrors=this.mirrors.get(scene)!;let mirror=mirrors.get(p.role);
        if(!mirror){mirror=new TeamAvatar(scene,p.role);mirror.setMask(scene.mirrorMask);mirrors.set(p.role,mirror);}
        mirror.draw(p,point.x,Math.round(130-(point.y-177)*.25),p.facing===0?2:p.facing===2?0:p.facing,delta,false,44,-50,false,p.activity??'');
        if(point.x<136||point.x>504)mirror.hide();
      }
    }
    const suppress=new Set([...this.onlineRoles,...this.claimedRoles,...this.players.map(p=>p.role)]);if(this.user?.role)suppress.add(this.user.role);
    if(['concert','rehearsal'].includes(local.scene)){
      const seats=Object.entries((geometry as any)[local.scene].seats).filter(([id])=>id!=='piano');
      seats.forEach(([id,spec]:[string,any],i:number)=>{const occupied=visible.some(p=>p.seat===id);scene.chairs?.[i]?.setDepth(spec.at[1]+(occupied?-1:10));scene.backs?.[i]?.setVisible(local.scene==='concert'||occupied).setDepth(spec.at[1]+2);});
    }
    scene.officeGuest?.suppress?.(suppress);
    if(scene.aniGuest){
      const sid=this.user?.role==='sid'?local:this.players.find(p=>p.role==='sid'&&p.scene==='hutong');
      scene.aniGuest.setWorker(sid,local);
    }
  }
}
