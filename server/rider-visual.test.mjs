import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
import sharp from 'sharp';
const source=readFileSync('src/multiplayer/avatar.ts','utf8');
const draw=source.slice(source.indexOf(' draw(player:'),source.indexOf(' destroy(){'));
const code=ts.transpileModule(`class Avatar {${draw}} return Avatar;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const Avatar=new Function('characterRegistry','canWorkAt','items',code)({seatedHeight:62.4},()=>false,{});
function sprite(){const s={visible:false,x:0,y:0,rotation:0};for(const name of ['setTexture','setOrigin','setScale','setFlipX','setRotation','setPosition','setDepth','setVisible'])s[name]=(...args)=>{if(name==='setTexture'){s.texture=args[0];s.frame=args[1];}if(name==='setRotation')s.rotation=args[0];if(name==='setPosition')[s.x,s.y]=args;if(name==='setVisible')s.visible=args[0];return s;};return s;}
test('all nine roles use complete dedicated mobility sprites and reset when walking',()=>{
 for(const role of ['suki','sid','jilly','laura','kay','franco','cora','amber','celine']){
  const data=JSON.parse(readFileSync(`assets/characters/${role}/manifest.json`,'utf8')).member;
  const v=new Avatar();Object.assign(v,{ready:true,data,time:0,body:sprite(),upper:sprite(),label:sprite(),hide(){this.body.visible=this.upper.visible=false;}});
  const p={role,scene:'street',seat:null,hand:null,moving:false};v.draw(p,320,285,1,16,false,61.44,286,true,'scooter');
  assert.equal(v.body.visible,true,role);assert.equal(v.body.frame,'pose-4-0');assert.equal(v.upper.visible,false);assert.equal(v.body.rotation,0);
  const rightY=v.body.y;v.draw(p,320,285,3,16,false,61.44,286,true,'scooter');assert.equal(v.body.frame,'pose-4-0');assert.equal(v.body.y,rightY);
  v.draw(p,354,285,1,16,false,61.44,286,true,'scooter-basket');assert.equal(v.body.frame,'pose-4-0');assert.equal(v.upper.visible,false);assert.equal(v.body.rotation,0);assert.equal(v.body.x,354);
  v.draw({...p,scene:'campus'},320,310,1,16,false,61.44,311,true,'skateboard');assert.equal(v.body.frame,'pose-4-1');assert.equal(v.body.y,310);assert.equal(v.upper.visible,false);
  v.draw({...p,scene:'campus'},320,310,0,16,false,61.44,311,true,'skate-sit');assert.equal(v.body.frame,'pose-0-4');assert.equal(v.body.y,310,'seated shoes must stay above the deck');assert.equal(v.upper.visible,false);
  v.draw(p,320,285,1,16,false,61.44,286,true,'walk');assert.equal(v.body.rotation,0);assert.equal(v.upper.visible,false);assert.notEqual(v.body.frame,'ride-legs');
 }
});

test('campus deck surface meets riders soles instead of floating below them',async()=>{
 const placeSource=readFileSync('src/memory-places.ts','utf8');
 const method=placeSource.slice(placeSource.indexOf(' private drawObject(){'),placeSource.lastIndexOf('\n}'));
 const Place=new Function(ts.transpileModule(`class Place {${method}} return Place;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)();
 const g={};for(const name of ['clear','setDepth','fillStyle','fillEllipse','lineStyle','strokeCircle'])g[name]=()=>g;
 const board=sprite();board.setDisplaySize=(w,h)=>{board.width=w;board.height=h;return board;};
 const scene=new Place();Object.assign(scene,{place:'campus',art:g,board,riding:true,x:320,y:310,parkedBoard:{x:280,y:300},checkpoint:0,route:()=>[[100,320]]});
 const {data:rgba,info}=await sharp('assets/props/skateboard.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const center=Math.floor(info.width/2);let deckRow=0;while(rgba[(deckRow*info.width+center)*4+3]<128)deckRow++;
 for(const riding of [true,false]){
  scene.x=320.4;scene.y=310.6;
  scene.riding=riding;scene.drawObject();const footY=Math.round(riding?scene.y:scene.parkedBoard.y);
  const deckY=board.y-board.height/2+deckRow*board.height/info.height;
  assert.ok(Math.abs(deckY-footY)<=1,`deck is ${deckY-footY}px below sole anchor; riding=${riding}`);
  assert.equal(board.x,Math.round(riding?scene.x:scene.parkedBoard.x),'board follows avatar pixel rounding');
 }
});
