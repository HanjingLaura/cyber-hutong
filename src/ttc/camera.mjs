export const clampCamera=(x,width,viewport=1280)=>Math.max(0,Math.min(width-viewport,x));
export const worldPoint=(x,y,camera)=>({x:x+camera,y});
export function dragCamera(startCamera,startX,currentX,canvasWidth,worldWidth){
 return clampCamera(startCamera+(startX-currentX)*1280/canvasWidth,worldWidth);
}
