import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=process.argv[2];if(!source)throw Error('Pass the generated transparent three-box sheet');
const meta=await sharp(source).metadata(),frames=[];
for(let index=0;index<3;index++){
 const left=Math.floor(meta.width*index/3),right=Math.floor(meta.width*(index+1)/3);
 const cell=await sharp(source).extract({left,top:0,width:right-left,height:meta.height}).png().toBuffer();
 const image=await sharp(cell).trim().resize(44,56,{fit:'inside',kernel:'nearest'}).png().toBuffer();
 const size=await sharp(image).metadata();frames.push({input:image,left:index*48+Math.floor((48-size.width)/2),top:64-size.height});
}
const target='assets/props/blind-box-packaging.png';
await sharp({create:{width:144,height:64,channels:4,background:'#00000000'}}).composite(frames).png().toFile(target);
await writeFile('assets/metadata/blind-box-packaging.json',JSON.stringify({tool:'built-in image_gen',source,target,size:[144,64],frameSize:[48,64],variants:['pink-bunny','blue-bear','cream-bear'],sha256:createHash('sha256').update(await readFile(target)).digest('hex'),prompt:'Three matching transparent pixel-art blind-box cartons; pink bunny, blue bear, cream bear. Nearly frontal, small top and right side, top-left light, charcoal outline, flat limited palette, native 40x52 style. No text, logos, shelf, backdrop or cast shadow. Equal baseline and proportions.',processing:'Three equal source cells, alpha trim, nearest-neighbour fit 44x56, aligned to bottom of 48x64 cells. No alternate assets copied into assets.'},null,2)+'\n');
console.log(JSON.stringify({target,size:[144,64]}));
