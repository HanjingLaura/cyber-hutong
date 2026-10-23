import type Phaser from 'phaser';
import atlas from '../assets/props/gacha-products.frames.json';
export const gachaNames=['粉色小熊','薄荷兔子','蓝色机器人','橘猫','紫色小巫师','皇冠小熊'] as const;
export const plushNames=['粉色小熊','蓝色小熊','金色小熊','紫色小熊','绿色小熊'] as const;
export const gachaItems=gachaNames.map(name=>'扭蛋·'+name);
const cache=new Map<string,HTMLCanvasElement>(),source=new Image();let loaded=false;
let pending:Promise<void>|undefined;
export function gachaReady(){
 if(loaded)return Promise.resolve();
 if(!pending)pending=new Promise<void>((resolve,reject)=>{
  source.onload=()=>{loaded=true;resolve();};
  source.onerror=()=>{pending=undefined;reject(Error('玩具素材加载失败，重新打开面板可重试'));};
  source.src=new URL('../assets/props/gacha-products.png',import.meta.url).href;
 });
 return pending;
}
void gachaReady().catch(()=>{});
/** The same generated silhouettes feed prizes, collection menus and held items. */
export function toyCanvas(index:number,plush=false){
 const key=(plush?'plush':'toy')+index;if(cache.has(key))return cache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=20;canvas.height=24;
 if(!loaded)return canvas; // Transient loading only; never cache an empty prize.
 const frame=atlas.frames[(plush?6:0)+index],c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
 const scale=Math.min(18/frame.width,22/frame.height),w=Math.round(frame.width*scale),h=Math.round(frame.height*scale);
 c.drawImage(source,frame.x,frame.y,frame.width,frame.height,Math.floor((20-w)/2),24-h,w,h);cache.set(key,canvas);return canvas;
}
export function registerGachaTextures(scene:Phaser.Scene){
 if(!loaded)return;
 for(const plush of [false,true])for(let i=0;i<(plush?5:6);i++){const key=(plush?'claw-plush-':'gacha-toy-')+i;if(!scene.textures.exists(key)){scene.textures.addCanvas(key,toyCanvas(i,plush));scene.textures.get(key).add('toy',0,0,0,20,24);}}
}
export async function gachaImages(){await gachaReady();return Array.from({length:6},(_,i)=>toyCanvas(i).toDataURL());}
