import rooms from '../../shared/rooms.json';
import {characterRegistry,characterImage,type AvatarRole} from '../character-assets';
import {seatSurface} from '../seating';
import {items,type ItemName} from '../player-inventory';
import type {MultiplayerBridge} from './bridge';
import {guestCanvas} from '../easter-eggs';
import {gachaReady,registerGachaTextures} from '../gacha-assets';
import {registerProductTextures} from '../product-textures';
import {ensureCollectible} from '../collectible-art';
import {registerRegions} from '../frames';
import geometry from '../../shared/interactions.json';

type Actor={role:AvatarRole;x:number;y:number;facing:number;seat:string|null;activity:string;moving:boolean;hand:ItemName|null};
export type MemoryEntry={seq:number;body:string;scene:string;at:number;eventId?:string;data?:{version?:number;actors?:Actor[];objects?:any[];participants?:string[];npcs?:{id:string;x:number;y:number;height:number;facing?:number;seat?:string|null;mode?:string;question?:string;text?:string}[]}};
const backgrounds=new Map<string,Promise<HTMLImageElement>>();
const scenery=import.meta.glob('../../assets/maps/memories/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
function background(scene:string){const url=scenery[`../../assets/maps/memories/${scene}.png`];if(!url)return Promise.reject(Error('场景素材缺失'));if(!backgrounds.has(url)){const image=new Image();image.src=url;backgrounds.set(url,image.decode().then(()=>image));}return backgrounds.get(url)!;}

/** A reconstruction from the immutable event snapshot, never the current players. */
async function paint(canvas:HTMLCanvasElement,e:MemoryEntry,bridge:MultiplayerBridge){
 const context=canvas.getContext('2d')!,actors=[...(e.data?.actors??[]),...(e.data?.npcs??[]).filter(n=>n.id==='celine').map(n=>({role:'celine' as AvatarRole,x:n.x,y:n.y,facing:n.facing??0,seat:n.seat??null,activity:n.mode??'walk',moving:n.mode==='walking',hand:null}))];
 const active=bridge.active;if(active){registerProductTextures(active);await gachaReady();registerGachaTextures(active);}
 if(active)await Promise.all([...actors.map(p=>p.hand),...(e.data?.objects??[]).flatMap(o=>(o.slots??[]).map((s:any)=>typeof s==='string'?s:s?.name))].filter(Boolean).map(name=>ensureCollectible(active,name).catch(()=>{})));
 const prepared=await Promise.all(actors.map(async p=>{
  const d=characterRegistry.members[p.role];if(!d)return null;
  const front=p.facing===0,back=p.facing===2,office=['hutong','hawaii'].includes(e.scene);let list=d.frames,index=front?0:back?2:1;
  if(p.hand){list=d.carryFrames;index=p.seat?(front?4:back?5:25):p.moving?(front?d.carryFrontLoop[0]:back?d.carryBackLoop[0]:d.carryRightLoop[0]):front?0:back?2:24;}
  else if(p.activity==='working'&&p.seat&&office){list=d.officeFrames;index=back?2:0;}
  else if(p.activity==='piano'){list=d.frames;index=6;}
  else if(p.seat)index=front?4:back?5:39;
  else if(p.activity==='run')index=back?16:front?8:d.runLoop?.[0]??62;
  else if(['dance','practice'].includes(p.activity))index=back?54:46;
  else if(p.activity==='curl')index=30;
  else if(p.moving)index=front?8:back?16:d.sideWalkLoop?.[0]??24;
  const frame=list[index];if(!frame)return null;return{p,frame,image:await characterImage(frame.source),office};
 }));
 const bg=await background(e.scene);context.imageSmoothingEnabled=false;context.clearRect(0,0,640,360);context.drawImage(bg,0,0,640,360);
 const prop=(name:ItemName,x:number,y:number)=>{const item=items[name];if(!item||!bridge.game.textures.exists(item.texture))return;const texture=bridge.game.textures.get(item.texture),f=texture.get(item.frame);context.drawImage(texture.getSourceImage() as CanvasImageSource,f.cutX,f.cutY,f.cutWidth,f.cutHeight,x-item.width/2,y-item.height,item.width,item.height);};
 const layers:{depth:number;draw:()=>void}[]=[];
 const region=async(key:string,url:string,bounds:{name:string;x0:number;y0:number;x1:number;y1:number})=>{
  if(!active)throw Error('场景尚未就绪');
  if(!bridge.game.textures.exists(key)){const source=new Image();source.src=url;await source.decode();if(!bridge.game.textures.exists(key))bridge.game.textures.addImage(key,source);}
  const [frame]=registerRegions(active,key,[bounds]);return{frame,source:bridge.game.textures.get(key).getSourceImage() as CanvasImageSource};
 };
 if(e.scene==='noodle'&&active){
  const {frame,source}=await region('noodle-kit',new URL('../../assets/drafts/noodle-furniture-v1.png',import.meta.url).href,{name:'stool',x0:.75,x1:1,y0:.51,y1:1});
  for(const actor of actors.filter(p=>p.seat))layers.push({depth:291,draw:()=>context.drawImage(source,frame.x,frame.y,frame.width,frame.height,actor.x-12,266,24,23)});
 }
 if(e.scene==='rest'&&active){
  if(!bridge.game.textures.exists('rest-props')){const source=new Image();source.src=new URL('../../assets/drafts/rest-props-v1.png',import.meta.url).href;await source.decode();if(!bridge.game.textures.exists('rest-props'))bridge.game.textures.addImage('rest-props',source);}
  const [frame]=registerRegions(active,'rest-props',[{name:'table',x0:.34,y0:.57,x1:.67,y1:1}]),source=bridge.game.textures.get('rest-props').getSourceImage() as CanvasImageSource;
  for(const x of [200,360,520])layers.push({depth:267,draw:()=>context.drawImage(source,frame.x,frame.y,frame.width,frame.height,x-37.6,220.6,75.2,62.4)});
 }
 if(['concert','rehearsal'].includes(e.scene)&&active){
  const {frame,source}=await region('concert-chair',new URL('../../assets/drafts/concert-chair-v1.png',import.meta.url).href,{name:'chair',x0:0,y0:0,x1:1,y1:1});
  const seats=(geometry as any)[e.scene].seats,backHeight=Math.round(frame.height*.60);
  for(const [id,seat]of Object.entries(seats) as [string,any][]){if(id==='piano')continue;const row=id.charCodeAt(0)-65,h=e.scene==='concert'?[36,42,48][row]:42,w=e.scene==='concert'?[24,28,32][row]:28,x=seat.at[0],y=seat.at[1],occupied=actors.some(p=>p.seat===id);
   layers.push({depth:occupied?y-1:y+10,draw:()=>context.drawImage(source,frame.x,frame.y,frame.width,frame.height,x-w/2,y+10-h,w,h)});
   if(e.scene==='concert'||occupied)layers.push({depth:y+2,draw:()=>context.drawImage(source,frame.x,frame.y,frame.width,backHeight,x-w/2,y+10-h,w,h*backHeight/frame.height)});
  }
  if(e.scene==='rehearsal')layers.push({depth:225,draw:()=>{context.fillStyle='#171b21';context.fillRect(519,211,34,14);context.fillRect(522,225,4,7);context.fillRect(546,225,4,7);context.fillStyle='#48505a';context.fillRect(520,211,32,2);context.strokeStyle='#30363e';context.lineWidth=1;context.beginPath();context.moveTo(521,220);context.lineTo(551,220);context.stroke();}});
 }
 if(e.scene==='bathroom'){
  for(const [i,portal]of [{x:54,width:63},{x:136,width:70},{x:229,width:67},{x:312,width:66}].entries()){
   const open=(e.data?.objects??[]).find(o=>o.id===`bathroom:door-${i}`)?.open??false,farX=portal.x+(open?10:portal.width),dy=open?24:0;
   layers.push({depth:209+dy,draw:()=>{context.save();context.beginPath();context.moveTo(portal.x,77);context.lineTo(farX,77+dy);context.lineTo(farX,206+dy);context.lineTo(portal.x,206);context.closePath();context.fillStyle='#d8c3a2';context.fill();context.strokeStyle='#514b3e';context.lineWidth=1;context.stroke();context.strokeStyle='#f2e2bf';context.lineWidth=2;context.beginPath();context.moveTo(portal.x+2,79);context.lineTo(portal.x+2,204);context.stroke();context.fillStyle='#494d4a';context.fillRect(Math.round(portal.x+(farX-portal.x)*.84),Math.round(147+dy*.84),2,5);context.fillRect(portal.x,102,2,5);context.fillRect(portal.x,177,2,5);context.restore();}});
  }
 }
 for(const o of e.data?.objects??[]){if(!o.slots)continue;if(o.id.startsWith('rest:table-'))layers.push({depth:267.2,draw:()=>o.slots.forEach((s:any,i:number)=>{if(s)prop(typeof s==='string'?s:s.name,o.at[0]+(i-2.5)*11,229);})});if(o.id.startsWith('noodle:table-'))layers.push({depth:264.2,draw:()=>o.slots.forEach((s:any,i:number)=>{if(s)prop(typeof s==='string'?s:s.name,o.at[0]+(i-2.5)*12,260);})});}
 for(const npc of e.data?.npcs??[]){
  const text=npc.text??npc.question;if(text)layers.push({depth:945,draw:()=>{context.font='9px "Microsoft YaHei",monospace';const w=context.measureText(text).width+12,x=npc.x-w/2,y=npc.y-npc.height-26;context.fillStyle='#f2e9cf';context.fillRect(x,y,w,19);context.strokeStyle='#353f35';context.strokeRect(x,y,w,19);context.fillStyle='#2b302d';context.fillText(text,x+6,y+13);}});
  if(npc.id==='ani'){
   const office=bridge.game.scene.getScene('hutong') as any,frame=office.aniGuest?.frames?.[0];
   if(frame&&bridge.game.textures.exists('ani-sheet')){const source=bridge.game.textures.get('ani-sheet').getSourceImage() as CanvasImageSource,scale=npc.height/frame.referenceHeight;layers.push({depth:npc.y,draw:()=>context.drawImage(source,frame.x,frame.y,frame.width,frame.height,npc.x-frame.pivotX*frame.width*scale,npc.y-frame.height*scale,frame.width*scale,frame.height*scale)});}
  }else if(['buzz','zhu','ferret','lulu','tutu'].includes(npc.id)){
   const source=await guestCanvas(npc.id as Parameters<typeof guestCanvas>[0]),width=source.width/source.height*npc.height;layers.push({depth:npc.y,draw:()=>context.drawImage(source,npc.x-width/2,npc.y-npc.height,width,npc.height)});
  }
 }
 // Reuse the game's furniture layers so desks and monitors cover seated bodies.
 if(['hutong','hawaii'].includes(e.scene)){
  const room=bridge.game.scene.getScene(e.scene) as any;
  const furniture=(object:any,frame=object?.frame)=>{if(!object?.visible||!frame)return;layers.push({depth:object.depth,draw:()=>{context.save();context.translate(object.x,object.y);context.scale(object.flipX?-1:1,1);const w=frame.cutWidth*object.scaleX,h=frame.cutHeight*object.scaleY;context.drawImage(object.texture.getSourceImage() as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,-w*object.originX,-h*object.originY,w,h);context.restore();}});};
  for(const row of room.deskRows??[]){furniture(row.desk);furniture(row.panel);}
  for(const pieces of room.hawaiiDeskPieces??[])for(const object of [...pieces.desk,...pieces.panel])furniture(object);
  for(const seat of room.seats??[]){const working=actors.some(p=>p.seat===seat.id&&p.activity==='working'),index=(seat.facing===2?0:2)+Number(working),name=room.frames?.laptop?.[index]?.name;furniture(seat.laptop,name?seat.laptop.texture.get(name):undefined);}
  for(const decoration of room.decorations??[])furniture(decoration.image);
  if(!room.seats?.length){
   const sourceRoom=bridge.game.scene.getScene('hutong') as any,texture=bridge.game.textures.get('furniture'),source=texture.getSourceImage() as CanvasImageSource,rowWidth=e.scene==='hawaii'?448:384;
   for(const [index,bottom,depth]of [[1,287,245.12]]){const native=sourceRoom.frames.desk[index],frame=texture.get(native.name);layers.push({depth,draw:()=>context.drawImage(source,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,320-rowWidth/2,bottom-67.2,rowWidth,67.2)});const panel=texture.get('panel-1'),h=panel.cutHeight/native.height*67.2;layers.push({depth:247.12,draw:()=>context.drawImage(source,panel.cutX,panel.cutY,panel.cutWidth,panel.cutHeight,320-rowWidth/2,bottom-h,rowWidth,h)});}
   for(const [id,seat]of Object.entries((geometry as any)[e.scene].seats)as[string,any][]){const back=id.includes('R'),working=actors.some(p=>p.seat===id&&p.activity==='working'),frame=texture.get(sourceRoom.frames.laptop[(back?0:2)+Number(working)].name),w=25.6,h=frame.cutHeight/frame.cutWidth*w;layers.push({depth:seat.at[1]+(back?-2:6),draw:()=>context.drawImage(source,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,seat.at[0]-w/2,(back?79.4:235.6)-h,w,h)});}
   const decor=bridge.game.textures.get('decor'),decorSource=decor.getSourceImage() as CanvasImageSource;
   for(const [frameName,positions,h]of [['plant',[104,464],28.8],['cup',[329,492],11.2]]as[string,number[],number][]){const f=decor.get(frameName),w=f.cutWidth/f.cutHeight*h;for(const x of positions)layers.push({depth:249.12,draw:()=>context.drawImage(decorSource,f.cutX,f.cutY,f.cutWidth,f.cutHeight,320+(x-320)*.8-w/2,233.4-h,w,h)});}
  }
  const backrest=bridge.game.textures.get('furniture').get('backrest'),source=bridge.game.textures.get('furniture').getSourceImage() as CanvasImageSource,base=(bridge.game.scene.getScene('hutong') as any).frames.chair[0],scale=48/base.width;
  for(const p of actors.filter(p=>p.seat))layers.push({depth:p.y+2,draw:()=>context.drawImage(source,backrest.cutX,backrest.cutY,backrest.cutWidth,backrest.cutHeight,p.x-24,p.y-base.height*scale,48,backrest.cutHeight*scale)});
 }
 for(const actor of prepared.filter(a=>a!==null).sort((a,b)=>a.p.y-b.p.y)){
  const p0=actor.p,depth=p0.seat?(e.scene==='bathroom'?196:p0.y+(e.scene==='arcade'?7:e.scene==='perler'?6:e.scene==='noodle'?4:1)):p0.y+1;
  layers.push({depth,draw:()=>{
  const {p,frame,image,office}=actor,[sx,sy,w,h]=frame.rect;
  const height=p.seat?(e.scene==='concert'?({A:54,B:61.44,C:66}[p.seat[0]]??61.44):['perler','noodle','arcade'].includes(e.scene)?54:characterRegistry.seatedHeight):61.44;
  const fillCarry=!!p.hand&&!p.seat,scale=height/(fillCarry?h:frame.referenceHeight),flip=p.facing===3;
  const surface=office&&p.seat?p.y-(p.facing===0?17:27):seatSurface(e.scene,p.seat);
  let y=p.seat&&surface!==undefined?surface+(h-frame.seat[1])*scale:p.y;
  if(p.seat&&office&&!p.hand&&p.facing===0)y-=24;
  if(!fillCarry)y+=height*(frame.offsetYRatio??0);
  context.save();context.translate(Math.round(p.x),Math.round(y));context.scale(flip?-1:1,1);
  const width=w*scale*(frame.scaleXRatio??1),visibleHeight=p.seat&&office?Math.round(h*.72):h;context.drawImage(image,sx,sy,w,visibleHeight,-width*frame.pivotX,-h*scale,width,visibleHeight*scale);
  const item=p.hand?items[p.hand]:null;
  if(item&&frame.grip&&bridge.game.textures.exists(item.texture)){
   const texture=bridge.game.textures.get(item.texture),f=texture.get(item.frame),source=texture.getSourceImage() as HTMLImageElement;
   const [gx,gy]=frame.grip;context.drawImage(source,f.cutX,f.cutY,f.cutWidth,f.cutHeight,(gx-w*frame.pivotX)*scale-item.width*item.grip.x,(gy-h)*scale-item.height*item.grip.y,item.width,item.height);
  }
  context.restore();
  }});
 }
 for(const layer of layers.sort((a,b)=>a.depth-b.depth))layer.draw();
}

export function setupMemoryView(dialog:HTMLDialogElement,bridge:MultiplayerBridge){
 dialog.innerHTML=`<div class="memory-stage"><canvas id="memory-canvas" width="640" height="360" aria-label="当时的场景"></canvas><div class="memory-stamp"><span id="memory-place"></span><time id="memory-time"></time></div><button class="memory-close" data-close-life aria-label="关闭回看">×</button><span id="memory-status"></span></div><div class="memory-footer"><button id="memory-previous" aria-label="上一段经历">←</button><div><p id="memory-caption"></p><small id="memory-count"></small></div><button id="memory-next" aria-label="下一段经历">→</button></div><div id="memory-strip" aria-label="选择经历"></div><button id="journal-more" hidden>更早的画面</button>`;
 const canvas=dialog.querySelector<HTMLCanvasElement>('#memory-canvas')!,strip=dialog.querySelector('#memory-strip')!;
 let entries:MemoryEntry[]=[],index=0,epoch=0;
 const previous=dialog.querySelector<HTMLButtonElement>('#memory-previous')!,next=dialog.querySelector<HTMLButtonElement>('#memory-next')!;
 async function show(i:number){
  index=Math.max(0,Math.min(i,entries.length-1));const current=++epoch,e=entries[index];
  previous.disabled=index===0;next.disabled=index>=entries.length-1;
  dialog.querySelector('#memory-caption')!.textContent=e?.body??'';
  dialog.querySelector('#memory-count')!.textContent=e?`${index+1} / ${entries.length}`:'';
  canvas.dataset.eventId=e?.eventId??'';
  dialog.querySelector('#memory-place')!.textContent=e?(rooms as Record<string,{name:string}>)[e.scene]?.name??e.scene:'';
  dialog.querySelector('#memory-time')!.textContent=e?new Date(e.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'';
  const status=dialog.querySelector<HTMLElement>('#memory-status')!;status.textContent='';
  canvas.dataset.ready='false';const ctx=canvas.getContext('2d')!;ctx.fillStyle='#111a1c';ctx.fillRect(0,0,640,360);
  strip.replaceChildren();
  const first=Math.max(0,Math.min(index-2,entries.length-5));
  for(let j=first;j<Math.min(entries.length,first+5);j++){
   const item=entries[j],b=document.createElement('button');b.setAttribute('aria-label',item.body);b.setAttribute('aria-current',String(j===index));
   const thumbnail=document.createElement('canvas');thumbnail.width=640;thumbnail.height=360;
   if(item.data?.version===1)void paint(thumbnail,item,bridge).catch(()=>{});
   const label=document.createElement('span');label.textContent=item.data?.version===1?(rooms as Record<string,{name:string}>)[item.scene]?.name??item.scene:'未留下画面';b.append(thumbnail,label);b.onclick=()=>void show(j);strip.append(b);
  }
  if(!e){status.textContent='';return;}
  if(e.data?.version!==1){status.textContent='';return;}
  try{const buffer=document.createElement('canvas');buffer.width=640;buffer.height=360;await paint(buffer,e,bridge);if(epoch!==current)return;ctx.imageSmoothingEnabled=false;ctx.drawImage(buffer,0,0);canvas.dataset.ready='true';canvas.dataset.seq=String(e.seq);canvas.dataset.actors=String(e.data.actors?.length??0);}catch{if(epoch===current)status.textContent='';}
 }
 previous.onclick=()=>void show(index-1);next.onclick=()=>void show(index+1);
 const keys=(e:KeyboardEvent)=>{if(!dialog.open)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopImmediatePropagation();void show(index+(e.key==='ArrowLeft'?-1:1));}};
 window.addEventListener('keydown',keys,true);bridge.game.events.once('destroy',()=>window.removeEventListener('keydown',keys,true));
 return{set(value:MemoryEntry[],append=false){entries=value;void show(append?index:0);},reset(){entries=[];epoch++;}};
}
