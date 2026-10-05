import Phaser from 'phaser';

type Point = { x:number; y:number };
// Wall ceiling and skirting meet at the same projected vanishing point.
// Every horizontal feature on this side wall must meet that point too.
const vanishing={x:61,y:12};
const wallPoint=(x:number,leftY:number):Point=>({x,y:Math.round(vanishing.y+(leftY-vanishing.y)*(vanishing.x-x)/(vanishing.x-6))});
const wallQuad=(left:number,right:number,top:number,bottom:number)=>[
  wallPoint(left,top),wallPoint(right,top),wallPoint(right,bottom),wallPoint(left,bottom),
];
const pane = wallQuad(8,32,50,200);
const interpolate=(a:Point,b:Point,t:number)=>({x:Math.round(a.x+(b.x-a.x)*t),y:Math.round(a.y+(b.y-a.y)*t)});

/** The pane, shade and bottom rail use one quadrilateral on the left wall. */
export class OfficeWindow {
  private graphics:Phaser.GameObjects.Graphics;
  constructor(scene:Phaser.Scene) { this.graphics=scene.add.graphics().setDepth(-90); }
  private polygon(color:number,points:Point[]) {
    const g=this.graphics.fillStyle(color).beginPath().moveTo(points[0].x,points[0].y);
    points.slice(1).forEach(p=>g.lineTo(p.x,p.y)); g.closePath().fillPath();
  }
  draw(progress:number,visible:boolean) {
    const g=this.graphics; g.clear().setVisible(visible);
    if(!visible)return;
    this.polygon(0x485153,wallQuad(5,35,44,207));
    this.polygon(0xd5dad8,wallQuad(6,34,46,204));
    this.polygon(0xb3d7e4,pane);
    this.polygon(0xd8edf0,wallQuad(9,31,66,77));
    const left=interpolate(pane[0],pane[3],.5),right=interpolate(pane[1],pane[2],.5);
    g.lineStyle(1,0x7e969c).lineBetween(left.x,left.y,right.x,right.y);
    if(progress>0){
      const lowerLeft=interpolate(pane[0],pane[3],progress),lowerRight=interpolate(pane[1],pane[2],progress);
      this.polygon(0x999e9d,[pane[0],pane[1],lowerRight,lowerLeft]);
      for(let t=.1;t<progress;t+=.1){
        const l=interpolate(pane[0],pane[3],t),r=interpolate(pane[1],pane[2],t);
        g.lineStyle(1,0x929796).lineBetween(l.x,l.y,r.x,r.y);
      }
      g.lineStyle(2,0x727a7b).lineBetween(lowerLeft.x,lowerLeft.y,lowerRight.x,lowerRight.y);
    }
    // Roller housing and cord stay attached to the frame in either state.
    this.polygon(0x667072,wallQuad(4,36,40,48));
    this.polygon(0xd5dbd9,wallQuad(6,34,41,44));
    const cordTop=wallPoint(36,48).y,cordBottom=wallPoint(36,191).y;
    g.lineStyle(1,0x697174).lineBetween(36,cordTop,36,cordBottom).fillStyle(0x596164).fillRect(35,cordBottom-2,3,5);
  }
}
