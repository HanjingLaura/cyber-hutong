export type Sport='basketball'|'hockey';
export class ArcadeSports{
  private time=0;private aim=320;private flight:number|null=null;private shotX=320;private score=0;private shots=0;
  private player={x:320,y:330};private bot={x:320,y:108};private puck={x:320,y:210,vx:130,vy:180};private goals=[0,0];
  state(){return {basketball:{aim:this.aim,hoop:this.hoop(),flight:this.flight,score:this.score,shots:this.shots},hockey:{player:{...this.player},bot:{...this.bot},puck:{...this.puck},goals:[...this.goals]}};}
  private hoop(){return 320+Math.sin(this.time/1350)*130;}
  reset(kind:Sport){if(kind==='basketball'){this.score=0;this.shots=0;this.flight=null;this.aim=320;}else{this.goals=[0,0];this.serve();}}
  pointer(kind:Sport,x:number,y:number){if(kind==='basketball')this.aim=Math.max(100,Math.min(540,x));else this.player={x:Math.max(70,Math.min(570,x)),y:Math.max(238,Math.min(345,y))};}
  shoot(){if(this.flight!==null||this.shots>=10)return;this.flight=0;this.shotX=this.aim;this.shots++;}
  private serve(){this.puck={x:320,y:210,vx:130,vy:(this.goals[0]+this.goals[1])%2?-180:180};}
  update(kind:Sport,ms:number,keys:Set<string>){
    this.time+=ms;const dt=ms/1000,dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
    if(kind==='basketball'){this.aim=Math.max(100,Math.min(540,this.aim+dx*dt*240));if(this.flight!==null){this.flight+=ms;if(this.flight>=900){if(Math.abs(this.shotX-this.hoop())<30)this.score+=3;this.flight=null;}}return;}
    if(Math.max(...this.goals)>=5)return;
    this.player.x=Math.max(70,Math.min(570,this.player.x+dx*dt*280));const dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));this.player.y=Math.max(238,Math.min(345,this.player.y+dy*dt*220));
    this.bot.x=Math.max(70,Math.min(570,this.bot.x+Math.max(-dt*175,Math.min(dt*175,this.puck.x-this.bot.x))));
    // Small substeps keep a fast puck from passing through a paddle.
    for(let i=0;i<4;i++){
      const p=this.puck;p.x+=p.vx*dt/4;p.y+=p.vy*dt/4;
      if(p.x<62||p.x>578){p.x=Math.max(62,Math.min(578,p.x));p.vx=-p.vx;}
      for(const [bat,up] of [[this.player,true],[this.bot,false]] as const){if(Math.hypot(p.x-bat.x,p.y-bat.y)<25&&(up?p.vy>0:p.vy<0)){p.vx=(p.x-bat.x)*13;p.vy=up?-230:230;p.y=bat.y+(up?-26:26);}}
      if(p.y<72||p.y>358){if(p.x>265&&p.x<375){this.goals[p.y<72?0:1]++;this.serve();break;}p.y=Math.max(72,Math.min(358,p.y));p.vy=-p.vy;}
    }
  }
  draw(ctx:CanvasRenderingContext2D,kind:Sport){
    const rect=(x:number,y:number,w:number,h:number,c:string)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
    const text=(s:string,x:number,y:number)=>{ctx.fillStyle='#e8ebdc';ctx.font='16px monospace';ctx.fillText(s,x,y);};
    const disc=(x:number,y:number,r:number,c:string)=>{rect(x-r+3,y-r,r*2-6,r*2,c);rect(x-r,y-r+3,r*2,r*2-6,c);};
    rect(0,0,640,420,'#132236');
    if(kind==='basketball'){
      text(`得分 ${this.score}   投篮 ${this.shots}/10`,30,35);const hoop=this.hoop();rect(hoop-46,68,92,65,'#526d8e');rect(hoop-25,89,50,37,'#bddde0');rect(hoop-28,123,56,6,'#ed913d');for(let i=0;i<6;i++)rect(hoop-23+i*9,130,3,23,'#c3d8dd');
      rect(82,362,476,6,'#53657b');rect(this.aim-2,170,4,178,'#344d61');rect(this.aim-14,351,28,5,'#4ed4db');
      let x=320,y=340;if(this.flight!==null){const t=Math.min(1,this.flight/900);x=320+(this.shotX-320)*t;y=340-212*t-95*Math.sin(Math.PI*t);}disc(x,y,13,'#f29b47');rect(x-1,y-12,2,24,'#7f482c');rect(x-12,y-1,24,2,'#7f482c');
      
    }else{
      text(`你 ${this.goals[0]} : ${this.goals[1]} 电脑`,220,35);rect(50,60,540,310,'#72c5d5');rect(60,70,520,290,'#c3e6df');rect(60,208,520,4,'#65b0c8');rect(265,60,110,10,'#18283e');rect(265,360,110,10,'#18283e');
      disc(this.bot.x,this.bot.y,18,'#d757a3');disc(this.player.x,this.player.y,18,'#228db8');disc(this.puck.x,this.puck.y,8,'#dd6550');
      
    }
  }
}
