import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as assets from '../scripts/pixel-assets.mjs';
const {pixelAssets}=assets;

test('only full scene backgrounds are sampled to the fixed game canvas, never sprite atlases', async()=>{
 assert.equal(typeof assets.encodeSceneAsset,'function');
 const width=1280,height=720,pixels=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;pixels[i]=x%256;pixels[i+1]=y%256;pixels[i+2]=(x+y)%256;pixels[i+3]=255;}
 const source=await sharp(pixels,{raw:{width,height,channels:4}}).png().toBuffer();
 const encoded=await assets.encodeSceneAsset(source,'/project/assets/drafts/ktv-room-v1.png');
 const {data,info}=await sharp(encoded).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,640);assert.equal(info.height,360);
 for(const [x,y] of [[0,0],[127,55],[639,359]])assert.deepEqual(data.subarray((y*640+x)*4,(y*640+x+1)*4),pixels.subarray(((y*2+1)*width+x*2+1)*4,((y*2+1)*width+x*2+2)*4));
 for(const file of ['/project/assets/drafts/arcade-props-v2.png','/project/assets/drafts/popmart-store-v3.png','/project/assets/drafts/concert-room-v4.png','/project/assets/characters/laura.png','/project/other/ktv-room-v1.png']){
  const original=await sharp(await assets.encodeSceneAsset(source,file)).metadata();assert.equal(original.width,width);assert.equal(original.height,height);
 }
});

test('production URL references use the same encoded asset import path',()=>{
 const plugin=pixelAssets();
 assert.equal(typeof plugin.transform,'function');
 const source="const image=new URL('../assets/room.png',import.meta.url).href; // new URL('../assets/fake.png',import.meta.url).href";
 const result=plugin.transform(source,'/project/src/room.ts');
 assert.match(result.code,/import .* from "\.\.\/assets\/room\.png\?url"/);
 assert.ok(result.code.includes("// new URL('../assets/fake.png',import.meta.url).href"),'comments are untouched');
 assert.equal(plugin.transform("const u=new URL('https://example.com/a.png',import.meta.url).href",'/project/src/room.ts'),null);
});

test('production image compression preserves dimensions, transparency and visible pixels', async () => {
  const module = await import('../scripts/pixel-assets.mjs').catch(() => null);
  assert.ok(module?.encodePixelAsset, 'production needs a lossless image encoder');
  const pixels = Buffer.from([255, 10, 80, 255, 1, 210, 3, 128, 20, 30, 40, 255, 0, 0, 0, 0]);
  const png = await sharp(pixels, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();
  const encoded = await module.encodePixelAsset(png);
  const { data, info } = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 2); assert.equal(info.height, 2);
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(data[i + 3], pixels[i + 3]);
    if (pixels[i + 3]) assert.deepEqual(data.subarray(i, i + 3), pixels.subarray(i, i + 3));
  }
});
