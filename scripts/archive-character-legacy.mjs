import {readFile,writeFile,mkdir,copyFile,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url))),assets=resolve(root,'assets');
const archive=resolve(process.env.HUTONG_CHARACTER_ARCHIVE||resolve(root,'..',basename(root)+'-character-archive-2026-10-12'));
if(archive===root||archive.startsWith(root+sep))throw Error('Character archive must be outside the project');
const baseline=JSON.parse(await readFile(new URL('./fixtures/character-library-before.json',import.meta.url),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const entries=[...Object.values(baseline.sources).map(source=>({path:relative(root,resolve(root,'assets/characters',source.file)).replaceAll('\\','/'),sha256:source.sha256})),...Object.entries(baseline.moles).map(([role,source])=>({path:`assets/characters/team/v2/${role}.png`,sha256:source.sha256}))];
for(const entry of entries){
 const source=resolve(root,entry.path),target=resolve(archive,entry.path);
 if(!source.startsWith(assets+sep)||!target.startsWith(archive+sep))throw Error('Archive path outside verified bounds');
 if(existsSync(source)&&hash(await readFile(source))!==entry.sha256)throw Error('Source changed: '+entry.path);
}
if(!process.argv.includes('--apply')){console.log(JSON.stringify({archive,files:entries.length,mode:'dry-run'},null,2));}
else{
 // Copy and verify every file before removing any workspace source.
 for(const entry of entries){const source=resolve(root,entry.path),target=resolve(archive,entry.path);await mkdir(dirname(target),{recursive:true});if(existsSync(source))await copyFile(source,target);if(hash(await readFile(target))!==entry.sha256)throw Error('Archive verification failed: '+entry.path);}
 await writeFile(resolve(archive,'manifest.json'),JSON.stringify({date:'2026-10-12',repository:root,files:entries},null,2)+'\n');
 for(const entry of entries){const source=resolve(root,entry.path);if(existsSync(source)){if(hash(await readFile(source))!==entry.sha256)throw Error('Source changed during archive: '+entry.path);await unlink(source);}}
 console.log(`Archived and verified ${entries.length} legacy images at ${archive}`);
}
