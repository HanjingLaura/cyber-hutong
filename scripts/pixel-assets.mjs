import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import sharp from 'sharp';
import ts from 'typescript';

// Encoding only: preserve atlas dimensions, transparency and visible pixels.
export const encodePixelAsset = source => sharp(source).webp({ lossless: true, effort: 4 }).toBuffer();

// These images fill the fixed 640x360 canvas. Cropped backgrounds (concert/pop),
// sprite sheets and props must retain their native frame coordinates.
const sceneBackgrounds = new Set([
  'hutong-wall-view-v5.png', 'hutong-reverse-view-v5.png', 'hawaii-wall-v2.png',
  'rest-room-shell-v2.png', 'bathroom-room-v4.png',
  'arcade-room-v3.png', 'noodle-room-v3.png', 'gym-room-v1.png',
  'dance-room-v1.png', 'perler-shop-v2.png', 'rehearsal-room-v1.png',
  'elevator-lobby-v1.png', 'wudaokou-station-v1.png', 'ktv-room-v1.png',
]);

export async function encodeSceneAsset(source, file) {
  const path = file.replaceAll('\\', '/');
  if (!path.endsWith('/assets/drafts/' + basename(path)) || !sceneBackgrounds.has(basename(path))) return encodePixelAsset(source);
  const { data, info } = await sharp(source).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = 640, height = 360;
  if (info.width <= width || info.height <= height) return encodePixelAsset(source);
  // Sample at destination pixel centers, as a nearest-filtered GPU quad does.
  // Do not blend colors or soften the pixel art. Keep source PNGs untouched.
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = Math.floor((y + .5) * info.height / height) * info.width;
    for (let x = 0; x < width; x++) {
      const from = (row + Math.floor((x + .5) * info.width / width)) * 4;
      data.copy(pixels, (y * width + x) * 4, from, from + 4);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
}

export function pixelAssets() {
  let base = '/', active = 0;
  const waiting = [], cache = new Map();
  return {
    name: 'pixel-assets', enforce: 'pre', apply: 'build',
    configResolved(config) { base = config.base; },
    transform(code,id) {
      if(!/\.[cm]?[jt]sx?(?:\?|$)/.test(id)||id.includes('node_modules')||!code.includes('new URL'))return null;
      const source=ts.createSourceFile(id,code,ts.ScriptTarget.Latest,true),edits=[],imports=[];
      const visit=node=>{
        if(ts.isPropertyAccessExpression(node)&&node.name.text==='href'&&ts.isNewExpression(node.expression)){
          const url=node.expression,args=url.arguments;
          if(url.expression.getText(source)==='URL'&&args?.length===2&&ts.isStringLiteral(args[0])&&/^(?:\.{1,2}\/).*\.png$/.test(args[0].text)&&args[1].getText(source).replace(/\s/g,'')==='import.meta.url'){
            let name='__hutongPixelAsset'+imports.length;while(code.includes(name))name+='_';
            imports.push(`import ${name} from ${JSON.stringify(args[0].text+'?url')};`);
            edits.push({start:node.getStart(source),end:node.end,name});return;
          }
        }
        ts.forEachChild(node,visit);
      };visit(source);
      if(!edits.length)return null;
      for(const edit of edits.reverse())code=code.slice(0,edit.start)+edit.name+code.slice(edit.end);
      return {code:imports.join('\n')+'\n'+code,map:null};
    },
    async load(id) {
      if (!/\.png(?:\?url)?$/.test(id)) return null;
      const file = id.split('?')[0];
      if (!cache.has(file)) cache.set(file, (async () => {
        const source = await readFile(file);
        if (source.length < 16384) return null;
        if (active >= 2) await new Promise(resolve => waiting.push(resolve));
        else active++;
        let encoded;
        try { encoded = await encodeSceneAsset(source, file); }
        finally { if(waiting.length)waiting.shift()();else active--; }
        if (encoded.length >= source.length) return null;
        const reference = this.emitFile({ type: 'asset', name: basename(file, '.png') + '.webp', source: encoded });
        return `export default import.meta.ROLLUP_FILE_URL_${reference};`;
      })());
      return cache.get(file);
    },
    resolveFileUrl({ fileName, relativePath }) {
      return base.startsWith('.') ? `new URL(${JSON.stringify(relativePath)}, import.meta.url).href` : JSON.stringify(base + fileName);
    },
  };
}
