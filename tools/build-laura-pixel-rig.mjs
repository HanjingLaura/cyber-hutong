/** Authored on a 64×80 integer pixel grid. No generated PNG is modified. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

const out=path.resolve('assets/characters/laura/v3');
fs.mkdirSync(out,{recursive:true});
const C={ink:'#242124',hair:'#29262b',hairMid:'#3b363d',hairLight:'#51494e',skin:'#e6b48c',skinLight:'#f1c6a0',skinShade:'#bf876f',mouth:'#9f635b',cloth:'#eee9d7',clothLight:'#faf5e4',clothShade:'#c6c2b3',clothDeep:'#a19e96',pants:'#454149',pantsLight:'#57515a',pantsFar:'#343139',shoe:'#e8e5d9',shoeShade:'#aaa99f',teal:'#168a91',tealLight:'#39b6bc',tealShade:'#10606b',chair:'#414146',chairLight:'#64636a',chairShade:'#2c2d32',cup:'#f4f2e7',cupShade:'#c7ccc5',coffee:'#65452c',bottle:'#5ba39b',label:'#cce0d4',phone:'#6a929f',screen:'#b5d4d5'};
const color=key=>C[key].slice(1).match(/../g).map(x=>parseInt(x,16));
class Pixels{
  constructor(w=64,h=80){this.w=w;this.h=h;this.data=new Uint8Array(w*h*4);this.tags=new Array(w*h).fill('');}
  dot(x,y,key,tag=''){assert(Number.isInteger(x)&&Number.isInteger(y),'fractional authored pixel');if(x<0||x>=this.w||y<0||y>=this.h)return;const i=y*this.w+x;this.data.set([...color(key),255],i*4);this.tags[i]=tag;}
  rect(x,y,w,h,key,tag=''){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)this.dot(xx,yy,key,tag);}
  poly(points,key,tag=''){const ys=points.map(p=>p[1]);for(let y=Math.min(...ys);y<Math.max(...ys);y++){for(let x=0;x<this.w;x++){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [a,b]=points[i],[c,d]=points[j];if((b>y+.5)!==(d>y+.5)&&(x+.5<(c-a)*(y+.5-b)/(d-b)+a))inside=!inside;}if(inside)this.dot(x,y,key,tag);}}}
  blit(src,x=0,y=0){for(let yy=0;yy<src.h;yy++)for(let xx=0;xx<src.w;xx++){const from=(yy*src.w+xx)*4,to=((yy+y)*this.w+xx+x)*4;if(src.data[from+3]&&xx+x>=0&&xx+x<this.w&&yy+y>=0&&yy+y<this.h){this.data.set(src.data.subarray(from,from+4),to);this.tags[to/4]=src.tags[from/4];}}}
}
function oriented(target,direction){return {rect:(x,y,w,h,k,t)=>target.rect(direction==='east'?x:64-x-w,y,w,h,k,t),poly:(p,k,t)=>target.poly(direction==='east'?p:p.map(([x,y])=>[64-x,y]),k,t)};}
function hand(){const p=new Pixels(4,4);['.oo.','osso','osso','.oo.'].forEach((r,y)=>[...r].forEach((v,x)=>{if(v!=='.')p.dot(x,y,v==='o'?'ink':'skin','hand');}));return p;}
const palm=hand();
function paintHead(p,y,direction){
  const h=new Pixels(22,20);
  h.poly([[6,0],[16,0],[16,1],[19,1],[19,3],[21,3],[21,7],[22,7],[22,16],[20,16],[20,18],[18,18],[18,20],[4,20],[4,19],[2,19],[2,17],[0,17],[0,6],[1,6],[1,3],[3,3],[3,1],[6,1]],'ink','head');
  h.poly([[6,1],[16,1],[16,2],[18,2],[18,4],[20,4],[20,8],[21,8],[21,16],[19,16],[19,18],[17,18],[17,19],[5,19],[5,18],[3,18],[3,16],[1,16],[1,6],[2,6],[2,4],[4,4],[4,2],[6,2]],'hair','head');
  if(direction==='east'){
    h.poly([[14,5],[18,6],[19,8],[20,11],[22,13],[20,14],[20,16],[18,18],[15,18],[12,16],[12,10]],'skin','head');
    h.rect(14,8,4,7,'skinLight','head');h.rect(13,15,2,2,'skinShade','head');h.rect(17,17,2,1,'mouth','head');
    h.poly([[5,3],[9,2],[15,2],[15,3],[12,4],[10,6],[8,7],[6,10],[4,10],[5,7]],'hairMid','head');
    h.rect(9,3,4,1,'hairLight','head');h.rect(6,5,2,2,'hairLight','head');h.rect(3,11,2,5,'hairMid','head');h.rect(10,11,2,7,'hairMid','head');
    h.poly([[13,5],[15,4],[16,6],[14,7],[13,10],[11,12],[10,11]],'hair','head');
    h.rect(15,10,6,5,'ink','head');h.rect(16,11,4,3,'skinLight','head');h.rect(18,12,1,2,'ink','head');h.rect(12,11,3,1,'ink','head');
  }else{
    // Independently authored left profile: hair part and highlights differ.
    h.poly([[8,5],[4,6],[3,8],[2,11],[0,13],[2,14],[2,16],[4,18],[7,18],[10,16],[10,10]],'skin','head');
    h.rect(4,8,4,7,'skinLight','head');h.rect(8,15,2,2,'skinShade','head');h.rect(3,17,2,1,'mouth','head');
    h.poly([[7,2],[14,2],[17,4],[18,7],[16,7],[15,5],[12,4],[9,4]],'hairMid','head');
    h.rect(10,2,4,1,'hairLight','head');h.rect(15,4,2,1,'hairLight','head');h.rect(17,10,2,6,'hairMid','head');h.rect(11,12,2,6,'hairMid','head');
    h.poly([[9,4],[7,5],[6,7],[8,9],[10,11],[11,10],[10,6]],'hair','head');
    h.rect(1,10,6,5,'ink','head');h.rect(2,11,4,3,'skinLight','head');h.rect(3,12,1,2,'ink','head');h.rect(7,11,3,1,'ink','head');
  }
  p.blit(h,21,y);
}
function leg(g,hip,knee,ankle,sole,far=false){
  const points=[[hip-2,53],[hip+3,53],[knee+3,61],[ankle+3,sole-3],[ankle-2,sole-3],[knee-2,62]];
  g.poly(points,'ink','leg');
  g.poly([[hip-1,54],[hip+2,54],[knee+2,61],[ankle+2,sole-4],[ankle-1,sole-4],[knee-1,61]],far?'pantsFar':'pants','leg');
  if(!far)g.rect(ankle,sole-8,1,4,'pantsLight','leg');
  g.poly([[ankle-2,sole-4],[ankle+2,sole-4],[ankle+3,sole-3],[ankle+6,sole-3],[ankle+6,sole],[ankle-2,sole]],'ink','shoe');
  g.rect(ankle-1,sole-3,3,1,'shoeShade','shoe');g.rect(ankle-1,sole-2,6,1,'shoe','shoe');
  g.rect(ankle-2,sole-1,8,1,'ink','shoe');
}
function seatedLegs(g,middle=false){
  const shift=middle?-3:0,knee=44+shift;
  g.poly([[28,52],[35,52],[35,54],[knee+3,54],[knee+4,57],[knee+3,68],[knee+6,69],[knee+6,72],[knee-2,72],[knee-2,56],[33,56],[28,56]],'ink','leg');
  g.poly([[29,53],[34,53],[34,55],[knee+2,55],[knee+3,58],[knee+2,68],[knee-1,68],[knee-1,55],[34,55],[29,55]],'pantsFar','leg');
  g.poly([[30,52],[35,52],[35,54],[knee+4,54],[knee+5,57],[knee+4,68],[knee+7,69],[knee+7,72],[knee-1,72],[knee-1,56],[30,56]],'ink','leg');
  g.poly([[31,53],[35,53],[35,55],[knee+3,55],[knee+4,58],[knee+3,68],[knee,68],[knee,56],[31,55]],'pants','leg');
  g.rect(knee+2,59,1,8,'pantsLight','leg');
  g.rect(knee-1,68,5,1,'shoeShade','shoe');g.rect(knee-1,69,6,2,'shoe','shoe');g.rect(knee+5,70,1,1,'shoe','shoe');
  g.rect(knee-1,71,8,1,'ink','shoe');
}
function character(direction,pose,index=0){
  const p=new Pixels(),g=oriented(p,direction),holding=pose.includes('hold'),sitting=pose.startsWith('sit'),crouch=pose.startsWith('crouch'),walking=pose.startsWith('walk');
  const passing=walking&&(index===1||index===4),base=sitting?46:crouch?45:passing?45:44;
  const steps=[-5,0,5,3,0,-3],dx=walking?steps[index]:0;
  if(sitting||crouch)seatedLegs(g,crouch);
  else{
    const near=34+dx,far=31-dx;
    leg(g,31,31-Math.round(dx*.5),far,passing&&index===1?69:72,true);
    leg(g,34,34+Math.round(dx*.5),near,passing&&index===4?69:72);
  }
  // The garment silhouette is authored into the frame, including both sleeves.
  g.poly([[27,base+1],[30,base],[35,base],[38,base+1],[38,base+8],[36,base+10],[27,base+10],[26,base+7],[26,base+3]],'ink','cloth');
  g.poly([[28,base+2],[31,base+1],[35,base+1],[37,base+2],[37,base+8],[35,base+9],[28,base+9],[27,base+6],[27,base+3]],'cloth','cloth');
  g.rect(28,base+3,2,4,'clothLight','cloth');g.rect(28,base+8,7,1,'clothShade','cloth');
  g.poly([[26,base],[31,base],[32,base+2],[29,base+5],[25,base+3],[25,base+1]],'ink','cloth');
  g.poly([[26,base+1],[30,base+1],[30,base+2],[28,base+4],[26,base+3]],'clothShade','cloth');g.rect(26,base+1,3,1,'clothLight','cloth');
  const gy=base+5;
  if(holding){
    g.poly([[33,base+1],[36,base+1],[38,base+3],[38,base+4],[41,base+4],[41,base+7],[36,base+7],[33,base+5],[32,base+3]],'ink','cloth');
    g.poly([[34,base+2],[35,base+2],[37,base+4],[37,base+5],[40,base+5],[40,base+6],[36,base+6],[34,base+4]],'cloth','cloth');
    g.rect(35,base+3,1,2,'clothLight','cloth');g.rect(34,base+5,2,1,'clothShade','cloth');
  }else if(sitting||crouch){
    g.poly([[33,base+1],[36,base+2],[37,base+5],[40,base+6],[40,base+9],[35,base+8],[32,base+5]],'ink','cloth');
    g.poly([[34,base+2],[35,base+3],[36,base+6],[39,base+7],[39,base+8],[35,base+7],[33,base+4]],'cloth','cloth');
    const handX=direction==='east'?40:24;p.blit(palm,handX-2,base+7-2);
  }else{
    const swing=walking?-Math.sign(dx)*2:0;
    g.poly([[33,base+1],[36,base+1],[36+swing,base+5],[36+swing,base+10],[32+swing,base+10],[32,base+4]],'ink','cloth');
    g.poly([[34,base+2],[35,base+2],[35+swing,base+5],[35+swing,base+9],[33+swing,base+9],[33,base+4]],'cloth','cloth');
    g.rect(33+swing,base+8,2,1,'clothShade','cloth');const hx=direction==='east'?34+swing:64-(34+swing);p.blit(palm,hx-2,base+11-2);
  }
  // Neck joins head and garment; no floating portrait cutout.
  g.rect(32,base-1,4,2,'skinShade','neck');g.rect(33,base,2,1,'skin','neck');
  paintHead(p,base-20,direction);
  return {pixels:p,grip:holding?[direction==='east'?42:22,gy]:null,seat:sitting?[32,56]:null,floor:[32,72]};
}
function chair(direction,style){
  const back=new Pixels(),front=new Pixels(),seat=new Pixels(),g=oriented(back,direction),s=oriented(seat,direction),f=oriented(front,direction);
  if(style==='dining'){
    g.poly([[21,36],[24,37],[25,42],[25,50],[23,54],[20,53],[19,48],[19,39]],'ink','back');
    g.poly([[21,37],[23,38],[24,42],[24,49],[22,52],[21,51],[20,47],[20,40]],'teal','back');g.rect(21,39,1,10,'tealLight','back');
    g.rect(21,53,3,19,'ink','support');g.rect(22,54,1,17,'tealShade','support');g.rect(37,58,3,14,'ink','support');g.rect(38,59,1,12,'teal','support');
    s.poly([[22,56],[40,56],[42,57],[42,59],[22,59]],'ink','seat');s.rect(23,56,17,1,'tealLight','seat');s.rect(23,57,18,1,'teal','seat');
  }else{
    g.poly([[20,35],[24,36],[25,40],[24,46],[25,50],[23,55],[20,54],[20,49],[19,45],[19,38]],'ink','back');
    g.poly([[21,36],[23,37],[24,40],[23,46],[24,50],[22,53],[21,52],[21,48],[20,44],[20,39]],'chair','back');g.rect(21,38,1,6,'chairLight','back');
    g.rect(29,59,3,10,'ink','support');g.rect(30,59,1,8,'chairLight','support');g.rect(21,69,20,2,'ink','support');g.rect(20,70,4,2,'chairShade','support');g.rect(38,70,4,2,'chairShade','support');g.rect(26,67,10,2,'chair','support');
    s.poly([[23,56],[40,56],[42,57],[42,59],[24,59],[23,58]],'ink','seat');s.rect(24,56,16,1,'chairLight','seat');s.rect(24,57,17,1,'chair','seat');
    f.rect(25,52,12,2,'ink','armrest');f.rect(26,52,10,1,'chairLight','armrest');f.rect(25,54,2,4,'chairShade','armrest');
  }
  return {back,seat,front};
}
function item(kind,direction){
  const east=new Pixels(16,16);
  if(kind==='cup'){
    east.rect(6,2,6,9,'ink','core');east.rect(7,3,4,7,'cup','core');east.rect(7,3,4,1,'coffee','core');east.rect(10,4,1,6,'cupShade','core');
    east.rect(4,5,2,5,'ink','grip');east.rect(5,6,1,3,'cup','grip');
    for(let y=7;y<=10;y++)east.tags[y*16+6]='grip';
  }else if(kind==='bottle'){
    east.rect(8,2,3,2,'ink','core');east.rect(7,4,5,9,'ink','core');east.rect(8,4,3,8,'bottle','core');east.rect(8,7,3,3,'label','core');east.rect(6,9,1,3,'bottle','grip');
  }else{
    east.rect(6,3,5,9,'ink','core');east.rect(7,4,3,6,'phone','core');east.rect(7,4,2,4,'screen','core');east.rect(8,10,1,1,'clothShade','core');for(let y=9;y<=11;y++)east.tags[y*16+6]='grip';
  }
  const gripY=kind==='cup'?8:kind==='bottle'?11:10;
  if(direction==='east')return {pixels:east,grip:[5,gripY]};
  const west=new Pixels(16,16);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const from=y*16+x,to=y*16+15-x;west.data.set(east.data.subarray(from*4,from*4+4),to*4);west.tags[to]=east.tags[from];}return {pixels:west,grip:[11,gripY]};
}
function occupied(p,x,y){return x>=0&&y>=0&&x<p.w&&y<p.h&&p.data[(y*p.w+x)*4+3]===255;}
function validateFrame(body){
  const p=body.pixels,cloth=new Set(p.tags.flatMap((t,i)=>t==='cloth'?[i]:[])),pending=[cloth.values().next().value],seen=new Set();
  while(pending.length){const i=pending.pop();if(seen.has(i)||!cloth.has(i))continue;seen.add(i);const x=i%64,y=Math.floor(i/64);for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(xx>=0&&xx<64&&yy>=0&&yy<80)pending.push(yy*64+xx);}
  assert.equal(seen.size,cloth.size,'disconnected garment or sleeve');
  const shoeRows=p.tags.flatMap((tag,i)=>tag==='shoe'?[Math.floor(i/64)]:[]);assert.equal(Math.max(...shoeRows),71);
  for(let i=3;i<p.data.length;i+=4)assert(p.data[i]===0||p.data[i]===255,'soft alpha');
  if(body.grip)for(const kind of ['cup','bottle','phone']){
    const prop=item(kind,body.grip[0]>32?'east':'west'),[gx,gy]=body.grip,[ix,iy]=prop.grip;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(prop.pixels.tags[y*16+x]==='core'&&occupied(prop.pixels,x,y))assert(!occupied(p,gx-ix+x,gy-iy+y),'item core intersects action frame');
  }
}
function validateSample(body,chairLayers,prop){
  validateFrame(body);
  assert.deepEqual(body.seat,[32,56]);assert.deepEqual(body.floor,[32,72]);
  const p=body.pixels,shoeRows=p.tags.flatMap((tag,i)=>tag==='shoe'?[Math.floor(i/64)]:[]);assert.equal(Math.max(...shoeRows),71,'shoe soles must touch ground boundary72');
  const chairs=new Pixels();chairs.blit(chairLayers.back);chairs.blit(chairLayers.seat);chairs.blit(chairLayers.front);
  const clashes=[];for(let i=0;i<p.tags.length;i++)if(['leg','shoe'].includes(p.tags[i])&&occupied(chairs,i%64,Math.floor(i/64)))clashes.push([i%64,Math.floor(i/64)]);
  assert.deepEqual(clashes,[],'chair structure intersects leg or shoe');
  if(body.grip){
    const [gx,gy]=body.grip,[ix,iy]=prop.grip,ox=gx-ix,oy=gy-iy;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(prop.pixels.tags[y*16+x]==='core'&&occupied(prop.pixels,x,y))assert(!occupied(p,ox+x,oy+y),'item core intersects body');
    let contact=0;for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(occupied(palm,x,y)&&occupied(p,gx-2+x,gy-2+y))contact++;
    assert(contact>0,'hand is detached from cuff');
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(occupied(palm,x,y)){
      const px=gx-2+x-ox,py=gy-2+y-oy;
      if(occupied(prop.pixels,px,py))assert.equal(prop.pixels.tags[py*16+px],'grip','hand overlaps item outside allowed contact region');
    }
  }
  for(const alpha of p.data.filter((_,i)=>i%4===3))assert(alpha===0||alpha===255,'soft alpha');
}
// Geometry acceptance is a gate: compile full cycles only after the seat sample passes.
const checks=[];
for(const direction of ['east','west'])for(const style of ['dining','office'])for(const pose of ['sit','sit-hold'])for(const kind of pose==='sit'?['none']:['cup','bottle','phone']){
  validateSample(character(direction,pose),chair(direction,style),kind==='none'?null:item(kind,direction));checks.push({direction,style,pose,item:kind,passed:true});
}

const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const name=Buffer.from(type),crcInput=Buffer.concat([name,data]);let crc=0xffffffff;for(const b of crcInput)crc=crcTable[(crc^b)&255]^(crc>>>8);const header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([header,name,data,tail]);}
function save(p,name){const head=Buffer.alloc(13);head.writeUInt32BE(p.w,0);head.writeUInt32BE(p.h,4);head[8]=8;head[9]=6;const raw=Buffer.alloc((p.w*4+1)*p.h);for(let y=0;y<p.h;y++)Buffer.from(p.data.buffer,y*p.w*4,p.w*4).copy(raw,y*(p.w*4+1)+1);fs.writeFileSync(path.join(out,name),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
function enlarge(p,factor){const q=new Pixels(p.w*factor,p.h*factor);for(let y=0;y<q.h;y++)for(let x=0;x<q.w;x++){const src=(Math.floor(y/factor)*p.w+Math.floor(x/factor))*4;q.data.set(p.data.subarray(src,src+4),(y*q.w+x)*4);}return q;}
const frames=[];
const groups={standing:{cols:2,rows:2,poses:['idle','idle-hold']},walking:{cols:6,rows:4,poses:['walk','walk-hold']},seated:{cols:2,rows:2,poses:['sit','sit-hold']},transition:{cols:3,rows:4,poses:['transition','transition-hold']}};
for(const [group,config] of Object.entries(groups)){
  const sheet=new Pixels(config.cols*64,config.rows*80);
  ['east','west'].forEach((direction,di)=>config.poses.forEach((action,ai)=>{
    const count=group==='walking'?6:group==='transition'?3:1;
    for(let index=0;index<count;index++){
      const hold=action.endsWith('hold'),pose=group==='transition'?['idle','crouch','sit'][index]+(hold?'-hold':''):action;
      const body=character(direction,pose,index),col=count===1?ai:index,row=count===1?di:di*2+ai;
      validateFrame(body);
      sheet.blit(body.pixels,col*64,row*80);
      frames.push({id:`${direction}-${action}-${index}`,direction,action,index,sheet:`${group}.png`,rect:[col*64,row*80,64,80],floor:[32,72],seat:body.seat,grip:body.grip,handLayer:hold?'round-hand.png':null,seatApproachOffset:group==='transition'?[(direction==='east'?1:-1)*[16,8,0][index],0]:[0,0]});
    }
  }));save(sheet,`${group}.png`);
}
save(palm,'round-hand.png');
const items=[],chairs=[];
for(const direction of ['east','west']){
  for(const kind of ['cup','bottle','phone']){const prop=item(kind,direction),file=`${kind}-${direction}.png`;save(prop.pixels,file);items.push({kind,direction,file,frame:[16,16],grip:prop.grip,profile:'one-hand-small-v1'});}
  for(const style of ['dining','office']){const layers=chair(direction,style),files={};for(const [layer,p] of Object.entries(layers)){files[layer]=`${style}-${direction}-${layer}.png`;save(p,files[layer]);}chairs.push({style,direction,files,frame:[64,80],floor:[32,72],seat:[32,56],profile:'seat-standard-v1'});}
}
const proof=new Pixels(256,160);
for(let row=0;row<2;row++)for(let col=0;col<4;col++){
  const direction=col%2?'west':'east',style=col<2?'dining':'office',body=character(direction,row?'sit-hold':'sit'),layers=chair(direction,style),tile=new Pixels();
  tile.blit(layers.back);tile.blit(layers.seat);tile.blit(body.pixels);tile.blit(layers.front);
  if(body.grip){const prop=item('cup',direction);tile.blit(prop.pixels,body.grip[0]-prop.grip[0],body.grip[1]-prop.grip[1]);tile.blit(palm,body.grip[0]-2,body.grip[1]-2);}
  proof.blit(tile,col*64,row*80);
}
save(proof,'contact-proof.png');save(enlarge(proof,4),'contact-proof-4x.png');
const manifest={character:'laura',version:3,method:'authored-integer-pixel-grid',logicalFrame:[64,80],scale:1,supportedDirections:['east','west'],scope:'side-view-rig-sample',geometryPassed:true,fullCharacterPackReady:false,palette:C,frames,items,chairs,drawOrder:['chair.back','chair.seat','character','chair.front','item','round-hand'],transitionPlayback:{sit:[0,1,2],stand:[2,1,0]},validation:{checks:checks.length,actionFrames:frames.length,connectedGarments:true,seatHeight:16,floorError:0,itemCoreOverlap:0,legSupportOverlap:0,hardAlpha:true},pending:['front/back direction artwork','in-game integration','identity and animation visual review']};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(out,'geometry-checks.json'),JSON.stringify(checks,null,2)+'\n');
console.log(JSON.stringify({out,frames:frames.length,checks:checks.length,geometryPassed:true}));
