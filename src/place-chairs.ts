import Phaser from 'phaser';
import geometry from '../shared/interactions.json';
import {registerFrames} from './frames';

const key='place-chair-v2',url=new URL('../assets/props/meeting-chairs-v2.png',import.meta.url).href;
export function preloadPlaceChairs(scene:Phaser.Scene,place:string){
 if(['google','meeting'].includes(place)&&!scene.textures.exists(key))scene.load.image(key,url);
}

/** Shared chair perspective; feet stay at the authoritative seat anchors. */
export class PlaceChairs{
 private chairs:{id:string;chair:Phaser.GameObjects.Image;back:Phaser.GameObjects.Image;facing:number}[]=[];
 constructor(scene:Phaser.Scene,place:string){
  if(!['google','meeting'].includes(place))return;
  const frames=registerFrames(scene,key,2,1),height=46,scale=height/Math.max(...frames.map(f=>f.height));
  const rear=frames[0],texture=scene.textures.get(key),backName='place-chair-backrest-v2';
  if(!texture.has(backName))texture.add(backName,0,rear.x,rear.y,rear.width,Math.round(rear.height*.51));
  for(const [id,seat]of Object.entries((geometry as any)[place].seats)as[string,any][]){
   const [x,y]=seat.at,far=seat.facing===2;
   scene.add.graphics().setDepth(y-1).fillStyle(0x1c2126,.22).fillEllipse(x-3,y,34,7).fillStyle(0x111923,.13).fillEllipse(x-6,y+1,40,5);
   const chair=scene.add.image(x,y,key,frames[far?0:1].name).setOrigin(.5,1).setScale(scale).setDepth(y);
   const back=scene.add.image(x,y-rear.height*scale,key,backName).setOrigin(.5,0).setScale(scale).setDepth(y+2).setVisible(false);
   if(place==='google'){chair.setTint(0xd9e0df);back.setTint(0xd9e0df);}
   this.chairs.push({id,chair,back,facing:seat.facing});
  }
 }
 update(occupied:(id:string)=>boolean){for(const seat of this.chairs)seat.back.setVisible(seat.facing===2&&occupied(seat.id));}
 getState(){return this.chairs.map(s=>({id:s.id,x:s.chair.x,y:s.chair.y,width:s.chair.displayWidth,height:s.chair.displayHeight,depth:s.chair.depth,backDepth:s.back.depth,backVisible:s.back.visible}));}
}
