/** Direct screen-space controls shared by scooters and skateboards. */
export function stepRide(state,input,delta,walkable,{maxSpeed=130,acceleration=2200,deceleration=1950}={}){
 let remaining=Number.isFinite(delta)?Math.max(0,Math.min(50,delta))/1000:0;
 let x=state.x,y=state.y,heading=state.heading??Math.PI;
 let vx=state.vx??Math.cos(heading)*(state.speed??0),vy=state.vy??Math.sin(heading)*(state.speed??0);
 if(state.speed===0){vx=0;vy=0;}
 const initialSpeed=Math.hypot(vx,vy);if(initialSpeed>maxSpeed){vx*=maxSpeed/initialSpeed;vy*=maxSpeed/initialSpeed;}
 let ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0;
 const magnitude=Math.hypot(ix,iy);if(magnitude>1){ix/=magnitude;iy/=magnitude;}
 const targetX=ix*maxSpeed,targetY=iy*maxSpeed,rate=magnitude>0?acceleration:deceleration;
 while(remaining>1e-8){
  const dt=Math.min(.008,2/Math.max(1,maxSpeed),remaining),difference=Math.hypot(targetX-vx,targetY-vy);
  let nextX=targetX,nextY=targetY,dx,dy;
  if(difference>1e-9){
   const t=Math.min(dt,difference/rate),ax=(targetX-vx)/difference*rate,ay=(targetY-vy)/difference*rate;
   nextX=t<dt?targetX:vx+ax*t;nextY=t<dt?targetY:vy+ay*t;
   dx=vx*t+ax*t*t/2+targetX*(dt-t);dy=vy*t+ay*t*t/2+targetY*(dt-t);
  }else{dx=vx*dt;dy=vy*dt;}
  const nextSpeed=Math.hypot(nextX,nextY),nextHeading=nextSpeed>1e-6?Math.atan2(nextY,nextX):heading;
  if(walkable(x+dx,y+dy)){x+=dx;y+=dy;vx=nextX;vy=nextY;}
  else{
   let moved=false;vx=0;vy=0;
   if(Math.abs(dx)>1e-9&&walkable(x+dx,y)){x+=dx;vx=nextX;moved=true;}
   if(Math.abs(dy)>1e-9&&walkable(x,y+dy)){y+=dy;vy=nextY;moved=true;}
   if(!moved){vx=0;vy=0;break;}
  }
  heading=nextHeading;
  remaining-=dt;
 }
 return {...state,x,y,speed:Math.hypot(vx,vy),heading,vx,vy};
}
