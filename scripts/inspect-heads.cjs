const fs=require('node:fs');const {chromium}=require('./playwright.cjs').loadPlaywright();
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/members.html');const result=await page.evaluate(async metadata=>{
 const report={};
 for(const [role,member]of Object.entries(metadata.members)){
  report[role]=[];
  for(const frame of member.frames){
   const im=new Image();im.src='/assets/characters/'+metadata.sources[frame.source].file;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,im.width,im.height).data,[bx,by,w,h]=frame.rect;
   const startY=by+Math.floor(h*.1),endY=by+Math.floor(h*.42),visited=new Set(),components=[];
   const white=(x,y)=>{const i=(y*im.width+x)*4;return p[i+3]>192&&Math.min(p[i],p[i+1],p[i+2])>205;};
   for(let y=startY;y<endY;y++)for(let x=bx;x<bx+w;x++){
    const key=y*im.width+x;if(visited.has(key)||!white(x,y))continue;
    let left=x,right=x,top=y,bottom=y,count=0;const queue=[[x,y]];visited.add(key);
    for(let q=0;q<queue.length;q++){const [cx,cy]=queue[q];count++;left=Math.min(left,cx);right=Math.max(right,cx);top=Math.min(top,cy);bottom=Math.max(bottom,cy);
     for(const [nx,ny]of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){const k=ny*im.width+nx;if(nx<bx||nx>=bx+w||ny<startY||ny>=endY||visited.has(k)||!white(nx,ny))continue;visited.add(k);queue.push([nx,ny]);}
    }
    if(count>20)components.push({left,right,top,bottom,count});
   }
   components.sort((a,b)=>b.count-a.count);report[role].push({phase:frame.name,ref:frame.referenceHeight,h,components:components.slice(0,2)});
  }
 }
 return report;
},JSON.parse(fs.readFileSync('assets/metadata/team-walk-v8.json')));fs.writeFileSync('output/head-inspection.json',JSON.stringify(result,null,2));for(const [r,frames]of Object.entries(result))console.log(r,frames.map(f=>({phase:f.phase.split('-').at(-1),ref:f.ref,eye:f.components[0]})));}finally{await browser.close();}})();
