import Phaser from 'phaser';
import npcRules from '../shared/npcs.json';

type Guest='buzz'|'zhu'|'ferret'|'lulu'|'tutu';
const guests={
  buzz:{name:'巴斯光年',url:new URL('../assets/npcs/buzz-lightyear-green.png',import.meta.url).href,cut:[46,194,165,296],height:62,x:430,y:253},
  zhu:{name:'朱志鑫',url:new URL('../assets/npcs/zhu-zhixin-green.png',import.meta.url).href,cut:[56,194,150,296],height:54,x:320,y:145},
  ferret:{name:'富贵貂',url:new URL('../assets/npcs/fuguidiao-green.png',import.meta.url).href,cut:[45,235,171,255],height:45,x:400,y:269},
  lulu:{name:'水豚噜噜',url:new URL('../assets/npcs/lulu-v1.png',import.meta.url).href,cut:[30,312,246,363],height:47,x:470,y:270},
  tutu:{name:'图图',url:new URL('../assets/npcs/tutu-green-v1.png',import.meta.url).href,cut:[43,265,174,225],height:36,x:476,y:280},
} satisfies Record<Guest,{name:string;url:string;cut:number[];height:number;x:number;y:number}>;
const guestOwners=Object.fromEntries(npcRules.map(n=>[n.id,n.owner])) as Partial<Record<Guest,string>>;

// Same backdrop rule as cyber-hutong: retain Buzz's green armour.
function keyGreen(data:Uint8ClampedArray,width:number,height:number){
  const seen=new Uint8Array(width*height),queue:number[]=[];
  const push=(x:number,y:number)=>{
    if(x<0||y<0||x>=width||y>=height)return;
    const n=y*width+x,i=n*4;if(seen[n])return;seen[n]=1;
    if(!(data[i+1]>70&&data[i+1]>Math.max(data[i],data[i+2])*1.6+20))return;
    data[i+3]=0;queue.push(n);
  };
  for(let x=0;x<width;x++){push(x,0);push(x,height-1);}
  for(let y=0;y<height;y++){push(0,y);push(width-1,y);}
  for(let head=0;head<queue.length;head++){const n=queue[head],x=n%width,y=Math.floor(n/width);push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1);}
  for(let i=0;i<data.length;i+=4)if(data[i+1]>180&&data[i]<100&&data[i+2]<100)data[i+3]=0;
  for(let n=0;n<width*height;n++){
    const i=n*4;if(!data[i+3])continue;const x=n%width,y=Math.floor(n/width);
    const edge=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a>=0&&b>=0&&a<width&&b<height&&!data[(b*width+a)*4+3]);
    const neutral=Math.max(data[i],data[i+2]);if(edge&&data[i+1]>neutral*1.25+12)data[i+1]=neutral;
  }
}
const memoryImages=new Map<string,Promise<HTMLCanvasElement>>();
export function guestCanvas(id:Guest){
 if(!memoryImages.has(id)){const spec=guests[id],source=new Image();source.src=spec.url;
  memoryImages.set(id,source.decode().then(()=>{const [x,y,w,h]=spec.cut,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,x,y,w,h,0,0,w,h);if(id!=='lulu'){const pixels=ctx.getImageData(0,0,w,h);keyGreen(pixels.data,w,h);ctx.putImageData(pixels,0,0);}return canvas;}));
 }return memoryImages.get(id)!;
}
const placed:{scene:Phaser.Scene;id:Guest;image:Phaser.GameObjects.Image;reflection?:Phaser.GameObjects.Image}[]=[];
let onlinePresence:string[]|undefined;
export function setGuestPresence(ids?:string[]){onlinePresence=ids;for(const p of placed){const visible=!ids||ids.includes(p.id);p.image.setVisible(visible);p.reflection?.setVisible(visible);}}
declare global{interface Window{__easterEggPreview?:{getState:()=>unknown}}}
export function preloadGuest(scene:Phaser.Scene,id:Guest){scene.load.image(`guest-source-${id}`,guests[id].url);}
export function placeGuest(scene:Phaser.Scene,id:Guest){
  const spec=guests[id],key=`guest-${id}`;
  if(!scene.textures.exists(key)){
    const [x,y,w,h]=spec.cut,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(scene.textures.get(`guest-source-${id}`).getSourceImage() as HTMLImageElement,x,y,w,h,0,0,w,h);
    // Lulu has native alpha; only legacy green-screen sheets need keying.
    if(id!=='lulu'){const pixels=ctx.getImageData(0,0,w,h);keyGreen(pixels.data,w,h);ctx.putImageData(pixels,0,0);}
    scene.textures.addCanvas(key,canvas);
  }
  const image=scene.add.image(spec.x,spec.y,key).setOrigin(.5,1).setDisplaySize(spec.cut[2]/spec.cut[3]*spec.height,spec.height).setDepth(spec.y+.5);
  image.setInteractive({useHandCursor:true}).on('pointerdown',()=>window.dispatchEvent(new CustomEvent('hutong:npc-interact',{detail:id})));
  let reflection:Phaser.GameObjects.Image|undefined;
  if(id==='lulu'){
    // Match the dance room's player reflection projection and use Lulu's back pose.
    const source=scene.textures.get('guest-source-lulu');
    if(!source.has('back'))source.add('back',0,310,312,246,363);
    reflection=scene.add.image(Math.round(spec.x),Math.round(130-(spec.y-177)*.25),'guest-source-lulu','back')
      .setOrigin(.5,1).setDisplaySize(246/363*spec.height*.62,spec.height*.62).setDepth(-50);
  }
  placed.push({scene,id,image,reflection});setGuestPresence(onlinePresence);
  scene.events.once('shutdown',()=>{const index=placed.findIndex(p=>p.image===image);if(index>=0)placed.splice(index,1);});
  window.__easterEggPreview={getState:()=>placed.map(p=>({id:p.id,name:guests[p.id].name,owner:guestOwners[p.id]??null,scene:p.scene.sys.settings.key,active:p.scene.sys.isActive(),x:p.image.x,y:p.image.y,height:p.image.displayHeight,visible:p.image.visible}))};
}
export function guestBlocks(id:Guest,x:number,y:number){if(onlinePresence&&!onlinePresence.includes(id))return false;const guest=guests[id];return Math.abs(x-guest.x)<guest.cut[2]/guest.cut[3]*guest.height/2+9&&Math.abs(y-guest.y)<10;}
