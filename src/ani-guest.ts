import Phaser from 'phaser';
import {canWorkAt} from './workstations';
import { registerFrames, setSpriteFrame, type SpriteFrame } from './frames';
import { canWalk, project, visualFacing, WORKSTATIONS, type Point } from './layout';

type Worker={role:string;scene:string;seat:string|null;x:number;y:number};
export function preloadAni(scene:Phaser.Scene){
  scene.load.image('ani-sheet',new URL('../assets/npcs/ani-v2.png',import.meta.url).href);
}

// A companion follows Sid's work state, rather than an unrelated random roll.
export class AniGuest{
  private image:Phaser.GameObjects.Image;
  private frames:SpriteFrame[];
  private present=false;
  private x=234;private y=194;
  private reverse=false;private visible=true;private seat:string|null=null;
  constructor(private scene:Phaser.Scene){
    this.frames=registerFrames(scene,'ani-sheet',6,1,true,{x:[0,.176,.334,.508,.681,.839,1],y:[0,1]});
    this.image=scene.add.image(0,0,'ani-sheet').setVisible(false);
    this.image.setInteractive({useHandCursor:true}).on('pointerdown',()=>window.dispatchEvent(new CustomEvent('hutong:npc-interact',{detail:'ani'})));
    scene.events.on('sleep',()=>{this.present=false;this.seat=null;this.image.setVisible(false);});
  }
  setWorker(worker:Worker|undefined,player:Point){
    const working=worker?.role==='sid'&&canWorkAt(worker.role,worker.scene,worker.seat);
    if(working&&(!this.present||this.seat!==worker!.seat)){
      const home=WORKSTATIONS.find(s=>s.id===worker!.seat)!;
      const options=[{x:home.foot.x+42,y:194},{x:home.foot.x-42,y:194},{x:home.foot.x+42,y:211},{x:home.foot.x-42,y:178}];
      const point=options.find(p=>canWalk(p))??options[0];
      this.x=point.x;this.y=point.y;
    }
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
