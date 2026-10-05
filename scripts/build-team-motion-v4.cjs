// Read complete generated poses as atlas frames; never recombine body parts.
const fs=require('node:fs');
const {chromium}=require('./playwright.cjs').loadPlaywright();
const roles=['suki','sid','jilly','laura','kay','franco','cora','amber','celine'];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/members.html');
  const registry=await page.evaluate(async roles=>{
   const sources={},members={};
   for(const role of roles){
    const image=new Image();image.src=`/assets/characters/team/v4/${role}-motion.png`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    if(pixels[3]!==0)throw Error(role+' background is not transparent');
    const bounds=[];
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
     const x0=Math.round(col*canvas.width/2),x1=Math.round((col+1)*canvas.width/2),y0=row*canvas.height/2,y1=(row+1)*canvas.height/2;
     let left=x1,right=x0,top=y1,bottom=y0,count=0;
     for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*canvas.width+x)*4+3]>192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
     if(count<500||left<=x0||right>=x1-1||top<=y0||bottom>=y1-1)throw Error(`${role} clipped/empty cell ${row}:${col}`);
     bounds.push({left,right,top,bottom});
    }
    const referenceHeight=Math.max(...bounds.map(b=>b.bottom-b.top+1));
    const source=role+'-motion-v4';sources[source]={file:`team/v4/${role}-motion.png`,size:[canvas.width,canvas.height]};
    const frames=bounds.map((b,index)=>{
     // Common row baseline preserves foot lift; align bodies from the torso,
     // rather than a centroid that moves with the leading shoe.
     const bottom=Math.max(...bounds.slice(index<2?0:2,index<2?2:4).map(b=>b.bottom));
     const w=b.right-b.left+1,h=bottom-b.top+1;
     let sum=0,count=0;
     for(let y=Math.round(b.top+(b.bottom-b.top)*.48);y<Math.round(b.top+(b.bottom-b.top)*.60);y++)for(let x=b.left;x<=b.right;x++)if(pixels[(y*canvas.width+x)*4+3]>192){sum+=x;count++;}
     const pivotX=(sum/count-b.left)/w;
     return{name:`${index<2?'walk':'run'}-side-v4-${index%2}`,source,rect:[b.left,b.top,w,h],referenceHeight,pivotX,foot:[w*pivotX,h],seat:[w*pivotX,h*.72],grip:null,gripSide:0,slot:null};
    });
    members[role]={frames,walkLoop:[0,1],runLoop:[2,3]};
   }
   return {sources,members};
  },roles);
  fs.writeFileSync('assets/metadata/team-motion-v4.json',JSON.stringify(registry,null,2)+'\n');
  console.log('Registered 36 complete redrawn motion poses for nine characters.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
