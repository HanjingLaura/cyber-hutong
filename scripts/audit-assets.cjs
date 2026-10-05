const fs=require('node:fs'),path=require('node:path');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name).replaceAll('\\','/')]);
const retained=new Set(),queue=[];
function keep(file){file=path.posix.normalize(file.replaceAll('\\','/'));if(!file.startsWith('assets/')||!fs.existsSync(file)||retained.has(file))return;retained.add(file);if(file.endsWith('.json'))queue.push(file);}
for(const file of [...walk('src'),...walk('shared'),...fs.readdirSync('.').filter(f=>f.endsWith('.html'))]){
 const text=fs.readFileSync(file,'utf8');
 for(const m of text.matchAll(/(?:\.\.\/|\/)?assets\/[\w./-]+\.(?:png|webp|jpg|jpeg|gif|svg|json|mp3|wav|ogg)/g))keep(m[0].replace(/^(?:\.\.\/|\/)/,''));
}
while(queue.length){const file=queue.shift(),data=JSON.parse(fs.readFileSync(file,'utf8'));const visit=value=>{
 if(typeof value==='string'&&/\.(png|webp|jpg|jpeg|gif|svg|json|mp3|wav|ogg)$/.test(value)){
  for(const candidate of [value,path.posix.join(path.posix.dirname(file),value),path.posix.join('assets/characters',value)])keep(candidate);
 }else if(value&&typeof value==='object')Object.values(value).forEach(visit);
};visit(data);}
const unused=walk('assets').filter(file=>!retained.has(file)&&/\.(png|webp|jpg|jpeg|gif|svg|json|txt)$/.test(file));
const screenshots=walk('output').filter(file=>/\.(png|jpg|webp|gif)$/.test(file));
const removed=[...unused,...screenshots].map(file=>({file,bytes:fs.statSync(file).size}));
const report={retained:[...retained].sort(),removed,count:removed.length,bytes:removed.reduce((n,f)=>n+f.bytes,0)};
fs.writeFileSync('output/asset-cleanup-plan.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({retained:retained.size,unusedAssets:unused.length,screenshots:screenshots.length,megabytes:Math.round(report.bytes/1048576),unused},null,2));
