// Read-only production asset inventory. Backups/candidates under output are never assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reportDir=path.join(root,'output/art-refresh');
const slash=s=>s.replaceAll('\\','/');
const relative=p=>slash(path.relative(root,p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function walk(dir){
  const result=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...await walk(p));else result.push(p);
  }
  return result.sort();
}
async function json(name){try{return JSON.parse(await fs.readFile(path.join(reportDir,name),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function assetPath(value){
  if(typeof value!=='string')return null;
  const p=slash(value);const index=p.indexOf('assets/');
  if(index<0||p.slice(0,index).includes('output/'))return null;
  return p.slice(index).replace(/^\.\.\//,'');
}

const evidence=new Map(),blocked=new Map(),evidenceFiles=[];
function record(asset,row,file){
  const p=assetPath(asset);if(!p)return;
  const entries=evidence.get(p)??[];
  entries.push({report:relative(path.join(reportDir,file)),expectedSha256:row.canonicalSHA256??row.outputSha256??row.sha256??null,approved:row.approved===true||row.reviewStatus==='passed'||row.independentReview?.includes('approved')||row.approval?.verdict==='pass',reviewer:row.reviewer??row.approval?.reviewer??row.independentReview??null,source:row.resultPath??row.source??null});
  evidence.set(p,entries);
}
// Prefer the final canonical records, never office.originals or rejected attempts.
for(const name of ['office-generation-log.json','leisure-generation-results.json','shop-generation-log.json']){
  const data=await json(name);if(!data)continue;evidenceFiles.push(relative(path.join(reportDir,name)));
  const rows=Array.isArray(data)?data:data.generations??[];
  for(const row of rows)record(row.asset??row.canonical??row.target??row.sourcePath,row,name);
}
const chair=await json('concert-chair-import.json');
if(chair?.canonical){record(chair.canonical,chair,'concert-chair-import.json');evidenceFiles.push('output/art-refresh/concert-chair-import.json');}
// Include other groups' final/log files without treating nested backup records as evidence.
for(const entry of await fs.readdir(reportDir,{withFileTypes:true})){
  if(!entry.isFile()||!/(?:final|generation|log).*\.json$/.test(entry.name)||evidenceFiles.some(f=>f.endsWith('/'+entry.name))||entry.name==='asset-manifest.json')continue;
  const data=await json(entry.name);evidenceFiles.push('output/art-refresh/'+entry.name);
  for(const row of Array.isArray(data)?data:data.assets??[]){
    const candidate=row.asset??row.canonical??row.target??row.path;
    if(candidate&&assetPath(candidate))record(candidate,row,entry.name);
  }
}
for(const row of await json('shop-blocked-assets.json')??[])blocked.set(row.asset,row);

const assetFiles=await walk(path.join(root,'assets'));
const assetNames=new Set(assetFiles.map(relative));
const references=new Map(),missingReferences=[];
const sources=[...await walk(path.join(root,'src')),...await walk(path.join(root,'shared')),...(await fs.readdir(root)).filter(f=>/\.html$/.test(f)).map(f=>path.join(root,f))];
for(const file of sources){
  if(!/\.(?:[cm]?[jt]sx?|css|html|json|mts)$/.test(file))continue;
  const text=await fs.readFile(file,'utf8');const lines=text.split(/\r?\n/);
  for(let index=0;index<lines.length;index++)for(const match of lines[index].matchAll(/(['"`])((?:(?:\.\.\/)+|\/)?assets\/[\w./*?{}-]+\.(?:png|jpe?g|webp|gif|svg|json|mp[34]|m4a|wav|ogg))(?:\?[^'"`]*)?\1/g)){
    const ref=match[2].replace(/^(?:(?:\.\.\/)+|\/)/,'');
    const pattern=new RegExp('^'+ref.replace(/[.+^$()|[\]\\]/g,'\\$&').replaceAll('*','.*').replaceAll('?','.')+'$');
    const targets=/[*?{}]/.test(ref)?[...assetNames].filter(n=>pattern.test(n)):[ref];
    if(!targets.length)missingReferences.push({path:ref,source:relative(file),line:index+1,kind:'unmatched-glob'});
    for(const p of targets){
      const rows=references.get(p)??[];rows.push({source:relative(file),line:index+1,pattern:ref});references.set(p,rows);
      if(!assetNames.has(p))missingReferences.push({path:p,source:relative(file),line:index+1,kind:'literal'});
    }
  }
}
// Manifests describe relative character files that code deliberately loads dynamically.
for(const file of assetFiles.filter(f=>f.endsWith('.json'))){
  const data=JSON.parse(await fs.readFile(file,'utf8'));
  function visit(value){
    if(typeof value==='string'&&/\.(png|webp|jpe?g|gif|svg)$/.test(value)){
      for(const candidate of [value,slash(path.posix.join(path.posix.dirname(relative(file)),value)),path.posix.join('assets/characters',value)]){
        if(!assetNames.has(candidate))continue;
        const refs=references.get(candidate)??[];refs.push({source:relative(file),line:null,pattern:value});references.set(candidate,refs);
      }
    }else if(value&&typeof value==='object')Object.values(value).forEach(visit);
  }
  visit(data);
}
function role(p){
  if(p.startsWith('assets/maps/memories/'))return 'derived-scene-preview';
  if(p.startsWith('assets/maps/places/'))return 'place-background';
  if(p.startsWith('assets/drafts/'))return /(?:props|furniture|kit|decor|stand|chair)/.test(p)?'scene-prop-atlas':'scene-background';
  if(p.startsWith('assets/props/toys/'))return 'collectible-toy';
  if(p.startsWith('assets/props/'))return 'world-prop';
  if(p.startsWith('assets/ui/'))return p.includes('app-icon')?'third-party-app-icon':'desktop-ui-art';
  if(p.startsWith('assets/characters/'))return 'protected-character-resource';
  if(p.startsWith('assets/npcs/'))return 'protected-npc-resource';
  if(p.startsWith('assets/metadata/'))return 'metadata';
  if(/\.(mp4|m4a|mp3|ogg|wav)$/.test(p))return 'protected-media';
  if(p.startsWith('assets/tickets/'))return 'ticket-resource';
  if(p.startsWith('assets/maps/'))return 'legacy-map-resource';
  return 'documentation-or-other';
}
const assets=[];
for(const file of assetFiles){
  const p=relative(file),bytes=await fs.readFile(file),hash=sha(bytes),kind=role(p);
  let width=null,height=null,format=null,hasAlpha=null;
  if(/\.(png|jpe?g|webp|gif|svg)$/.test(p)){
    const meta=await sharp(bytes).metadata();({width,height,format,hasAlpha}=meta);
  }
  const history=evidence.get(p)??[],accepted=history.filter(r=>r.approved),matching=history.filter(r=>r.expectedSha256===hash),b=blocked.get(p);
  let status='existing-unreviewed';
  if(kind.startsWith('protected-')||kind==='third-party-app-icon')status='preserved-out-of-scope';
  if(kind==='derived-scene-preview')status='derived-preview-present-capture-not-verified';
  if(history.length)status=accepted.some(r=>r.expectedSha256===hash)?'generated-approved-hash-verified':accepted.length?'generated-approved-current-hash-needs-review':matching.length?'generated-recorded-hash-verified':'generated-recorded-current-hash-needs-review';
  if(b)status='unchanged-tool-blocked';
  assets.push({path:p,width:width??null,height:height??null,format:format??null,hasAlpha:hasAlpha??null,bytes:bytes.length,sha256:hash,role:kind,status,references:references.get(p)??[],evidence:history,...(b?{blocked:{reason:b.reason,requestId:b.requestId,preservedHashMatches:hash===b.preservedSha256}}:{})});
}
const duplicates=new Map();for(const a of assets.filter(a=>a.width)){const list=duplicates.get(a.sha256)??[];list.push(a.path);duplicates.set(a.sha256,list);}
const duplicateContent=[...duplicates].filter(([,paths])=>paths.length>1).map(([sha256,paths])=>({sha256,paths,note:'Identical bytes; keep canonical paths until references and purpose are reviewed.'}));
const version2References=assets.filter(a=>a.references.length&&/-v2\.(png|webp|jpg)$/.test(a.path)).map(a=>({path:a.path,status:a.status,role:a.role,references:a.references,note:a.evidence.length?'Historical v2 name; current refresh evidence exists.':'Historical v2 name; inspect current canonical use, never infer age from filename alone.'}));
const groups=new Map();
for(const a of assets.filter(a=>a.width&&['scene-background','place-background','legacy-map-resource'].includes(a.role))){
  const key=path.posix.dirname(a.path)+'/'+path.posix.basename(a.path).replace(/(?:-pixel)?-v\d+(?=\.)/,'');const list=groups.get(key)??[];list.push(a);groups.set(key,list);
}
const parallelCandidates=[...groups].filter(([,rows])=>rows.length>1).map(([family,rows])=>({family,active:rows.filter(a=>a.references.length).map(a=>a.path),candidates:rows.filter(a=>!a.references.length).map(a=>a.path),files:rows.map(a=>({path:a.path,status:a.status,referenceCount:a.references.length})),note:'Filename siblings are candidates for review; no file was moved or removed.'}));
const reviewCandidates=assets.filter(a=>a.width&&!a.references.length&&!a.role.startsWith('protected-')&&!['ticket-resource','third-party-app-icon'].includes(a.role)).map(a=>({path:a.path,role:a.role,status:a.status,reason:'No literal/glob/manifest production reference found; dynamic code or historical use may still apply.'}));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),root:slash(root),scope:'Only actual assets/ files. output/ review backups, staged candidates and generated source originals are excluded.',evidenceFiles:[...new Set(evidenceFiles)].sort(),counts:{files:assets.length,rasterOrVector:assets.filter(a=>a.width).length,generatedApproved:assets.filter(a=>a.status==='generated-approved-hash-verified').length,toolBlocked:blocked.size,missingReferences:missingReferences.length},blockedAssets:[...blocked.values()].map(b=>({path:b.asset,name:b.name,reason:b.reason,requestId:b.requestId})),assets,checks:{missingReferences,version2References,parallelBackgroundCandidates:parallelCandidates,duplicateContent,unreferencedReviewCandidates:reviewCandidates},limitations:['Reference scan covers source literals, globs and asset JSON manifests; constructed paths can need manual review.','A reused v2 filename is not evidence of an obsolete image. SHA-256 and final review records identify installed art.','Map previews need the final root capture report; inventory does not claim that an existing thumbnail has been recaptured.']};
await fs.mkdir(reportDir,{recursive:true});await fs.writeFile(path.join(reportDir,'asset-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:'output/art-refresh/asset-manifest.json',...report.counts,version2References:version2References.length,parallelBackgroundCandidates:parallelCandidates.length,duplicateGroups:duplicateContent.length,unreferencedReviewCandidates:reviewCandidates.length}));
