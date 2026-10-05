import type Phaser from 'phaser';
export const gachaNames=['粉色小熊','薄荷兔子','蓝色机器人','橘猫','紫色小巫师','皇冠小熊'] as const;
export const plushNames=['粉色小熊','蓝色小熊','金色小熊','紫色小熊','绿色小熊'] as const;
export const gachaItems=gachaNames.map(name=>'扭蛋·'+name);
const cache=new Map<string,HTMLCanvasElement>();
/** Individual pixel objects, drawn on a transparent 20 × 24 grid. */
export function toyCanvas(index:number,plush=false){
 const key=(plush?'plush':'toy')+index;if(cache.has(key))return cache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=20;canvas.height=24;const c=canvas.getContext('2d')!;
 const main=(plush?['#e998b3','#89c9dc','#ddbd73','#b69bda','#9fc583']:['#e998b3','#91d3bc','#77b9d9','#eab66f','#a794d4','#d9b57c'])[index],dark='#303038',light='#fff0d9';
 const r=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 r(5,13,10,8,dark);r(6,13,8,7,main);r(3,15,3,4,dark);r(14,15,3,4,dark);r(3,15,2,3,main);r(15,15,2,3,main);
 r(5,20,4,3,dark);r(11,20,4,3,dark);r(5,20,3,2,main);r(12,20,3,2,main);r(8,15,4,4,light);
 if(plush||index===0||index===5){r(3,2,5,5,dark);r(12,2,5,5,dark);r(4,3,3,3,main);r(13,3,3,3,main);}
 else if(index===1){r(4,0,4,8,dark);r(12,0,4,8,dark);r(5,1,2,6,main);r(13,1,2,6,main);r(5,2,1,4,'#f1b2bf');r(13,2,1,4,'#f1b2bf');}
 else if(index===3){r(3,2,5,5,dark);r(12,2,5,5,dark);r(4,3,3,3,main);r(13,3,3,3,main);r(5,3,1,2,'#dc8991');r(14,3,1,2,'#dc8991');}
 r(3,6,14,7,dark);r(5,4,10,11,dark);r(4,7,12,5,main);r(6,5,8,9,main);r(5,7,2,2,light);
 if(!plush&&index===2){r(9,0,2,5,dark);r(8,0,4,2,'#ea967d');r(5,7,10,5,'#29475a');r(6,8,2,2,'#bcf3e4');r(12,8,2,2,'#bcf3e4');r(8,12,4,1,'#29475a');r(8,16,4,2,'#ea967d');}
 else{r(6,9,2,2,dark);r(12,9,2,2,dark);r(8,12,4,2,light);r(9,12,2,1,dark);if(!plush&&index===3){r(9,5,2,2,'#b97949');r(2,11,3,1,dark);r(15,11,3,1,dark);}}
 if(!plush&&index===4){r(8,0,4,2,dark);r(6,2,8,3,dark);r(5,3,10,3,'#665185');r(2,6,16,2,dark);r(7,4,7,1,'#ddb85e');r(16,12,1,8,dark);r(15,11,3,2,'#e5cc74');}
 if(!plush&&index===5){r(6,0,2,4,'#f0cb65');r(9,1,2,3,'#f0cb65');r(12,0,2,4,'#f0cb65');r(6,3,8,2,'#c3943e');r(9,3,2,1,'#d87983');}
 cache.set(key,canvas);return canvas;
}
export function gachaReady(){return Promise.resolve();}
export function registerGachaTextures(scene:Phaser.Scene){
 for(const plush of [false,true])for(let i=0;i<(plush?5:6);i++){const key=(plush?'claw-plush-':'gacha-toy-')+i;if(!scene.textures.exists(key)){scene.textures.addCanvas(key,toyCanvas(i,plush));scene.textures.get(key).add('toy',0,0,0,20,24);}}
}
export async function gachaImages(){return Array.from({length:6},(_,i)=>toyCanvas(i).toDataURL());}
