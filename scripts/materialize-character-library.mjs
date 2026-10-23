import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,basename,relative} from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// One-time, reproducible equivalence migration from the frozen pre-migration registry.
// Future actions are registered directly in each character's manifest.
const root=fileURLToPath(new URL('../',import.meta.url)),base=resolve(root,'assets/characters');
const archive=resolve(process.env.HUTONG_CHARACTER_ARCHIVE||resolve(root,'..',basename(resolve(root))+'-character-archive-2026-10-12'));
const originalPath=file=>{const original=resolve(base,file);return existsSync(original)?original:resolve(archive,relative(root,original));};
const before=JSON.parse(await readFile(new URL('./fixtures/character-library-before.json',import.meta.url),'utf8'));
const molesSources=JSON.parse(await readFile(resolve(base,'moles.json'),'utf8')),moles={schemaVersion:1,members:{}};
const sourceName=(role,id)=>id===role||id==='celine-v1'?'poses.png':id===role+'-carry'?'carry.png':id.includes('-walk-a-')?'walk-side-a.png':id.includes('-walk-b-')?'walk-side-b.png':id.includes('-carry-walk-')?'carry-walk.png':id.includes('-office-call-')?'office-call.png':id.includes('-saxophone-')?'saxophone.png':id.includes('-dance-')?'dance.png':id.includes('-run-')?'run.png':basename(before.sources[id].file);
function compact(frames,keep,loops){
 const indices=[...keep].filter(i=>i<frames.length).sort((a,b)=>a-b),map=new Map(indices.map((old,index)=>[old,index]));
 return {frames:indices.map(i=>frames[i]),loops:Object.fromEntries(Object.entries(loops).map(([key,loop])=>[key,loop?.map(i=>map.get(i))]))};
}
const imageCount=new Set();
for(const [role,old]of Object.entries(before.members)){
 const standing=compact(old.frames,new Set([...Array(64).keys(),...(old.sideWalkLoop??[]),...(old.runLoop??[])]),{sideWalkLoop:old.sideWalkLoop,runLoop:old.runLoop});
 const carry=compact(old.carryFrames,new Set([...Array(26).keys(),...old.carryFrontLoop,...old.carryBackLoop,...old.carryRightLoop]),{carryFrontLoop:old.carryFrontLoop,carryBackLoop:old.carryBackLoop,carryRightLoop:old.carryRightLoop});
 const member={...old,frames:standing.frames,carryFrames:carry.frames,...standing.loops,...carry.loops};
 const directory=resolve(base,role);await mkdir(directory,{recursive:true});const sources={};
 for(const id of new Set([...member.frames,...member.carryFrames,...member.officeFrames,...(member.podiumFrames??[])].map(f=>f.source))){
  const source=before.sources[id],file=role+'/'+sourceName(role,id),bytes=await readFile(originalPath(source.file));
  if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw new Error(`Baseline changed: ${id}`);
  await copyFile(originalPath(source.file),resolve(base,file));sources[id]={file,size:source.size,sha256:source.sha256,origin:source.file};imageCount.add(id);
 }
 const manifest={schemaVersion:1,role,worldHeight:before.worldHeight,seatedHeight:before.seatedHeight,sources,member,rendering:{mirrorDirection:3,standingScale:'worldHeight / referenceHeight',carryStandingScale:'worldHeight / rect[3]',seatScale:'seatedHeight / referenceHeight',seatSurface:'seat[1]',grip:'frame-local pixels',frameDurationDefaultMs:125},provenance:{date:'2026-10-12',codeBase:'d57d36d + pre-existing working tree',acceptance:'local-equivalence; online baseline and human acceptance pending',migrationFixture:'scripts/fixtures/character-library-before.json'}};
 if(role==='celine')manifest.officeGuest=JSON.parse(await readFile(resolve(root,'assets/metadata/celine-v1.json'),'utf8'));
 if(role!=='celine'){
  const file=role+'/moles.png',origin='team/v2/'+role+'.png';await copyFile(originalPath(origin),resolve(base,file));
  manifest.moles={file,origin,size:molesSources.members[role].size,sha256:createHash('sha256').update(await readFile(resolve(base,file))).digest('hex'),frames:molesSources.members[role].frames};
  moles.members[role]=manifest.moles;
 }
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(resolve(directory,'README.md'),`# ${role}\n\n正式加载入口：manifest.json。保留原像素、裁切与锚点；来源、SHA256、代码基线及本地等效验收状态记录于清单。当前尚未确认线上版本。\n\n新动作流程见 ../README.md。此目录只包含本人物使用的图集；不要求每个人拥有 Laura 或 Franco 的专属动作。\n`);
}
await writeFile(resolve(base,'moles.json'),JSON.stringify(moles,null,2)+'\n');
console.log(`Materialized ${Object.keys(before.members).length} character manifests with ${imageCount.size} unchanged action images.`);
