// Analyze alpha components only: retain generated artwork pixels unchanged.
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const [source,target,columnsArg,rowsArg,countArg]=process.argv.slice(2),columns=Number(columnsArg),rows=Number(rowsArg),count=Number(countArg);
if(!source||!target||![columns,rows,count].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('source target columns rows count');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const w=info.width,h=info.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),groups=Array.from({length:columns*rows},()=>[]);
for(let start=0;start<w*h;start++){
 if(seen[start]||data[start*4+3]<=192)continue;
 let head=0,tail=1,left=w,top=h,right=0,bottom=0,sumX=0,sumY=0;queue[0]=start;seen[start]=1;
 while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);sumX+=x;sumY+=y;
  for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!seen[n]&&data[n*4+3]>192){seen[n]=1;queue[tail++]=n;}
 }
 if(tail>=80){const col=Math.min(columns-1,Math.floor(sumX/tail/w*columns)),row=Math.min(rows-1,Math.floor(sumY/tail/h*rows));groups[row*columns+col].push({left,top,right,bottom,pixels:tail});}
}
const frames=groups.slice(0,count).map((parts,index)=>{if(!parts.length)throw Error('empty sprite '+index);const left=Math.min(...parts.map(p=>p.left)),top=Math.min(...parts.map(p=>p.top)),right=Math.max(...parts.map(p=>p.right)),bottom=Math.max(...parts.map(p=>p.bottom));return{x:left,y:top,width:right-left,height:bottom-top};});
await writeFile(target,JSON.stringify({sourceWidth:w,sourceHeight:h,columns,rows,frames},null,2));console.log(JSON.stringify({source,target,frames:frames.length}));
