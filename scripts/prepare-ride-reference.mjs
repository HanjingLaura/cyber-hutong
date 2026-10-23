import fs from 'node:fs';
import sharp from 'sharp';
const roles=['suki','sid','jilly','laura','kay','franco','cora','amber','celine'];
const layers=[];
for(let i=0;i<roles.length;i++){
 const m=JSON.parse(fs.readFileSync(`assets/characters/${roles[i]}/manifest.json`));
 const f=m.member.frames[1],r=f.rect;
 const input=await sharp('assets/characters/'+m.sources[f.source].file).extract({left:r[0],top:r[1],width:r[2],height:r[3]}).resize(130,180,{fit:'inside',kernel:'nearest'}).toBuffer();
 layers.push({input,left:i%3*200+35,top:Math.floor(i/3)*220+20});
}
await sharp({create:{width:600,height:660,channels:4,background:'#747c76'}}).composite(layers).png().toFile('output/ride-character-reference.png');
