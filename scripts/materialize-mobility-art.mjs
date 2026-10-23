import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [ride,skate]=process.argv.slice(2);
if(!ride||!skate)throw Error('Pass scooter and skateboard character sheets');
const roles=['suki','sid','jilly','laura','kay','franco','cora','amber','celine'];
for(let i=0;i<roles.length;i++){
 const frames=[],layers=[];
 for(const [part,file] of [ride,skate].entries()){
  const meta=await sharp(file).metadata(),col=i%3,row=Math.floor(i/3);
  const left=Math.floor(col*meta.width/3),top=Math.floor(row*meta.height/3);
  const width=Math.floor((col+1)*meta.width/3)-left,height=Math.floor((row+1)*meta.height/3)-top;
  const cell=await sharp(file).extract({left,top,width,height}).png().toBuffer();
  const trimmed=await sharp(cell).trim({threshold:20}).png().toBuffer();
  const input=await sharp(trimmed).resize({height:72,kernel:'nearest'}).png().toBuffer();
  const size=await sharp(input).metadata();layers.push({input,left:part*96,top:0});
  frames.push({name:part?'skateboard-balance-right':'scooter-riding-right',source:roles[i]+'-mobility',rect:[part*96,0,size.width,72],pivotX:part?.5:.35,referenceHeight:72,foot:[size.width*.5,72],seat:[size.width*.35,72*.68],grip:null,gripSide:1,slot:null});
 }
 const out=`assets/characters/${roles[i]}/mobility.png`;
 await sharp({create:{width:192,height:72,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(out);
 const path=`assets/characters/${roles[i]}/manifest.json`,m=JSON.parse(await readFile(path,'utf8'));
 m.sources[roles[i]+'-mobility']={file:roles[i]+'/mobility.png',size:[192,72],sha256:createHash('sha256').update(await readFile(out)).digest('hex'),origin:'imagegen side riding and skateboard balance 2026-10-15'};
 m.member.mobilityFrames=frames;
 await writeFile(path,JSON.stringify(m,null,2)+'\n');
}
