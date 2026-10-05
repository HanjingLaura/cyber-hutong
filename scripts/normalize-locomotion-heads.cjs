// Measure existing sprite pixels. Normalization is stored as rendering metadata;
// the complete PNGs and approved limb overlaps remain untouched.
const fs=require('node:fs');
const {chromium}=require('D:/CodexHome/mcp/node/node_modules/playwright');
async function measureHeads({metadata,targets}){
 const images=new Map();
 for(const [role,member]of Object.entries(metadata.members)){
  const measurements=[];
  for(const frame of member.frames){
   if(!images.has(frame.source)){
    const image=new Image();image.src='/assets/characters/'+metadata.sources[frame.source].file;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    images.set(frame.source,{width:image.width,pixels:ctx.getImageData(0,0,image.width,image.height).data});
   }
   const {width,pixels:p}=images.get(frame.source),[bx,by,w,h]=frame.rect;
   const startY=by+Math.floor(h*.1),endY=by+Math.floor(h*.44),visited=new Set(),components=[];
   const white=(x,y)=>{const i=(y*width+x)*4;return p[i+3]>192&&Math.min(p[i],p[i+1],p[i+2])>205;};
   for(let y=startY;y<endY;y++)for(let x=bx;x<bx+w;x++){
    const key=y*width+x;if(visited.has(key)||!white(x,y))continue;
    let left=x,right=x,top=y,bottom=y,count=0;const queue=[[x,y]];visited.add(key);
    for(let q=0;q<queue.length;q++){
     const [cx,cy]=queue[q];count++;left=Math.min(left,cx);right=Math.max(right,cx);top=Math.min(top,cy);bottom=Math.max(bottom,cy);
     for(const [nx,ny]of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){
      const k=ny*width+nx;if(nx<bx||nx>=bx+w||ny<startY||ny>=endY||visited.has(k)||!white(nx,ny))continue;
      visited.add(k);queue.push([nx,ny]);
     }
    }
    // The profile eye is a narrow white component; reject shirt/lapel highlights.
    if(count>20&&bottom-top>5&&right-left<(bottom-top)*1.5&&top>by+h*.2)components.push({left,right,top,bottom,count});
   }
   components.sort((a,b)=>b.count-a.count);const eye=components[0];if(!eye)throw Error(role+' '+frame.name+' has no eye landmark');
   const landmarkHeight=eye.bottom-by+1;let left=bx+w,right=bx;
   // Measure the skull cap above the eyes; swinging arms and flowing hair tips
   // are excluded, unlike the full-character bounding box.
   for(let y=by+Math.round(landmarkHeight*.45);y<=by+Math.round(landmarkHeight*.65);y++)for(let x=bx;x<bx+w;x++)if(p[(y*width+x)*4+3]>192){left=Math.min(left,x);right=Math.max(right,x);}
   const headWidth=right-left+1,centerX=(left+right)/2-bx;
   measurements.push({headWidth,landmarkHeight,centerX,originalReferenceHeight:frame.headMetrics?.originalReferenceHeight??frame.referenceHeight});
  }
  const first=measurements[0],target=targets?.[role]??member.headTarget??{width:first.headWidth/first.originalReferenceHeight,landmark:first.landmarkHeight/first.originalReferenceHeight,top:member.frames[0].rect[3]/first.originalReferenceHeight};
  member.headTarget=target;
  member.frames.forEach((frame,i)=>{
   const m=measurements[i],w=frame.rect[2],h=frame.rect[3];
   frame.referenceHeight=m.landmarkHeight/target.landmark;
   frame.scaleXRatio=target.width*frame.referenceHeight/m.headWidth;
   frame.pivotX=m.centerX/w;
   frame.offsetYRatio=h/frame.referenceHeight-target.top;
   frame.headMetrics=m;
   frame.foot=[w*frame.pivotX,h];
  });
 }
 return metadata;
}
(async()=>{
 const mode=process.argv[2]??'walk',version=mode==='walk'?'v8':mode==='carry'?'v12':'v10',path=`assets/metadata/team-${mode}-${version}.json`,metadata=JSON.parse(fs.readFileSync(path));
 // Re-running reads the original atlas registration, never compounds a transform.
 const targets=mode!=='walk'?Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync('assets/metadata/team-walk-v8.json')).members).map(([role,member])=>[role,member.headTarget])):undefined;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/members.html');const normalized=await page.evaluate(measureHeads,{metadata,targets});fs.writeFileSync(path,JSON.stringify(normalized,null,2)+'\n');
  for(const [role,member]of Object.entries(normalized.members))console.log(role,member.frames.map(f=>({phase:f.name.split('-').at(-1),scaleX:+f.scaleXRatio.toFixed(3),offsetY:+f.offsetYRatio.toFixed(3)})));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
