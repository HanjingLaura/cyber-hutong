async(page)=>{
 await page.goto('http://127.0.0.1:5173/members.html');
 return await page.evaluate(async()=>{
  const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
  const specs=roles.flatMap(role=>[{id:role,src:'/assets/characters/team/v3/'+role+'.png',cols:8,rows:4},{id:role+'-carry',src:'/assets/characters/team/v3/'+role+'-carry.png',cols:4,rows:5}]);
  for(const [id,cols,rows] of [['idle',4,1],['walk',4,4],['side',6,2],['sit',3,2],['hold',4,5],['seatHold',3,1],['curl',3,1],['dance',4,2]])specs.push({id:'laura-'+id,src:'/assets/characters/laura/approved/'+id+'.png',cols,rows,legacy:true});
  const results={};
  for(const spec of specs){
   const im=new Image();im.src=spec.src;await im.decode();
   const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
   const seen=new Uint8Array(c.width*c.height),parts=[];
   function components(x0,y0,x1,y1){
    const out=[];
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
     const start=y*c.width+x;if(seen[start]||pixels[start*4+3]<=192)continue;seen[start]=1;
     const q=[start];let l=x,r=x,t=y,b=y;
     for(let k=0;k<q.length;k++){
      const j=q[k],cx=j%c.width,cy=Math.floor(j/c.width);l=Math.min(l,cx);r=Math.max(r,cx);t=Math.min(t,cy);b=Math.max(b,cy);
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
       if(cx+ox<x0||cx+ox>=x1||cy+oy<y0||cy+oy>=y1)continue;
       const n=j+oy*c.width+ox;if(!seen[n]&&pixels[n*4+3]>192){seen[n]=1;q.push(n);}
      }
     }
     if(q.length>200)out.push({rect:[l,t,r-l+1,b-t+1],count:q.length});
    }
    return out;
   }
   if(spec.legacy){
    const xcuts=spec.id==='laura-hold'?[0,.32,.51,.70,1]:Array.from({length:spec.cols+1},(_,i)=>i/spec.cols);
    const ycuts=spec.id==='laura-hold'?[0,.207,.412,.609,.808,1]:Array.from({length:spec.rows+1},(_,i)=>i/spec.rows);
    for(let row=0;row<spec.rows;row++)for(let col=0;col<spec.cols;col++){
     const body=components(Math.round(xcuts[col]*c.width),Math.round(ycuts[row]*c.height),Math.round(xcuts[col+1]*c.width),Math.round(ycuts[row+1]*c.height)).sort((a,b)=>b.count-a.count)[0];
     if(!body)throw Error(spec.id+' empty cell '+row+':'+col);parts.push(body);
    }
   }else{
    const bodies=components(0,0,c.width,c.height).sort((a,b)=>b.count-a.count);
    if(bodies.length!==spec.cols*spec.rows)throw Error(spec.id+' expected '+spec.cols*spec.rows+' isolated poses, got '+bodies.length);
    bodies.sort((a,b)=>a.rect[1]-b.rect[1]);
    for(let row=0;row<spec.rows;row++)parts.push(...bodies.slice(row*spec.cols,(row+1)*spec.cols).sort((a,b)=>a.rect[0]-b.rect[0]));
   }
   const frames=parts.map(({rect},index)=>{
    const [left,top,w,h]=rect;let sum=0,count=0;
    for(let y=top+Math.floor(h*.88);y<top+h;y++)for(let x=left;x<left+w;x++)if(pixels[(y*c.width+x)*4+3]>192){sum+=x;count++;}
    const pivotX=count?(sum/count-left)/w:.5;
    let grip=null,side=0;
    if(spec.id.endsWith('-carry')){
     const direction=index<4?['front','right','back','left'][index]:index<8?'front':index<12?'right':index<16?'back':['front','back','right','left'][index-16];
     side=['front','left'].includes(direction)?-1:1;
     const skin=[];
     for(let y=top+Math.floor(h*.52);y<top+h*.78;y++)for(let x=left;x<left+w;x++){
      const at=(y*c.width+x)*4,[r,g,b,a]=pixels.slice(at,at+4);
      if(a>192&&r>180&&g>105&&b>65&&r>g*1.1&&r>b*1.3&&((x-left)/w-.5)*side>-.08)skin.push([x-left,y-top]);
     }
     if(!skin.length)throw Error(spec.id+' missing grip '+index);
     grip=[skin.reduce((s,p)=>s+p[0],0)/skin.length,skin.reduce((s,p)=>s+p[1],0)/skin.length];
    }
    return{rect,pivotX,grip,gripSide:side};
   });
   results[spec.id]={size:[im.width,im.height],frames};
  }
  return results;
 });
}
