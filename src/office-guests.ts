import Phaser from 'phaser';
import celine from '../assets/metadata/celine-v1.json';
import {characterRegistry,characterSource} from './character-assets';
import { canWalk, project, visualFacing, type Facing, type Workstation } from './layout';
import {onlineWorld} from './multiplayer/world-client';

type Identity='celine';
type Pose={rect:number[];name:string};
/** World px/s. Keep in sync with server/celine.mjs `celineWalk`. */
const WALK=108;
const urls={celine:new URL('../assets/npcs/celine-v1.png',import.meta.url).href};
export function pickOfficeGuest(roll:number):Identity|null{return roll<.1?'celine':null;}
export function pickCelineQuestion(roll:number){return '';}
export function preloadOfficeGuests(scene:Phaser.Scene){
 for(const [id,url] of Object.entries(urls))if(!scene.textures.exists(`office-${id}`))scene.load.image(`office-${id}`,url);
 const motion=characterRegistry.members.celine;
 for(const source of new Set(motion.sideWalkLoop?.map(index=>motion.frames[index].source))){
  if(!scene.textures.exists(`office-motion-${source}`))scene.load.image(`office-motion-${source}`,characterSource(source));
 }
}
const instances:OfficeGuest[]=[];
declare global{interface Window{__officeGuestsPreview?:{getState:()=>unknown}}}

