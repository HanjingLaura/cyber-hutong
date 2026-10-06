/** Latency-safe texture warmup: never starve the active scene's downloads. */
import Phaser from 'phaser';

const roomTextures:Record<string,string[]>={
 hutong:[
  new URL('../assets/drafts/hutong-wall-view-v5.png',import.meta.url).href,
  new URL('../assets/drafts/hutong-reverse-view-v5.png',import.meta.url).href,
 ],
 hawaii:[new URL('../assets/drafts/hawaii-wall-v2.png',import.meta.url).href],
 rest:[
  new URL('../assets/drafts/rest-room-shell-v2.png',import.meta.url).href,
  new URL('../assets/drafts/rest-props-v1.png',import.meta.url).href,
 ],
 pop:[
  new URL('../assets/drafts/popmart-store-v3.png',import.meta.url).href,
  new URL('../assets/drafts/popmart-stand-v2.png',import.meta.url).href,
  new URL('../assets/drafts/popmart-props-v1.png',import.meta.url).href,
 ],
 bathroom:[new URL('../assets/drafts/bathroom-room-v4.png',import.meta.url).href],
 concert:[
  new URL('../assets/drafts/concert-room-v4.png',import.meta.url).href,
  new URL('../assets/drafts/concert-chair-v1.png',import.meta.url).href,
 ],
 arcade:[
  new URL('../assets/drafts/arcade-room-v3.png',import.meta.url).href,
  new URL('../assets/drafts/arcade-props-v2.png',import.meta.url).href,
 ],
 noodle:[
  new URL('../assets/drafts/noodle-room-v3.png',import.meta.url).href,
  new URL('../assets/drafts/noodle-furniture-v1.png',import.meta.url).href,
 ],
 gym:[
  new URL('../assets/drafts/gym-room-v1.png',import.meta.url).href,
  new URL('../assets/drafts/owner-gym-curl-v1.png',import.meta.url).href,
 ],
 dance:[
  new URL('../assets/drafts/dance-room-v1.png',import.meta.url).href,
  new URL('../assets/drafts/owner-dance-v1.png',import.meta.url).href,
 ],
 perler:[
  new URL('../assets/drafts/perler-shop-v2.png',import.meta.url).href,
  new URL('../assets/drafts/perler-furniture-v2.png',import.meta.url).href,
 ],
 rehearsal:[
  new URL('../assets/drafts/rehearsal-room-v1.png',import.meta.url).href,
  new URL('../assets/drafts/rehearsal-kit-v1.png',import.meta.url).href,
 ],
 elevator:[new URL('../assets/drafts/elevator-lobby-v1.png',import.meta.url).href],
 subway:[new URL('../assets/drafts/wudaokou-station-v1.png',import.meta.url).href],
};

const warmed=new Set<string>();
const queue:string[]=[];
let active=0;
const MAX_PARALLEL=2;

function pump(){
 while(active<MAX_PARALLEL&&queue.length){
  const url=queue.shift()!;
  if(warmed.has(url))continue;
  warmed.add(url);
  active++;
  const done=()=>{active=Math.max(0,active-1);pump();};
  // fetch() into HTTP cache without decoding into GPU memory.
  fetch(url,{cache:'force-cache',mode:'cors',...({priority:'low'} as RequestInit)}).then(r=>r.blob()).then(()=>done(),()=>done());
 }
}

function enqueue(urls:string[],front=false){
 for(const url of urls){
  if(warmed.has(url))continue;
  const at=queue.indexOf(url);
  if(at>=0){if(front&&at>0){queue.splice(at,1);queue.unshift(url);}continue;}
  if(front)queue.unshift(url);else queue.push(url);
 }
 pump();
}

/** Warm only the destination room (map select / before enter). */
export function warmRoom(room:string){
 enqueue(roomTextures[room]||[],true);
}

/** Skip Phaser download when the texture is already in the game cache. */
export function loadOnce(scene:Phaser.Scene,key:string,url:string){
 if(!scene.textures.exists(key))scene.load.image(key,url);
}
