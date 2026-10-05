import { apiUrl } from './base';
import type Phaser from 'phaser';
import {items,type ItemName} from './player-inventory';
export const beadColors=['#fff4dc','#303438','#eb6269','#ffae54','#f5d965','#82bd68','#339a91','#71cce0','#478fc2','#7267b4','#b58bd0','#ee94bd','#a2684c','#ddd4c1','#a3acb4','#654e47'];
const canvases=new Map<string,HTMLCanvasElement>(),pending=new Map<string,Promise<void>>();
export function ensureCollectible(scene:Phaser.Scene,name:string|null):Promise<void>{
 if(!name?.startsWith('拼豆·'))return Promise.resolve();
 const key='bead-item-'+name.slice(3);items[name as ItemName]??={texture:key,frame:'__BASE',width:18,height:18,grip:{x:.15,y:.7}};
 const register=()=>{if(!scene.textures.exists(key)&&canvases.has(name))scene.textures.addCanvas(key,canvases.get(name)!);};
 if(canvases.has(name)){register();return Promise.resolve();}
 if(!pending.has(name))pending.set(name,fetch(apiUrl('item-art?name='+encodeURIComponent(name))).then(async r=>{if(!r.ok)throw Error('作品素材读取失败');return r.json();}).then(art=>{
  const filled=art.cells.flatMap((color:number,i:number)=>color>=0?[i]:[]),left=Math.min(...filled.map((i:number)=>i%16)),top=Math.min(...filled.map((i:number)=>Math.floor(i/16))),right=Math.max(...filled.map((i:number)=>i%16)),bottom=Math.max(...filled.map((i:number)=>Math.floor(i/16)));
  const canvas=document.createElement('canvas');canvas.width=(right-left+1)*3;canvas.height=(bottom-top+1)*3;const c=canvas.getContext('2d')!;
  art.cells.forEach((color:number,i:number)=>{if(color<0||!beadColors[color])return;const x=(i%16-left)*3,y=(Math.floor(i/16)-top)*3;c.fillStyle=beadColors[color];c.fillRect(x,y,3,3);c.fillStyle='#ffffff55';c.fillRect(x,y,2,1);c.fillStyle='#00000033';c.fillRect(x+2,y+1,1,2);});canvases.set(name,canvas);
 }).catch(e=>{pending.delete(name);throw e;}));
 return pending.get(name)!.then(()=>{const c=canvases.get(name)!;items[name as ItemName].width=18*c.width/Math.max(c.width,c.height);items[name as ItemName].height=18*c.height/Math.max(c.width,c.height);register();});
}
export function itemIcon(scene:Phaser.Scene,name:string){const item=items[name as ItemName];if(!item||!scene.textures.exists(item.texture))return null;const texture=scene.textures.get(item.texture),frame=texture.get(item.frame),canvas=document.createElement('canvas');canvas.width=frame.cutWidth;canvas.height=frame.cutHeight;canvas.getContext('2d')!.drawImage(texture.getSourceImage() as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,canvas.width,canvas.height);return canvas.toDataURL();}
