const fs=require('node:fs');const {chromium}=require('./playwright.cjs').loadPlaywright();
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/members.html');
 const roles=process.argv.slice(2);const metadata=await page.evaluate(async roles=>{
  const sources={},members={};
  for(const role of roles){
   const file=`team/v10/${role}-run.png`,image=new Image();image.src='/assets/characters/'+file;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;
   if(pixels[3]!==0)throw Error(file+' background is not transparent: '+pixels[3]);
   const source=`${role}-run-v10`,frames=[];sources[source]={file,size:[image.width,image.height]};
   let middle=null;
   for(let distance=0;distance<image.height/12&&middle===null;distance++)for(const y of [Math.floor(image.height/2)-distance,Math.floor(image.height/2)+distance]){
    let occupied=false;for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>192){occupied=true;break;}
    if(!occupied){middle=y;break;}
   }
   if(middle===null)throw Error(file+' has no clear horizontal gutter');
   for(let row=0;row<2;row++){
    const y0=row===0?0:middle,y1=row===0?middle:image.height,cuts=[0],bounds=[];
    for(let split=1;split<4;split++){
     const target=Math.round(split*image.width/4);let cut=null;
     for(let distance=0;distance<image.width/12&&cut===null;distance++)for(const x of [target-distance,target+distance]){
      let occupied=false;for(let y=y0;y<y1;y++)if(pixels[(y*image.width+x)*4+3]>192){occupied=true;break;}
      if(!occupied){cut=x;break;}
     }
     if(cut===null)throw Error(file+' no clear gutter');cuts.push(cut);
    }
    cuts.push(image.width);
    for(let col=0;col<4;col++){
     const x0=cuts[col],x1=cuts[col+1];let left=x1,right=x0,top=y1,bottom=y0,count=0;
     for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*image.width+x)*4+3]>192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
     if(count<500||left<=0||right>=image.width-1||top<=0||bottom>=image.height-1)throw Error(file+' clipped/empty frame '+(row*4+col)+' '+JSON.stringify({left,right,top,bottom,x0,x1,y0,y1}));
     bounds.push({left,right,top,bottom});
    }
    const baseline=Math.max(...bounds.map(b=>b.bottom)),referenceHeight=Math.max(...bounds.map(b=>baseline-b.top+1));
    bounds.forEach((b,col)=>{const w=b.right-b.left+1,h=baseline-b.top+1;frames.push({name:`run-side-v10-${row*4+col}`,source,rect:[b.left,b.top,w,h],referenceHeight,pivotX:.5,foot:[w/2,h],seat:[w/2,h*.72],grip:null,gripSide:0,slot:null});});
   }
   members[role]={frames,runLoop:[0,1,2,3,4,5,6,7],runFrameMs:75};
  }
  return {sources,members};
 },roles.length?roles:['suki','sid','jilly','laura','kay','franco','cora','amber','celine']);
 fs.writeFileSync('assets/metadata/team-run-v10.json',JSON.stringify(metadata,null,2)+'\n');console.log('Registered '+Object.keys(metadata.members).join(', '));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
