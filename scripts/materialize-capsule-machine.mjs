import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=process.argv[2];if(!source)throw Error('Pass the generated standalone transparent machine');
const image=await sharp(source).trim().resize(74,182,{fit:'inside',kernel:'nearest'}).png().toBuffer(),size=await sharp(image).metadata();
const target='assets/props/capsule-machine.png';
await sharp({create:{width:82,height:190,channels:4,background:'#00000000'}}).composite([{input:image,left:Math.floor((82-size.width)/2),top:186-size.height}]).png().toFile(target);
await writeFile('assets/metadata/capsule-machine.json',JSON.stringify({tool:'built-in image_gen',source,target,size:[82,190],sha256:createHash('sha256').update(await readFile(target)).digest('hex'),prompt:'Standalone complete pink capsule toy machine, near-front orthographic with tiny right side, pastel pink and cream cabinet, glass filled with colorful capsule bunny/bear toys, silver rotary crank on lower left, empty dark pickup recess on lower right, small feet. Consistent hard pixel outlines, square color clusters, top-left light, transparent alpha, no environment, no screenshot, no logo or text.',processing:'Alpha trim; nearest-neighbour fit 74x182; centered in an 82x190 transparent production canvas with bottom at186.'},null,2)+'\n');
console.log(target);
