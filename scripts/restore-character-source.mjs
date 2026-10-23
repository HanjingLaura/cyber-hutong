import {readFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// Restore a named historical tool input only; runtime still reads formal manifests.
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),archive=resolve(process.env.HUTONG_CHARACTER_ARCHIVE||resolve(root,'..',basename(root)+'-character-archive-2026-10-12'));
const name=process.argv[2],index=JSON.parse(await readFile(resolve(archive,'manifest.json'),'utf8')),entry=index.files.find(file=>file.path===name);
if(!entry)throw Error('Pass one archived repository-relative image path from the archive manifest');
const source=resolve(archive,entry.path),target=resolve(root,entry.path);
if(!source.startsWith(archive+sep)||!target.startsWith(resolve(root,'assets')+sep))throw Error('Restore path outside verified bounds');
if(createHash('sha256').update(await readFile(source)).digest('hex')!==entry.sha256)throw Error('Archive checksum mismatch');
await mkdir(dirname(target),{recursive:true});await copyFile(source,target);console.log('Restored '+entry.path);
