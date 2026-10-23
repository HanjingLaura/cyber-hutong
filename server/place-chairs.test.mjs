import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import geometry from '../shared/interactions.json' with {type:'json'};
import {sceneWalkable} from '../shared/walkability.mjs';

const options={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022};
const metricsExports={};
new Function('exports',ts.transpileModule(readFileSync(new URL('../src/layout.ts',import.meta.url),'utf8'),{compilerOptions:options}).outputText)(metricsExports);
const source=readFileSync(new URL('../src/place-chairs.ts',import.meta.url),'utf8').replaceAll('import.meta.url','"http://localhost/src/place-chairs.ts"');
function fixture(place){
 const exports={},images=[],frames=[{width:100,height:110,x:0,y:0,name:'rear'},{width:90,height:100,x:110,y:0,name:'front'}];
 const texture={has:()=>false,add(){}};
 const graphics={setDepth(){return this;},fillStyle(){return this;},fillEllipse(){return this;}};
 const scene={textures:{get:()=>texture},add:{graphics:()=>graphics,image(x,y,key,frame){
  const native=frame==='place-chair-backrest-v2'?{width:100,height:64}:frames.find(f=>f.name===frame);
  const image={x,y,visible:true,displayWidth:native.width,displayHeight:native.height,setOrigin(){return this;},setTint(){return this;},setScale(x,y=x){this.displayWidth=native.width*x;this.displayHeight=native.height*y;return this;},setDepth(depth){this.depth=depth;return this;},setVisible(visible){this.visible=visible;return this;}};
  images.push(image);return image;
 }}};
 const require=path=>path.includes('interactions')?{default:geometry}:path==='./layout'?metricsExports:path==='./frames'?{registerFrames:()=>frames}:{};
 new Function('exports','require','URL',ts.transpileModule(source,{compilerOptions:options}).outputText)(exports,require,URL);
 return new exports.PlaceChairs(scene,place);
}

test('all eight replacement chairs preserve seat anchors, readable size and occupied backrest depth',()=>{
 for(const place of ['google','meeting']){
  const chairs=fixture(place);assert.equal(chairs.getState().length,4);
  for(const chair of chairs.getState()){
   assert.ok(chair.width>=28&&chair.width<=metricsExports.METRICS.chairWidth);
   assert.ok(chair.height>=40&&chair.height<=metricsExports.METRICS.chairHeight);
   assert.deepEqual([chair.x,chair.y],geometry[place].seats[chair.id].at);
   assert.equal(chair.backDepth,chair.y+2);
   assert.equal(chair.backVisible,false);
   const seat=geometry[place].seats[chair.id];
   assert.equal(seat.at[1]-seat.surfaceY,seat.facing===0?17:27);
   assert.equal(sceneWalkable(place,...seat.approach),true);
   assert.equal(sceneWalkable(place,...seat.at),false);
  }
  const first=chairs.getState()[0].id;chairs.update(id=>id===first);
  assert.equal(chairs.getState()[0].backVisible,true);
  assert.ok(chairs.getState().slice(1).every(c=>!c.backVisible));
  chairs.update(()=>false);assert.ok(chairs.getState().every(c=>!c.backVisible));
 }
});
