import Phaser from 'phaser';

export interface SpriteFrame {
  name: string; width: number; height: number; x: number; y: number;
  referenceHeight: number; pivotX: number;
}

function bodyBounds(pixels: Uint8ClampedArray, width: number, x0: number, y0: number, x1: number, y1: number) {
  const cellWidth = x1 - x0, cellHeight = y1 - y0;
  const seen = new Uint8Array(cellWidth * cellHeight);
  let largest = { count: 0, left: x1, top: y1, right: x0, bottom: y0 };
  // Locate the main opaque character without changing the image pixels. Native
  // generation can leave a few disconnected opaque dots in transparent gutters.
  for (let cy = 0; cy < cellHeight; cy++) for (let cx = 0; cx < cellWidth; cx++) {
    const start = cy * cellWidth + cx;
    if (seen[start]) continue;
    seen[start] = 1;
    if (pixels[((cy + y0) * width + cx + x0) * 4 + 3] <= 192) continue;
    const queue = [start];
    const bounds = { count: 0, left: x1, top: y1, right: x0, bottom: y0 };
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index], x = current % cellWidth, y = Math.floor(current / cellWidth);
      bounds.count++; bounds.left = Math.min(bounds.left, x + x0); bounds.top = Math.min(bounds.top, y + y0);
      bounds.right = Math.max(bounds.right, x + x0 + 1); bounds.bottom = Math.max(bounds.bottom, y + y0 + 1);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= cellWidth || ny >= cellHeight) continue;
        const next = ny * cellWidth + nx;
        if (seen[next]) continue;
        seen[next] = 1;
        if (pixels[((ny + y0) * width + nx + x0) * 4 + 3] > 192) queue.push(next);
      }
    }
    if (bounds.count > largest.count) largest = bounds;
  }
  return largest;
}

const frameCache = new Map<string, SpriteFrame[]>();

// Generated sheets remain untouched. These are texture frames used by the renderer,
// not edited copies of the artwork. Low-alpha generation fringe is excluded from bounds.
export function registerFrames(scene: Phaser.Scene, key: string, columns: number, rows: number, actor = false, cuts?: { x: number[]; y: number[] }): SpriteFrame[] {
  const texture = scene.textures.get(key);
  const cacheKey = key + ':' + columns + 'x' + rows + ':' + Number(actor) + ':' + JSON.stringify(cuts ?? null);
  const cached = frameCache.get(cacheKey);
  if (cached && texture.has(cached[0].name)) return cached.map(frame => ({ ...frame }));
  const source = texture.getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器无法读取素材');
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const frames: SpriteFrame[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x0 = Math.round((cuts?.x[column] ?? column / columns) * canvas.width);
      const x1 = Math.round((cuts?.x[column + 1] ?? (column + 1) / columns) * canvas.width);
      const y0 = Math.round((cuts?.y[row] ?? row / rows) * canvas.height);
      const y1 = Math.round((cuts?.y[row + 1] ?? (row + 1) / rows) * canvas.height);
      let left = x1, top = y1, right = x0, bottom = y0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 192) {
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
          }
        }
      }
      if (actor) {
        const body = bodyBounds(pixels, canvas.width, x0, y0, x1, y1);
        left = body.left; top = body.top; right = body.right; bottom = body.bottom;
      }
      if (right <= left || bottom <= top) throw new Error(`${key} 的第 ${frames.length + 1} 帧为空`);
      let pivotX = .5;
      if (actor) {
        // The head remains centered when a swinging leg extends beyond the body.
        let sumX = 0, count = 0;
        const headBottom = Math.round(top + (bottom - top) * .40);
        for (let y = top; y < headBottom; y++) for (let x = left; x < right; x++) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 192) { sumX += x; count++; }
        }
        if (count) pivotX = (sumX / count - left) / (right - left);
      }
      const frame = { name: `cell-${frames.length}`, width: right - left, height: bottom - top,
        x: left, y: top, referenceHeight: bottom - top, pivotX };
      if (!texture.has(frame.name)) texture.add(frame.name, 0, left, top, frame.width, frame.height);
      frames.push(frame);
    }
  }
  // Fixed scale for the whole sheet preserves the raised and passing leg poses.
  const referenceHeight = Math.max(...frames.map(frame => frame.height));
  for (const frame of frames) frame.referenceHeight = referenceHeight;
  frameCache.set(cacheKey, frames);
  return frames.map(frame => ({ ...frame }));
}

export function setSpriteFrame(image: Phaser.GameObjects.Image, key: string, frame: SpriteFrame, height: number) {
  image.setTexture(key, frame.name).setScale(height / frame.referenceHeight).setOrigin(frame.pivotX, 1);
}

export interface AtlasRegion { name: string; x0: number; y0: number; x1: number; y1: number }

// Atlas gutters are not equally sized cells. Register the actual silhouettes inside
// explicit normalized regions; no raster files are rewritten or resampled here.
export function registerRegions(scene: Phaser.Scene, key: string, regions: AtlasRegion[]): SpriteFrame[] {
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器无法读取素材图集');
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return regions.map(region => {
    const bounds = bodyBounds(pixels, canvas.width, Math.round(region.x0 * canvas.width),
      Math.round(region.y0 * canvas.height), Math.round(region.x1 * canvas.width), Math.round(region.y1 * canvas.height));
    if (!bounds.count) throw new Error(`${key}/${region.name} 没有找到物件`);
    const frame: SpriteFrame = { name: region.name, x: bounds.left, y: bounds.top,
      width: bounds.right - bounds.left, height: bounds.bottom - bounds.top,
      referenceHeight: bounds.bottom - bounds.top, pivotX: .5 };
    if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
    return frame;
  });
}
