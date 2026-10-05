import {gachaReady,registerGachaTextures} from '../gacha-assets';
import {ensureCollectible} from '../collectible-art';
import {canWorkAt} from '../workstations';
import Phaser from 'phaser';
import {characterRegistry,characterImage,type AvatarRole} from '../character-assets';
import {items,type ItemName} from '../player-inventory';
import {SideWalkLegs,sideUpperFrame,heldSideFrame} from '../side-walk-legs';
import {HeldItemView} from '../held-item';
import type {SpriteFrame} from '../frames';
import type {Player} from './types';

export class TeamAvatar{
 ready=false;private body:Phaser.GameObjects.Image;private upper:Phaser.GameObjects.Image;private prop:Phaser.GameObjects.Image;private arm:Phaser.GameObjects.Image;private label:Phaser.GameObjects.Text;
 private time=0;private direction=-1;private dead=false;private legs:SideWalkLegs;private held:HeldItemView;
 private data;private frameName='';private masked=false;
 constructor(private scene:Phaser.Scene,readonly role:AvatarRole,approvedLaura=false){
  this.data=approvedLaura&&role==='laura'?characterRegistry.blackLaura:characterRegistry.members[role];
  this.body=scene.add.image(0,0,'__WHITE').setVisible(false);this.upper=scene.add.image(0,0,'__WHITE').setVisible(false);this.prop=scene.add.image(0,0,'__WHITE').setVisible(false);this.arm=scene.add.image(0,0,'__WHITE').setVisible(false);
  this.legs=new SideWalkLegs(scene);this.held=new HeldItemView(scene);
  this.label=scene.add.text(0,0,role[0].toUpperCase()+role.slice(1),{fontSize:'9px',fontFamily:'Consolas',color:'#f2ecd8',stroke:'#202723',strokeThickness:2}).setOrigin(.5,1).setVisible(false);
  const sources=[...new Set([...this.data.frames,...this.data.carryFrames,...this.data.officeFrames].map(f=>f.source))];
  Promise.all([gachaReady(),Promise.all(sources.map(async id=>[id,await characterImage(id)] as const))]).then(([,images])=>{
   if(this.dead||!scene.sys.game)return;registerGachaTextures(scene);
   for(const [id,image]of images){const key='team-v3-'+id;if(!scene.textures.exists(key))scene.textures.addImage(key,image);}
   [this.data.frames,this.data.carryFrames,this.data.officeFrames].forEach((frames,part)=>frames.forEach((frame,index)=>{
    const texture=scene.textures.get('team-v3-'+frame.source),[x,y,w,h]=frame.rect,name='pose-'+part+'-'+index;
    if(!texture.has(name)){texture.add(name,0,x,y,w,h);texture.add('upper-'+part+'-'+index,0,x,y,w,Math.round(h*.72));
     if(frame.grip){const [gx,gy]=frame.grip,ax=Math.max(0,gx-12),ay=Math.max(0,gy-12);texture.add('arm-'+part+'-'+index,0,x+ax,y+ay,Math.min(16,w-ax),Math.min(18,h-ay));}
    }
   }));this.ready=true;
  }).catch(()=>{if(!this.dead)this.label.setText('素材加载失败');});
 }
 hide(){[this.body,this.upper,this.prop,this.arm,this.label].forEach(x=>x.setVisible(false));this.legs.hide();this.held.hide();}
 setMask(mask:Phaser.Display.Masks.GeometryMask){this.masked=true;[this.body,this.upper,this.prop,this.arm].forEach(image=>image.setMask(mask));}
 get pose(){return this.frameName;}
 draw(player:Omit<Player,'role'>&{role:AvatarRole},x:number,y:number,direction:number,delta:number,office=false,height=61.44,depth=y+1,label=true,mode='',seatSurface?:number,previewPhase?:number){
  if(!this.ready)return;
  const moving=player.moving||mode==='run';
  this.time=moving&&this.direction===direction?this.time+Math.min(delta,100):0;this.direction=direction;
  if(previewPhase!==undefined)this.time=previewPhase*125;
  const data=this.data,seated=!!player.seat,holding=!!player.hand,front=direction===0,back=direction===2,phase=previewPhase??Math.floor(this.time/125)%4;
  const working=office&&seated&&(player.scene==='review'||canWorkAt(player.role,player.scene,player.seat));
  let part=0,index=front?0:back?2:1;
  if(holding){part=1;index=seated?(back?5:front?4:25):moving?(front?data.carryFrontLoop[phase%4]:back?data.carryBackLoop[phase%4]:data.carryRightLoop[(previewPhase??Math.floor(performance.now()/(data.carrySideFrameMs??125)))%data.carryRightLoop.length]):(front?0:back?2:24);}
  else if(working){part=2;index=(back?2:0)+(previewPhase===undefined?Math.floor(performance.now()/250):previewPhase)%2;}
  else if(mode==='piano'){part=0;index=6+(previewPhase===undefined?Math.floor(performance.now()/250):previewPhase)%2;}
  else if(seated)index=back?5:front?4:39;
  else if(mode==='run')index=data.runLoop?data.runLoop[(previewPhase??Math.floor(this.time/(data.runFrameMs??170)))%data.runLoop.length]:62+(previewPhase===undefined?Math.floor(performance.now()/140):previewPhase)%2;
  else if(mode==='dance'||mode==='practice')index=(back?54:46)+(previewPhase===undefined?Math.floor(performance.now()/400):previewPhase)%2;
  else if(mode==='curl')index=30+(previewPhase===undefined?Math.floor(performance.now()/650):previewPhase)%2;
  else if(moving)index=front?8+phase%4:back?16+phase%4:data.sideWalkLoop?data.sideWalkLoop[(previewPhase??Math.floor(this.time/(data.sideWalkFrameMs??250)))%data.sideWalkLoop.length]:24+(data.approvedLegacy?sideUpperFrame(this.time):Math.floor(this.time/125)%6);
  if(data.approvedLegacy&&holding&&moving&&!front&&!back)index=18+heldSideFrame(this.time);
  const frame=(part===2?data.officeFrames:part?data.carryFrames:data.frames)[index],key='team-v3-'+frame.source,[sx,sy,w,h]=frame.rect;
  // Locomotion scale follows the head landmark across the entire cycle.
  if(seated&&height===61.44)height=characterRegistry.seatedHeight;
  const scale=height/frame.referenceHeight,flip=direction===3,pivot=flip?1-frame.pivotX:frame.pivotX;
  if(seated&&seatSurface!==undefined)y=seatSurface+(h-frame.seat[1])*scale;
  // Move the front-facing seated worker toward the desk; the monitor covers part of the hands.
  if(seated&&office&&!holding&&front)y-=height*.03+1;
  y+=height*(frame.offsetYRatio??0);
  this.hide();this.frameName=frame.name;
  this.body.setTexture(key,'pose-'+part+'-'+index).setOrigin(pivot,1).setScale(scale*(frame.scaleXRatio??1),scale).setFlipX(flip).setPosition(Math.round(x),Math.round(y)).setDepth(depth).setVisible(true);
  if(seated&&office){
   if(back)this.body.setTexture(key,'upper-'+part+'-'+index).setOrigin(pivot,h/Math.round(h*.72));
   else this.upper.setTexture(key,'upper-'+part+'-'+index).setOrigin(pivot,0).setScale(scale).setFlipX(flip).setPosition(Math.round(x),Math.round(y-h*scale)).setDepth(depth+3).setVisible(true);
  }
  const nativeFrame:SpriteFrame={name:'pose-'+part+'-'+index,x:sx,y:sy,width:w,height:h,referenceHeight:frame.referenceHeight,pivotX:frame.pivotX};
  if(data.approvedLegacy&&moving&&!front&&!back&&!this.masked)this.legs.draw(this.body,nativeFrame,height,direction,this.time);
  if(player.hand?.startsWith('拼豆·')&&!this.scene.textures.exists('bead-item-'+player.hand.slice(3)))void ensureCollectible(this.scene,player.hand).catch(()=>{});
  const item=items[player.hand as ItemName];
  if(item&&frame.grip&&sceneTexture(this.scene,item.texture)){
   if(frame.slot&&!this.masked)this.held.draw(this.body,key,nativeFrame,frame.slot,height,item,depth,direction);
   else{
    const [gx,gy]=frame.grip,sign=flip?-1:1,out=frame.gripSide*sign;
    const px=x+(gx-w*frame.pivotX)*scale*(frame.scaleXRatio??1)*sign,py=y+(gy-h)*scale;
    const propFlip=out!==(item.grip.x>.5?-1:1);
    this.prop.setTexture(item.texture,item.frame).setDisplaySize(item.width,item.height).setOrigin(propFlip?1-item.grip.x:item.grip.x,item.grip.y).setFlipX(propFlip).setPosition(px,py).setDepth(depth+(office&&seated?3.1:.1)).setVisible(true);
    if(back){const ax=Math.max(0,gx-12),ay=Math.max(0,gy-12);this.arm.setTexture(key,'arm-'+part+'-'+index).setOrigin(flip?1:0,0).setScale(scale).setFlipX(flip).setPosition(x+(ax-w*frame.pivotX)*scale*sign,y+(ay-h)*scale).setDepth(depth+.2).setVisible(true);}
   }
  }
  this.label.setPosition(x,y-h*scale-3).setDepth(850).setVisible(label);
 }
 destroy(){this.dead=true;[this.body,this.upper,this.prop,this.arm,this.label].forEach(x=>x.destroy());this.legs.destroy();this.held.destroy();}
}
function sceneTexture(scene:Phaser.Scene,key:string){return scene.textures.exists(key);}

