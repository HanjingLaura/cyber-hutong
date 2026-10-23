import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=process.argv[2];if(!source)throw Error('Pass the generated left/right goal table');
const target='assets/props/arcade-hockey-table.png';
await sharp(source).resize(640,420,{kernel:'nearest'}).png().toFile(target);
await writeFile('assets/metadata/hockey-side-goals.json',JSON.stringify({tool:'built-in image_gen edit',source,target,size:[640,420],sha256:createHash('sha256').update(await readFile(target)).digest('hex'),goalMouths:{left:[48,173,62,247],right:[578,173,590,247]},puckRadius:8,scoreCenterY:[181,239],prompt:'Preserve the wide horizontal top-down cyan pixel air-hockey table and navy background. Close the top and bottom center rail gaps; place matching dark goal openings at left and right rail centers. Use a vertical center divider and retain the center circle. No puck, paddles, labels or UI.',processing:'Nearest-neighbour full canvas normalization to640x420; no crop, no generated candidate copies under assets.'},null,2)+'\n');
console.log(target);
