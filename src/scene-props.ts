import type Phaser from 'phaser';

/** Shared canonical art for live scenes and immutable memory reconstruction. */
export const sceneProps={
 'piano-bench':{url:new URL('../assets/props/piano-bench.png',import.meta.url).href,width:34,height:21},
 'ticket-counter':{url:new URL('../assets/props/ticket-counter.png',import.meta.url).href,width:55,height:22},
};
type Prop=keyof typeof sceneProps;
export function preloadSceneProp(scene:Phaser.Scene,key:Prop){if(!scene.textures.exists(key))scene.load.image(key,sceneProps[key].url);}
const images=new Map<Prop,Promise<HTMLImageElement>>();
export function scenePropImage(key:Prop){
 let pending=images.get(key);
 if(!pending){const image=new Image();image.src=sceneProps[key].url;pending=image.decode().then(()=>image).catch(error=>{images.delete(key);throw error;});images.set(key,pending);}
 return pending;
}
