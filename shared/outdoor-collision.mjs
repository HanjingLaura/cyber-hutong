// Coordinates are ground contacts on the 640x360 artwork, not avatar head bounds.
// The distant street/building facades are scenery, not a same-scale play surface.
export const campusCones=[{x:210,y:265,radius:7},{x:410,y:265,radius:7}];
const campusFloor=[[10,250],[118,228],[222,213],[282,207],[372,207],[439,215],[526,228],[630,250],[630,352],[10,352]];
function polygon(x,y,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[i],[bx,by]=points[j];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
function surface(scene,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 return scene==='street'?x>=10&&x<=630&&y>=226&&y<=352:scene==='campus'&&polygon(x,y,campusFloor);
}
function disc(scene,x,y,radius){
 if(!surface(scene,x,y))return false;
 for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!surface(scene,x+Math.cos(a)*radius,y+Math.sin(a)*radius))return false;}
 return scene!=='campus'||campusCones.every(c=>Math.hypot(x-c.x,y-c.y)>=c.radius+radius);
}
// Keep avatar centers inside the realtime room's existing 20..620 clamp too.
export function outdoorWalkable(scene,x,y){return x>=20&&x<=620&&disc(scene,x,y,5);}
export function scooterWalkable(x,y){
 // The side-view scooter remains horizontal in the renderer, even in a turn.
 for(let dx=-46;dx<=46;dx+=23)for(const dy of [-7,0,7])if(!surface('street',x+dx,y+dy))return false;
 return true;
}
export function skateboardWalkable(x,y){
 if(!outdoorWalkable('campus',x,y))return false;
 // The board stays horizontal at every movement direction, matching its artwork.
 for(let d=-22;d<=22;d+=4)if(!disc('campus',x+d,y,4))return false;
 return true;
}
export function scooterPathClear(ax,ay,bx,by){
 if(![ax,ay,bx,by].every(Number.isFinite))return false;
 const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/2));
 for(let i=0;i<=steps;i++)if(!scooterWalkable(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps))return false;
 return true;
}
// Ground footprint: 92px body + the walker's 5px radius, with 7px depth.
// Test the whole segment, since HTTP poses are less frequent than rendered frames.
export function walkerScooterPathClear(ax,ay,bx,by,scooter){
 if(![ax,ay,bx,by].every(Number.isFinite))return false;
 if(!scooter||!Number.isFinite(scooter.x)||!Number.isFinite(scooter.y))return true;
 const penetration=(x,y)=>Math.max(0,Math.min(51-Math.abs(x-scooter.x),12-Math.abs(y-scooter.y)));
 let previous=penetration(ax,ay);
 const distance=Math.hypot(bx-ax,by-ay);
 if(distance<1e-9)return previous===0;
 const steps=Math.max(1,Math.ceil(distance/2));
 for(let i=1;i<=steps;i++){
  const depth=penetration(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps);
  if(depth>0&&(previous===0||depth>previous+1e-8))return false;
  previous=depth;
 }
 return true;
}
export function scooterDismountPoint(x,y,scooter){
 const [sx,sy]=safeOutdoorPoint('street',x,y);
 const clear=(a,b)=>outdoorWalkable('street',a,b)&&walkerScooterPathClear(a,b,a,b,scooter);
 if(clear(sx,sy))return [sx,sy];
 for(let r=1;r<=640;r++){
  // Prefer the pavement immediately in front, then behind the vehicle.
  for(const [dx,dy] of [[0,r],[0,-r],[-r,0],[r,0]])if(clear(sx+dx,sy+dy))return [sx+dx,sy+dy];
 }
 return [580,330];
}
export function safeOutdoorPoint(scene,x,y,mode='walk'){
 const valid=mode==='scooter'?scooterWalkable:(a,b)=>outdoorWalkable(scene,a,b);
 if(valid(x,y))return [x,y];
 const ox=Math.round(Math.max(0,Math.min(640,Number.isFinite(x)?x:580))),oy=Math.round(Math.max(0,Math.min(360,Number.isFinite(y)?y:330)));
 for(let r=2;r<=640;r+=2){
  for(let d=-r;d<=r;d+=2)for(const [dx,dy] of [[d,-r],[d,r],[-r,d],[r,d]])if(valid(ox+dx,oy+dy))return [ox+dx,oy+dy];
 }
 return [580,330];
}
