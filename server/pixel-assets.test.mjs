import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {pixelAssets} from '../scripts/pixel-assets.mjs';

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
