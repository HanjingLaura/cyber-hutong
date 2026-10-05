// Register complete redraws as atlas frames; never alter their pixels.
const fs=require('node:fs');
const {chromium}=require('./playwright.cjs').loadPlaywright();
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/members.html');
  const metadata=await page.evaluate(async()=>{
   const sources={},members={};
   for(const role of ['suki','sid','jilly','laura','kay','franco','cora','amber','celine']){
    const frames=[];
    for(const phase of ['a','b']){
     const file=`team/v8/${role}-${phase}.png`,image=new Image();image.src=`/assets/characters/${file}`;await image.decode();
     const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,image.width,image.height).data;
     if(pixels[3]!==0)throw Error(file+' has opaque background');
     const cuts=[0],bounds=[];
     for(let split=1;split<4;split++){
      const target=Math.round(split*image.width/4);let cut=null;
      for(let distance=0;distance<image.width/12&&cut===null;distance++)for(const x of [target-distance,target+distance]){
       let occupied=false;for(let y=0;y<image.height;y++)if(pixels[(y*image.width+x)*4+3]>192){occupied=true;break;}
       if(!occupied){cut=x;break;}
      }
      if(cut===null)throw Error(file+' has no clear gutter');cuts.push(cut);
     }
     cuts.push(image.width);
     for(let col=0;col<4;col++){
      const x0=cuts[col],x1=cuts[col+1];let left=x1,right=x0,top=image.height,bottom=0,count=0;
      for(let y=0;y<image.height;y++)for(let x=x0;x<x1;x++)if(pixels[(y*image.width+x)*4+3]>192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
      if(count<500||left<=x0||right>=x1-1||top<=0||bottom>=image.height-1)throw Error(file+' clipped or empty cell '+col);
      bounds.push({left,right,top,bottom});
     }
     const source=`${role}-walk-${phase}-v8`;sources[source]={file,size:[image.width,image.height]};
     const baseline=Math.max(...bounds.map(b=>b.bottom)),referenceHeight=Math.max(...bounds.map(b=>baseline-b.top+1));
     bounds.forEach((b,col)=>{
      const w=b.right-b.left+1,h=baseline-b.top+1;let sum=0,count=0;
      for(let y=Math.round(b.top+h*.22);y<Math.round(b.top+h*.38);y++)for(let x=b.left;x<=b.right;x++)if(pixels[(y*image.width+x)*4+3]>192){sum+=x;count++;}
      const pivotX=(sum/count-b.left)/w;
      frames.push({name:`walk-side-v8-${col+(phase==='b'?4:0)}`,source,rect:[b.left,b.top,w,h],referenceHeight,pivotX,foot:[w*pivotX,h],seat:[w*pivotX,h*.72],grip:null,gripSide:0,slot:null});
     });
    }
    members[role]={frames,walkLoop:[0,1,2,3,4,5,6,7],sideWalkFrameMs:100};
   }
   return {sources,members};
  });
  fs.writeFileSync('assets/metadata/team-walk-v8.json',JSON.stringify(metadata,null,2)+'\n');
  console.log('Registered nine complete eight-frame walking cycles.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
