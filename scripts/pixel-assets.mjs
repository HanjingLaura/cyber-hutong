import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import sharp from 'sharp';
import ts from 'typescript';

// Encoding only: preserve atlas dimensions, transparency and visible pixels.
export const encodePixelAsset = source => sharp(source).webp({ lossless: true, effort: 4 }).toBuffer();

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
        try { encoded = await encodePixelAsset(source); }
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
