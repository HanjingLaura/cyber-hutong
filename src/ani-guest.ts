import Phaser from 'phaser';
import {canWorkAt} from './workstations';
import { registerFrames, setSpriteFrame, type SpriteFrame } from './frames';
import { project, visualFacing, type Point } from './layout';
import positions from '../shared/guests.json';

declare global{interface Window{__aniPreview?:{getState:()=>unknown}}}
type Worker={role:string;scene:string;seat:string|null;x:number;y:number;activity?:string};
export function preloadAni(scene:Phaser.Scene){
  scene.load.image('ani-sheet',new URL('../assets/npcs/ani-v2.png',import.meta.url).href);
}

// Ani belongs to Sid: everyone in the hutong sees her while Sid works at his own desk; only Sid can interact (server enforced).
export class AniGuest{
  private image:Phaser.GameObjects.Image;
  private frames:SpriteFrame[];
  private present=false;
  private x=positions.ani.x;private y=positions.ani.y;
  private reverse=false;private visible=true;private seat:string|null=null;
  constructor(private scene:Phaser.Scene){
    this.frames=registerFrames(scene,'ani-sheet',6,1,true,{x:[0,.176,.334,.508,.681,.839,1],y:[0,1]});
    this.image=scene.add.image(0,0,'ani-sheet').setVisible(false);
    this.image.setInteractive({useHandCursor:true}).on('pointerdown',()=>window.dispatchEvent(new CustomEvent('hutong:npc-interact',{detail:'ani'})));
    scene.events.on('sleep',()=>{this.present=false;this.seat=null;this.image.setVisible(false);});
    window.__aniPreview={getState:()=>this.snapshot()};
  }
  setWorker(worker:Worker|undefined,player:Point){
    // Same rule as the server (npc-visibility.mjs): Sid, in the hutong, working at his own seat.
    const working=worker?.role==='sid'&&worker.scene==='hutong'&&(worker.activity??'working')==='working'&&canWorkAt(worker.role,worker.scene,worker.seat);
    this.present=!!working;this.seat=working?worker!.seat:null;
    this.draw(this.reverse,this.visible);
  }
  blocks(x:number,y:number,from:Point){
    return this.present&&Math.abs(x-this.x)<20&&Math.abs(y-this.y)<9
      &&Math.hypot(x-this.x,y-this.y)<=Math.hypot(from.x-this.x,from.y-this.y);
  }
  draw(reverse:boolean,visible:boolean){
    this.reverse=reverse;this.visible=visible;
    if(!this.present||!visible){this.image.setVisible(false);return;}
    const point=project({x:this.x,y:this.y},reverse);
    const facing=visualFacing(0,reverse);
    setSpriteFrame(this.image,'ani-sheet',this.frames[facing===2?1:0],61.44);
    this.image.setPosition(point.x,point.y).setDepth(point.y+1).setVisible(true);
  }
  snapshot(){return {id:'ani',owner:'sid',present:this.present,seat:this.seat,x:this.x,y:this.y,screen:project({x:this.x,y:this.y},this.reverse),visible:this.image.visible,frame:this.image.frame.name,poseCount:this.frames.length};}
}
