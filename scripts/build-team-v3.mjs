import fs from 'node:fs';
const bounds=JSON.parse(fs.readFileSync('assets/metadata/team-v3-bounds.json','utf8'));
const old=JSON.parse(fs.readFileSync('assets/metadata/team-v1.json','utf8'));
const grips=JSON.parse(fs.readFileSync('assets/characters/laura/approved/grips.json','utf8'));
const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
const sources={};
for(const [id,b]of Object.entries(bounds))sources[id]={file:id.startsWith('laura-')&&id!=='laura-carry'?'laura/approved/'+id.slice(6)+'.png':'team/v3/'+id.replace('-carry','-carry')+'.png',size:b.size};
const map=[0,1,2,3,4,5,6,7,8,9,10,11,8,9,4,0,12,13,14,15,12,13,5,2,16,17,18,19,20,21,24,25,0,1,2,3,4,5,4,4,8,9,10,11,8,9,26,27,12,13,14,15,12,13,28,29,16,17,18,19,20,21,30,31];
const carryMap=[0,0,2,3,16,17,4,5,6,7,6,5,12,13,14,15,14,13,8,9,10,11,10,9,1,18];
const members={};
function frame(source,index,name,seat=.72,slot){
 const data=bounds[source].frames[index];if(!data)throw Error('Missing '+source+'/'+index);
 const [,,w,h]=data.rect,referenceHeight=Math.max(...bounds[source].frames.map(f=>f.rect[3]));
 let grip=data.grip,gripSide=data.gripSide;
 if(slot){grip=[w*data.pivotX+slot.x*referenceHeight,h+slot.y*referenceHeight];gripSide=slot.side;}
 return {...data,name,source,referenceHeight,foot:[w*data.pivotX,h],seat:[w*data.pivotX,h*seat],grip,gripSide,slot:slot??null};
}
for(const role of roles){
 const prior=old.members[role];
 if(role!=='laura'){
  const base=map.map((i,n)=>frame(role,i,prior.frames[n].name));
  const carry=carryMap.map((i,n)=>frame(role+'-carry',i,'carry-'+n));
  members[role]={seat:prior.seat,frames:base,carryFrames:carry,officeFrames:[6,7,22,23].map((i,n)=>frame(role,i,['type-front-left','type-front-right','type-back-left','type-back-right'][n])),carryFrontLoop:[6,7,8,9],carryBackLoop:[12,13,14,15],carryRightLoop:[18,19,20,21],walkLoopLength:4,approvedLegacy:false};
 }else{
  const refs=Array.from({length:64},()=>['idle',0]);
  for(let i=0;i<4;i++)refs[i]=['idle',i];refs[4]=['sit',3];refs[5]=['sit',0];refs[6]=['sit',4];refs[7]=['sit',5];
  for(let i=0;i<6;i++){refs[8+i]=['walk',i%4];refs[16+i]=['walk',8+i%4];refs[24+i]=['side',i];refs[40+i]=['walk',i%4];refs[48+i]=['walk',8+i%4];refs[56+i]=['side',i];}
  for(const [i,source,n]of [[14,'sit',3],[15,'idle',0],[22,'sit',0],[23,'idle',2],[30,'curl',0],[31,'curl',2],[36,'seatHold',0],[37,'hold',2],[38,'seatHold',1],[39,'seatHold',1],[46,'dance',1],[47,'dance',3],[54,'dance',5],[55,'dance',7],[62,'side',0],[63,'side',4]])refs[i]=[source,n];
  for(let i=0;i<4;i++)refs[32+i]=['hold',i];
  const base=refs.map(([source,i],n)=>frame('laura-'+source,i,prior.frames[n].name));
  const carryRefs=[['hold',0],['hold',0],['hold',2],['hold',3],['seatHold',0],['hold',2],...Array.from({length:6},(_,i)=>['hold',4+[0,1,2,3,2,1][i]]),...Array.from({length:6},(_,i)=>['hold',12+[0,1,2,3,2,1][i]]),...Array.from({length:6},(_,i)=>['hold',8+[0,1,2,3,2,1][i]]),['hold',1],['seatHold',1]];
  const carry=carryRefs.map(([source,i],n)=>frame('laura-'+source,i,'carry-'+n,.72,grips[source==='seatHold'?'rest-seated-hold':'rest-hold'].slots['cell-'+i]));
  members[role]={seat:prior.seat,frames:base,carryFrames:carry,officeFrames:[4,5,1,2].map((i,n)=>frame('laura-sit',i,['type-front-left','type-front-right','type-back-left','type-back-right'][n])),carryFrontLoop:[6,7,8,9],carryBackLoop:[12,13,14,15],carryRightLoop:[18,19,20,21],walkLoopLength:4,approvedLegacy:true};
 }
}
const blackLaura=members.laura;
members.laura={seat:blackLaura.seat,frames:map.map((i,n)=>frame('laura',i,old.members.laura.frames[n].name)),carryFrames:carryMap.map((i,n)=>frame('laura-carry',i,'carry-'+n)),officeFrames:[6,7,22,23].map((i,n)=>frame('laura',i,['type-front-left','type-front-right','type-back-left','type-back-right'][n])),carryFrontLoop:[6,7,8,9],carryBackLoop:[12,13,14,15],carryRightLoop:[18,19,20,21],walkLoopLength:4,approvedLegacy:false};
fs.writeFileSync('assets/metadata/team-v3.json',JSON.stringify({version:3,worldHeight:61.44,seatedHeight:62.4,style:'approved black Laura game proportions; photo-based identities',sources,members,blackLaura},null,2)+'\n');
console.log('Eight roles: original Laura retained; seven regenerated core/carry pairs.');
