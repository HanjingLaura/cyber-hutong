/** Browser + Phaser texture warmup so room switches hit cache instead of cold downloads. */
import Phaser from 'phaser';

const roomTextures:Record<string,{key:string;url:string}[]>={
 hutong:[
  {key:'wall',url:new URL('../assets/drafts/hutong-wall-view-v5.png',import.meta.url).href},
  {key:'reverse',url:new URL('../assets/drafts/hutong-reverse-view-v5.png',import.meta.url).href},
 ],
 hawaii:[{key:'hawaii-wall',url:new URL('../assets/drafts/hawaii-wall-v2.png',import.meta.url).href}],
 rest:[
  {key:'rest-shell',url:new URL('../assets/drafts/rest-room-shell-v2.png',import.meta.url).href},
  {key:'rest-props',url:new URL('../assets/drafts/rest-props-v1.png',import.meta.url).href},
 ],
 pop:[
  {key:'pop-room',url:new URL('../assets/drafts/popmart-store-v3.png',import.meta.url).href},
  {key:'pop-stand',url:new URL('../assets/drafts/popmart-stand-v2.png',import.meta.url).href},
  {key:'pop-props',url:new URL('../assets/drafts/popmart-props-v1.png',import.meta.url).href},
 ],
 bathroom:[{key:'bathroom-room',url:new URL('../assets/drafts/bathroom-room-v4.png',import.meta.url).href}],
 concert:[
  {key:'concert-room',url:new URL('../assets/drafts/concert-room-v4.png',import.meta.url).href},
  {key:'concert-chair',url:new URL('../assets/drafts/concert-chair-v1.png',import.meta.url).href},
 ],
 arcade:[
  {key:'arcade-room',url:new URL('../assets/drafts/arcade-room-v3.png',import.meta.url).href},
  {key:'arcade-props-v2',url:new URL('../assets/drafts/arcade-props-v2.png',import.meta.url).href},
 ],
 noodle:[
  {key:'noodle-room-v3',url:new URL('../assets/drafts/noodle-room-v3.png',import.meta.url).href},
  {key:'noodle-kit',url:new URL('../assets/drafts/noodle-furniture-v1.png',import.meta.url).href},
 ],
 gym:[
  {key:'gym-room',url:new URL('../assets/drafts/gym-room-v1.png',import.meta.url).href},
 ],
 dance:[
  {key:'dance-room',url:new URL('../assets/drafts/dance-room-v1.png',import.meta.url).href},
 ],
 perler:[
  {key:'perler-room-v2',url:new URL('../assets/drafts/perler-shop-v2.png',import.meta.url).href},
  {key:'perler-furniture-v2',url:new URL('../assets/drafts/perler-furniture-v2.png',import.meta.url).href},
 ],
 rehearsal:[
  {key:'rehearsal-room',url:new URL('../assets/drafts/rehearsal-room-v1.png',import.meta.url).href},
  {key:'rehearsal-kit',url:new URL('../assets/drafts/rehearsal-kit-v1.png',import.meta.url).href},
 ],
 elevator:[{key:'elevator-room',url:new URL('../assets/drafts/elevator-lobby-v1.png',import.meta.url).href}],
 subway:[{key:'subway-room',url:new URL('../assets/drafts/wudaokou-station-v1.png',import.meta.url).href}],
};

const sharedActor=[
 {key:'held-water',url:new URL('../assets/props/water-bottle-v1.png',import.meta.url).href},
 {key:'furniture',url:new URL('../assets/drafts/hutong-furniture-kit-v5.png',import.meta.url).href},
 {key:'decor',url:new URL('../assets/drafts/desk-decor-v1.png',import.meta.url).href},
 {key:'rest-kit',url:new URL('../assets/drafts/rest-interaction-kit-v2.png',import.meta.url).href},
];

const httpWarm=new Set<string>();
function warmUrl(url:string){
 if(httpWarm.has(url))return;
 httpWarm.add(url);
 const image=new Image();
 image.decoding='async';
 image.src=url;
}

/** Queue HTTP warm for a room's heavy textures (and shared actor sheets). */
export function warmRoom(room:string){
 for(const entry of sharedActor)warmUrl(entry.url);
 for(const entry of roomTextures[room]||[])warmUrl(entry.url);
}

/** Idle-time warmup: shared sheets first, then every room background. */
export function startAssetWarmup(game:Phaser.Game){
 const rooms=Object.keys(roomTextures);
 let index=0;
 const step=()=>{
  if(!game.textures)return;
  if(index===0)for(const entry of sharedActor)warmUrl(entry.url);
  const room=rooms[index++];
  if(!room)return;
  warmRoom(room);
  const idle=(window as Window &{requestIdleCallback?:(cb:()=>void,opts?:{timeout:number})=>number}).requestIdleCallback;
  if(idle)idle(step,{timeout:1200});
  else setTimeout(step,180);
 };
 const idle=(window as Window &{requestIdleCallback?:(cb:()=>void,opts?:{timeout:number})=>number}).requestIdleCallback;
 if(idle)idle(step,{timeout:800});
 else setTimeout(step,400);
}

/** Skip Phaser download when the texture is already in the game cache. */
export function loadOnce(scene:Phaser.Scene,key:string,url:string){
 if(!scene.textures.exists(key))scene.load.image(key,url);
}
