import fs from 'node:fs';
const path='src/bathroom.ts';let s=fs.readFileSync(path,'utf8');
s=s.replace("import { registerRegions } from './frames';\n",'').replace('const centers = [80, 170, 260, 350];','const centers = [88, 173, 259, 344];').replace('const sinkCenters = [450, 512];','const sinkCenters = [459, 534];').replace('const doorY = 211;\nconst doorHeight = 130;','const portals = [{x:54,width:63},{x:136,width:70},{x:229,width:67},{x:312,width:66}];');
s=s.replace('private doors: Phaser.GameObjects.Image[] = [];','private doors: Phaser.GameObjects.Graphics[] = [];\n  private angles=centers.map(()=>0);').replace('  private toilets: Phaser.GameObjects.Image[][] = [];\n','').replace('bathroom-room-v3.png','bathroom-room-v4.png').replace(/    this.load.image\('bathroom-props'[^\n]+\n/,'').replace(/    this.load.image\('bathroom-depth'[^\n]+\n/,'');
const start=s.indexOf("    registerRegions(this,'bathroom-props'");const end=s.indexOf('    this.water=',start);
s=s.slice(0,start)+`    // Plumbing and partitions are painted together; only doors are movable.
    centers.forEach((_,i)=>{this.doors.push(this.add.graphics().setDepth(209));this.paintDoor(i);});
`+s.slice(end);
const toggleStart=s.indexOf('    const opening=!this.open[index]');const toggleEnd=s.indexOf('\n  private stand()',toggleStart);
s=s.slice(0,toggleStart)+`    this.setDoorOpen(index,!this.open[index]);
  }
  setDoorOpen(index:number,opening:boolean){
    if(this.open[index]===opening&&!this.turning[index])return;
    this.open[index]=opening;this.turning[index]=true;
    this.tweens.killTweensOf(this.angles);
    const pose={angle:this.angles[index]};
    this.tweens.add({targets:pose,angle:opening?Math.PI/2:0,duration:260,ease:'Sine.easeInOut',onUpdate:()=>{this.angles[index]=pose.angle;this.paintDoor(index);},onComplete:()=>{this.turning[index]=false;}});
  }
  private paintDoor(index:number){
    const g=this.doors[index],p=portals[index],a=this.angles[index];
    const farX=Math.round(p.x+p.width*Math.cos(a)+10*Math.sin(a)),dy=Math.round(-24*Math.sin(a));
    const points=[{x:p.x,y:77},{x:farX,y:77+dy},{x:farX,y:206+dy},{x:p.x,y:206}];
    g.clear().fillStyle(0xd8c3a2).lineStyle(1,0x514b3e).fillPoints(points,true).strokePoints(points,true);
    g.lineStyle(2,0xf2e2bf).lineBetween(p.x+2,79,p.x+2,204);
    const hx=Math.round(p.x+(farX-p.x)*.84),hy=Math.round(147+dy*.84);
    g.fillStyle(0x494d4a).fillRect(hx,hy,2,5).fillRect(p.x,102,2,5).fillRect(p.x,177,2,5);
  }
`+s.slice(toggleEnd);
s=s.replace('    this.toilets.forEach((parts,index)=>parts.forEach(part=>part.setVisible(this.open[index])));\n','').replace('this.seated!==null?196:this.y+1);','this.seated!==null?196:this.y+1,undefined,0,this.seated!==null?170:undefined);').replace('if(y<218&&x>418)','if(y<218&&x>406)').replace('if(y<218&&x<=418)','if(y<218&&x<=406)').replace('const x=[456,509][this.washing]','const x=sinkCenters[this.washing]').replace('lineBetween(x,146,x,154)','lineBetween(x,141,x,149)').replace('155,2,2','150,2,2').replace('156,2,2','151,2,2');
fs.writeFileSync(path,s);
const client='src/multiplayer/world-client.ts';s=fs.readFileSync(client,'utf8');s=s.replace(/if\(s.doors\[i\]\)\{s.open\[i\]=o.open;s.doors\[i\].setTexture\('bathroom-props',[^\n]+?;\}/,"if(s.doors[i])s.setDoorOpen(i,o.open);");fs.writeFileSync(client,s);
