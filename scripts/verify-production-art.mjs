// Controlled, read-only browser check of the released canonical image build.
import assert from 'node:assert/strict';
import {readdir,mkdir,writeFile,readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {loadPlaywright} from './playwright.mjs';
const directory='output/production-pixel-art-assets-'+Date.now();await mkdir(directory,{recursive:true});
const prefixes=['ktv-room-v1-','street-','campus-','noodle-room-v3-','meeting-chairs-v2-','products-','gacha-products-','desk-monitor-'];
const files=await readdir('dist/assets'),all=process.argv.includes('--all');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let expected;
if(all){
 const manifest=JSON.parse(await readFile('output/art-refresh/asset-manifest.json','utf8'));
 expected=await Promise.all(manifest.assets.filter(a=>a.status==='generated-approved-hash-verified').map(async asset=>{
  const raw=await readFile(asset.path);assert.equal(sha(raw),asset.sha256,'stale canonical '+asset.path);
  const prefix=basename(asset.path,'.png')+'-';
  const candidates=files.filter(file=>file.startsWith(prefix)&&/^[A-Za-z0-9_-]{8}\.(png|webp)$/.test(file.slice(prefix.length)));
  assert.ok(candidates.length<=1,'ambiguous build asset '+asset.path);
  const file=candidates[0]??null,bytes=file?await readFile('dist/assets/'+file):raw,m=await sharp(bytes).metadata();
  return {source:asset.path,file,width:m.width,height:m.height,url:file?'assets/'+file:'data:image/png;base64,'+bytes.toString('base64'),sha256:sha(bytes)};
 }));
 assert.ok(expected.length>0,'approved asset manifest must not be empty');
 assert.equal(expected.length,manifest.assets.filter(a=>a.status==='generated-approved-hash-verified').length,'all approved assets must be included');
}else expected=await Promise.all(prefixes.map(async prefix=>{const file=files.find(name=>name.startsWith(prefix)&&/\.(png|webp)$/.test(name));assert.ok(file,prefix);const m=await sharp('dist/assets/'+file).metadata();return {file,width:m.width,height:m.height,url:'assets/'+file};}));
if(process.argv.includes('--zhu')){
 for(const name of ['zhu-zhixin-green','zhu-zhixin-winter-green']){
  const file=files.find(file=>file.startsWith(name+'-')&&/\.(png|webp)$/.test(file));assert.ok(file,'missing Zhu build asset '+name);
  const bytes=await readFile('dist/assets/'+file),source='assets/npcs/'+name+'.png';
  const m=await sharp(bytes).metadata(),original=await sharp(source).metadata();assert.equal(m.width,original.width);assert.equal(m.height,original.height);
  expected.push({source,file,width:m.width,height:m.height,url:'assets/'+file,sha256:sha(bytes)});
 }
}
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
const scripts=[],imageBodies=new Map();
page.on('response',response=>{const url=response.url();if(/\.js(?:\?|$)/.test(url))scripts.push(response.text().catch(()=>''));if(/\.(png|webp)(?:\?|$)/.test(url))imageBodies.set(basename(new URL(url).pathname),response.body().catch(()=>null));});
const report={allApprovedAssets:all,passed:false,scope:'production browser image reads only; no login, writes or model calls',images:[]};
try{
 await page.goto('https://hanjing-laura.vercel.app/cyber-hutong/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('#account-dialog[open]').waitFor({timeout:30000});
 const deployedScripts=(await Promise.all(scripts)).join('\n');
 for(const item of expected.filter(item=>!item.file))assert.ok(deployedScripts.includes(item.url),'inline asset absent from deployed script: '+item.source);
 report.images=await page.evaluate(async expected=>{const rows=[];for(let offset=0;offset<expected.length;offset+=8)rows.push(...await Promise.all(expected.slice(offset,offset+8).map(item=>new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>reject(Error('Image timeout: '+item.file)),30000);image.onload=()=>{clearTimeout(timer);resolve({file:item.file,width:image.naturalWidth,height:image.naturalHeight});};image.onerror=()=>{clearTimeout(timer);reject(Error('Image failed: '+item.file));};image.src=new URL(item.url,location.href).href;}))));return rows;},expected);
 assert.deepEqual(report.images,expected.map(({file,width,height})=>({file,width,height})));
 if(all){for(const item of expected.filter(item=>item.file)){assert.ok(imageBodies.has(item.file),'missing browser response '+item.file);const body=await imageBodies.get(item.file);assert.ok(body,'incomplete browser response '+item.file);assert.equal(sha(body),item.sha256,'deployed image bytes differ '+item.file);}
 report.externalImages=expected.filter(item=>item.file).length;report.inlineImages=expected.filter(item=>!item.file).length;report.canonicalSources=expected.map(({source,file,sha256})=>({source,file,sha256}));}
 report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}
finally{await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({directory,...report}));}
