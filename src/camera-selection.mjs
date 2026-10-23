/** Integer source pixels, independent of CSS scale, device DPR and drag direction. */
export function cropRect(start,end,width,height){
 if(![start.x,start.y,end.x,end.y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
 const clamp=(v,max)=>Math.max(0,Math.min(max,v));
 const x=Math.floor(clamp(Math.min(start.x,end.x),width)),y=Math.floor(clamp(Math.min(start.y,end.y),height));
 const right=Math.ceil(clamp(Math.max(start.x,end.x),width)),bottom=Math.ceil(clamp(Math.max(start.y,end.y),height));
 return right-x>=8&&bottom-y>=8?{x,y,width:right-x,height:bottom-y}:null;
}
