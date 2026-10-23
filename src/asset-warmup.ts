/** Browser + Phaser texture warmup so room switches hit cache instead of cold downloads. */
import type Phaser from 'phaser';
import {createTexturePrefetcher,type TexturePrefetcher} from './texture-prefetch.mjs';

const roomTextures:Record<string,{key:string;url:string}[]>={
 manner:[{key:'place-manner',url:new URL('../assets/drafts/manner-room.png',import.meta.url).href}],
 yousheng:[{key:'place-yousheng',url:new URL('../assets/maps/places/yousheng.png',import.meta.url).href}],
 google:[{key:'place-google',url:new URL('../assets/maps/places/google.png',import.meta.url).href},{key:'ticket-counter',url:new URL('../assets/props/ticket-counter.png',import.meta.url).href},{key:'place-chair-v2',url:new URL('../assets/props/meeting-chairs-v2.png',import.meta.url).href}],
 meeting:[{key:'place-meeting',url:new URL('../assets/maps/places/meeting.png',import.meta.url).href},{key:'place-chair-v2',url:new URL('../assets/props/meeting-chairs-v2.png',import.meta.url).href}],
 street:[{key:'place-street',url:new URL('../assets/maps/places/street.png',import.meta.url).href},{key:'pink-scooter',url:new URL('../assets/props/pink-scooter.png',import.meta.url).href}],
 campus:[{key:'place-campus',url:new URL('../assets/maps/places/campus.png',import.meta.url).href},{key:'skateboard',url:new URL('../assets/props/skateboard.png',import.meta.url).href},{key:'traffic-cone',url:new URL('../assets/props/traffic-cone-v2.png',import.meta.url).href}],

 ktv:[{key:'ktv-room',url:new URL('../assets/drafts/ktv-room-v1.png',import.meta.url).href}],
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
  {key:'pop-boxes',url:new URL('../assets/props/blind-box-packaging.png',import.meta.url).href},
  {key:'pop-machine',url:new URL('../assets/props/capsule-machine.png',import.meta.url).href},
  {key:'guest-source-buzz',url:new URL('../assets/npcs/buzz-lightyear-green.png',import.meta.url).href},
 ],
 bathroom:[{key:'bathroom-room',url:new URL('../assets/drafts/bathroom-room-v4.png',import.meta.url).href},{key:'guest-source-ferret',url:new URL('../assets/npcs/fuguidiao-green.png',import.meta.url).href}],
 concert:[
  {key:'concert-room',url:new URL('../assets/drafts/concert-room-v4.png',import.meta.url).href},
  {key:'concert-chair',url:new URL('../assets/drafts/concert-chair-v1.png',import.meta.url).href},
  {key:'guest-source-zhu',url:new URL('../assets/npcs/zhu-zhixin-green.png',import.meta.url).href},
  {key:'guest-source-zhu-winter',url:new URL('../assets/npcs/zhu-zhixin-winter-green.png',import.meta.url).href},
 ],
 arcade:[
  {key:'arcade-room',url:new URL('../assets/drafts/arcade-room-v3.png',import.meta.url).href},
  {key:'arcade-props-v2',url:new URL('../assets/drafts/arcade-props-v2.png',import.meta.url).href},
 ],
 noodle:[
  {key:'noodle-room-v3',url:new URL('../assets/drafts/noodle-room-v3.png',import.meta.url).href},
  {key:'noodle-wood-table',url:new URL('../assets/props/noodle-wood-table-v1.png',import.meta.url).href},
  {key:'noodle-wood-stool',url:new URL('../assets/props/noodle-wood-stool-v1.png',import.meta.url).href},
  {key:'noodle-utensil-tray',url:new URL('../assets/props/noodle-utensil-tray.png',import.meta.url).href},
  {key:'noodle-condiment-tray',url:new URL('../assets/props/noodle-condiment-tray.png',import.meta.url).href},
  {key:'noodle-order-pad',url:new URL('../assets/props/noodle-order-pad.png',import.meta.url).href},
 ],
 gym:[
  {key:'gym-room',url:new URL('../assets/drafts/gym-room-v1.png',import.meta.url).href},
  {key:'guest-source-tutu',url:new URL('../assets/npcs/tutu-green-v1.png',import.meta.url).href},
 ],
 dance:[
  {key:'dance-room',url:new URL('../assets/drafts/dance-room-v1.png',import.meta.url).href},
  {key:'guest-source-lulu',url:new URL('../assets/npcs/lulu-v1.png',import.meta.url).href},
 ],
 perler:[
  {key:'perler-room-v2',url:new URL('../assets/drafts/perler-shop-v2.png',import.meta.url).href},
  {key:'perler-furniture-v2',url:new URL('../assets/drafts/perler-furniture-v2.png',import.meta.url).href},
 ],
 rehearsal:[
  {key:'piano-bench',url:new URL('../assets/props/piano-bench.png',import.meta.url).href},
  {key:'rehearsal-room',url:new URL('../assets/drafts/rehearsal-room-v1.png',import.meta.url).href},
  {key:'rehearsal-kit',url:new URL('../assets/drafts/rehearsal-kit-v1.png',import.meta.url).href},
  {key:'concert-chair',url:new URL('../assets/drafts/concert-chair-v1.png',import.meta.url).href},
 ],
 elevator:[{key:'elevator-room',url:new URL('../assets/drafts/elevator-lobby-v1.png',import.meta.url).href}],
 subway:[{key:'subway-room',url:new URL('../assets/drafts/wudaokou-station-v1.png',import.meta.url).href}],
};

const sharedActor=[
 {key:"product-atlas",url:new URL("../assets/props/products.png",import.meta.url).href},
 {key:'held-water',url:new URL('../assets/props/water-bottle-v1.png',import.meta.url).href},
 {key:'furniture',url:new URL('../assets/drafts/hutong-furniture-kit-v5.png',import.meta.url).href},
 {key:'decor',url:new URL('../assets/drafts/desk-decor-v1.png',import.meta.url).href},
 {key:'rest-kit',url:new URL('../assets/drafts/rest-interaction-kit-v2.png',import.meta.url).href},
];

const loaders=new WeakMap<Phaser.Game,TexturePrefetcher>();
function loader(game:Phaser.Game){
 let current=loaders.get(game);
 if(!current){current=createTexturePrefetcher({textures:game.textures,makeImage:()=>new Image(),
  connection:()=> (navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection,
  defer:()=>new Promise(resolve=>requestAnimationFrame(resolve)),setTimer:setTimeout,clearTimer:clearTimeout});
  loaders.set(game,current);game.events.once('destroy',()=>current!.dispose());}
 return current;
}
function entries(room:string){
 const extras=['hutong','hawaii'].includes(room)?sharedActor:room==='rest'?sharedActor.filter(e=>['product-atlas','rest-kit','held-water'].includes(e.key)):room==='noodle'?sharedActor.filter(e=>e.key==='product-atlas'):[];
 return [...(roomTextures[room]||[]),...extras];
}
/** Optional selection loads only this destination, directly into the shared texture cache. */
export function warmRoom(room:string,game:Phaser.Game){void loader(game).load(entries(room)).catch(()=>{});}
/** Explicit travel joins selection prefetch; required assets still load on data saver. */
export function prepareRoom(room:string,game:Phaser.Game,onProgress?:(completed:number,total:number)=>void,signal?:AbortSignal){return loader(game).load(entries(room),{required:true,onProgress,signal});}

/** Skip Phaser download when the texture is already in the game cache. */
export function loadOnce(scene:Phaser.Scene,key:string,url:string){
 if(!scene.textures.exists(key))scene.load.image(key,url);
}