export class OfficeGuest{
  private id:Identity|null=null;
  private seat!:Workstation;
  private x=0;private y=0;private facing:Facing=0;
  private mode:'seated'|'walking'|'standing'='seated';
  private remaining=0;private motion=0;private returning=false;
  private target={x:0,y:0};
  private body:Phaser.GameObjects.Image;private upper:Phaser.GameObjects.Image;
  private reverse=false;private visible=true;
  private suppressed=false;
  private speech:Phaser.GameObjects.Text;private speechBox:Phaser.GameObjects.Rectangle;
  private speechRemaining=45000+Math.random()*45000;private speechVisible=0;private lastQuestion='';
  constructor(private scene:Phaser.Scene,private hawaii:boolean,private seats:Workstation[]){
    for(const id of ['celine'] as Identity[]){
      const frames=celine.frames;
      const texture=scene.textures.get(`office-${id}`);
      frames.forEach((frame,index)=>{const [x,y,w,h]=frame.rect;if(!texture.has(`pose-${index}`)){
        texture.add(`pose-${index}`,0,x,y,w,h);texture.add(`upper-${index}`,0,x,y,w,Math.round(h*.72));
      }});
    }
    this.body=scene.add.image(0,0,'office-celine').setVisible(false);
    const motion=characterRegistry.members.celine;
    if(motion.sideWalkLoop)for(const index of motion.sideWalkLoop){const frame=motion.frames[index],texture=scene.textures.get(`office-motion-${frame.source}`),[x,y,w,h]=frame.rect;if(!texture.has(`motion-${index}`))texture.add(`motion-${index}`,0,x,y,w,h);}
    this.upper=scene.add.image(0,0,'office-celine').setVisible(false);
    this.speechBox=scene.add.rectangle(0,0,1,1,0xf2e9cf).setStrokeStyle(1,0x353f35).setOrigin(.5,1).setDepth(930).setVisible(false);
    this.speech=scene.add.text(0,0,'',{fontFamily:'Microsoft YaHei',fontSize:'10px',color:'#2b302d'}).setOrigin(.5,1).setDepth(931).setVisible(false);
    this.reroll();instances.push(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{const i=instances.indexOf(this);if(i>=0)instances.splice(i,1);});
    window.__officeGuestsPreview={getState:()=>instances.map(n=>n.snapshot())};
  }
  enter(occupiedSeat:string|null){if(!this.hawaii)this.reroll();if(this.id&&occupiedSeat===this.seat.id&&this.mode==='seated')this.leave();}
  private reroll(){
    this.id=this.hawaii?'celine':pickOfficeGuest(Math.random());
    const home=this.hawaii?'HL3':'L4';
    this.seat=this.seats.find(s=>s.id===home)!;
    this.x=this.seat.foot.x;this.y=this.seat.foot.y;this.facing=this.seat.facing;
    this.mode=this.hawaii?'seated':'standing';if(!this.hawaii){this.x=480;this.y=194;this.facing=0;}this.returning=false;this.motion=0;this.remaining=55000;
    this.speechVisible=0;this.lastQuestion='';this.speechRemaining=45000+Math.random()*45000;
    this.draw(this.reverse,this.visible);
  }
  snapshot(){return {id:this.id,scene:this.scene.sys.settings.key,active:this.scene.sys.isActive(),mode:this.mode,seat:this.seat.id,x:this.x,y:this.y,screen:project({x:this.x,y:this.y},this.reverse),returning:this.returning,speech:this.speechVisible>0?this.lastQuestion:null};}
  suppress(roles:Set<string>){this.suppressed=!!this.id&&roles.has(this.id);if(this.suppressed){this.body.setVisible(false);this.upper.setVisible(false);}}
  occupies(id:string){return !!this.id&&!this.suppressed&&this.mode==='seated'&&this.seat.id===id;}
  blocks(x:number,y:number){return !!this.id&&!this.suppressed&&this.mode!=='seated'&&Math.abs(x-this.x)<19&&Math.abs(y-this.y)<11;}
  near(_x:number,_y:number){return false;}
  get prompt(){return this.mode==='seated'?'Celine 起身':'Celine 回座';}
  private leave(player?:{x:number;y:number}){
    this.x=this.seat.stand.x;this.y=this.seat.stand.y;this.mode='walking';this.returning=false;
    if(player&&Math.hypot(player.x-this.x,player.y-this.y)<25){
      const clear=[{x:this.x-30,y:this.y},{x:this.x+30,y:this.y},{x:this.x,y:194}].find(p=>canWalk(p,this.seats)&&Math.hypot(player.x-p.x,player.y-p.y)>25);
      if(clear){this.x=clear.x;this.y=clear.y;}
    }
    this.target={x:Math.max(110,Math.min(552,this.x-85)),y:194};this.remaining=0;this.motion=0;
  }
  interact(_player:{x:number;y:number}){/* Celine acts autonomously. */}
  update(delta:number,player:{x:number;y:number;seat:string|null}){
    const shared=onlineWorld();
    if(shared?.bridge.user?.role){
      const visitor=shared.celine;this.id=visitor?.scene===this.scene.sys.settings.key?'celine':null;if(!this.id){this.speechVisible=0;return;}
      this.mode=visitor.mode;const alpha=1-Math.exp(-Math.min(delta,100)/80);this.x=this.mode==='walking'?this.x+(visitor.x-this.x)*alpha:visitor.x;this.y=this.mode==='walking'?this.y+(visitor.y-this.y)*alpha:visitor.y;this.facing=visitor.facing;this.motion=visitor.mode==='walking'?visitor.motion+(Date.now()+shared.clockOffset-(visitor.updatedAt??Date.now())):0;this.returning=false;
      this.lastQuestion=visitor.question??'';this.speech.setText(this.lastQuestion);this.speechVisible=this.lastQuestion?6000:0;
      return;
    }
    if(!this.id)return;
    const dt=Math.min(delta,50);this.remaining-=dt;
    this.speechVisible=Math.max(0,this.speechVisible-dt);this.speechRemaining-=dt;
    if(this.speechRemaining<=0){this.lastQuestion=pickCelineQuestion(Math.random());this.speech.setText(this.lastQuestion);this.speechVisible=this.lastQuestion?6000:0;this.speechRemaining=90000+Math.random()*90000;}
    if(!this.hawaii){if(this.mode==='standing'&&this.remaining<=0){this.mode='walking';this.target={x:this.x>450?420:480,y:194};}if(this.mode==='walking'){const dx=this.target.x-this.x;if(Math.abs(dx)<1){this.mode='standing';this.remaining=15000+Math.random()*25000;}else{this.x+=Math.sign(dx)*Math.min(Math.abs(dx),dt*WALK/1000);this.facing=dx>0?1:3;this.motion+=dt;}}return;}
    if(this.mode==='seated'){if(this.remaining<=0&&Math.hypot(player.x-this.seat.stand.x,player.y-this.seat.stand.y)>25)this.leave();return;}
    if(this.mode==='standing'){
      if(this.remaining<=0){this.mode='walking';this.returning=true;this.target={...this.seat.stand};}return;
    }
    // A player borrowing the chair must still have an empty place to stand up.
    if(this.returning&&player.seat===this.seat.id)this.target={x:this.seat.stand.x-36,y:194};
    const dx=this.target.x-this.x,dy=this.target.y-this.y,d=Math.hypot(dx,dy);
    if(d<1){
      if(this.returning&&player.seat!==this.seat.id&&Math.hypot(player.x-this.seat.stand.x,player.y-this.seat.stand.y)>23){
        this.x=this.seat.foot.x;this.y=this.seat.foot.y;this.facing=this.seat.facing;this.mode='seated';this.returning=false;this.remaining=10000+Math.random()*6000;
      }else{this.mode='standing';this.remaining=3500+Math.random()*3000;}
      return;
    }
    const step=Math.min(d,dt*WALK/1000),next={x:this.x+dx/d*step,y:this.y+dy/d*step};
    if(canWalk(next,this.seats)&&Math.hypot(player.x-next.x,player.y-next.y)>22){
      this.x=next.x;this.y=next.y;this.motion+=dt;this.facing=(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?0:2) as Facing;
    }
  }
  draw(reverse:boolean,visible:boolean){
    this.reverse=reverse;this.visible=visible;
    if(!this.id||this.suppressed){this.body.setVisible(false);this.upper.setVisible(false);this.speech.setVisible(false);this.speechBox.setVisible(false);return;}
    const id=this.id,d=visualFacing(this.facing,reverse),walking=this.mode==='walking',seated=this.mode==='seated';
    let index=0;const phase=Math.floor(this.motion/125)%2;
    index=seated?(d===2?11:10):walking?(d===0?6+phase:d===2?8+phase:4+phase):d===0?0:d===2?1:2;
    const registry=celine,frame=registry.frames[index] as Pose,[, ,w,h]=frame.rect;
    const scale=61.44/(walking?h:registry.referenceHeight),p=project({x:this.x,y:this.y},reverse),key=`office-${id}`;
    const talking=visible&&this.speechVisible>0,headY=p.y-h*scale-6;
    this.speech.setPosition(p.x,headY-4).setVisible(talking);
    this.speechBox.setSize(this.speech.width+12,this.speech.height+8).setPosition(p.x,headY).setVisible(talking);
    this.body.setTexture(key,`pose-${index}`).setOrigin(.5,1).setScale(scale).setFlipX(d===3)
      .setPosition(p.x,p.y).setDepth(p.y+1).setVisible(visible);
    this.upper.setVisible(false);
    const motion=characterRegistry.members.celine;
    if(walking&&(d===1||d===3)&&motion.sideWalkLoop){
      const index=motion.sideWalkLoop[Math.floor(this.motion/(motion.sideWalkFrameMs??250))%motion.sideWalkLoop.length],frame=motion.frames[index];
      const scale=61.44/frame.referenceHeight;
      this.body.setTexture(`office-motion-${frame.source}`,`motion-${index}`).setScale(scale*(frame.scaleXRatio??1),scale).setOrigin(d===3?1-frame.pivotX:frame.pivotX,1).setPosition(p.x,p.y+61.44*(frame.offsetYRatio??0));
    }
    if(seated){
      if(d===2)this.body.setTexture(key,`upper-${index}`).setOrigin(.5,h/Math.round(h*.72));
      else this.upper.setTexture(key,`upper-${index}`).setOrigin(.5,0).setScale(scale).setPosition(p.x,p.y-h*scale).setDepth(p.y+4).setVisible(visible);
    }
  }
}
