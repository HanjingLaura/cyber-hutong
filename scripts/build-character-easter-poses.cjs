// Register complete generated character poses without modifying source pixels.
const fs=require('node:fs');
const {chromium}=require('./playwright.cjs').loadPlaywright();
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();
  for(const [source,file,names,frameMs]of [
   ['franco-office-call-v1','team/v12/franco-office-call.png',['call-front-0','call-front-1','call-back-0','call-back-1'],600],
   ['laura-saxophone-v1','team/v12/laura-saxophone.png',['saxophone-front-0','saxophone-front-1','saxophone-front-2','saxophone-front-3'],320],
  ]){
  const atlas=await page.evaluate(async url=>{
   const image=new Image();image.src=url;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   if(pixels[3]!==0)throw Error('Character sheet requires transparent alpha');
   const bounds=[];
   for(let row=0;row<2;row++)for(let col=0;col<2;col++){
    const x0=col*canvas.width/2,x1=(col+1)*canvas.width/2,y0=row*canvas.height/2,y1=(row+1)*canvas.height/2;
    let left=x1,right=x0,top=y1,bottom=y0,count=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*canvas.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
    if(count<500||left<=x0||right>=x1-1||top<=y0||bottom>=y1-1)throw Error('Empty or clipped pose '+row+':'+col);
    bounds.push({left,right,top,bottom});
   }
   return {size:[canvas.width,canvas.height],bounds};
  },'data:image/png;base64,'+fs.readFileSync('assets/characters/'+file).toString('base64'));
  const referenceHeight=Math.max(...atlas.bounds.map(b=>b.bottom-b.top+1));
  const frames=atlas.bounds.map((b,index)=>{
   const row=atlas.bounds.slice(index<2?0:2,index<2?2:4);
   const top=Math.min(...row.map(b=>b.top)),bottom=Math.max(...row.map(b=>b.bottom));
   const w=b.right-b.left+1,h=bottom-top+1;
   return {name:names[index],source,rect:[b.left,top,w,h],referenceHeight,pivotX:.5,foot:[w/2,h],seat:[w/2,h*.72],grip:null,gripSide:0,slot:null};
  });
  fs.writeFileSync('assets/metadata/'+source+'.json',JSON.stringify({sources:{[source]:{file,size:atlas.size}},frames,frameMs},null,2)+'\n');
  console.log('Registered four transparent poses: '+source);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
