// Key the saturated studio backdrop, not every green pixel (Buzz has green armour).
export function removeGreenScreen(data, width, height) {
  const count = width * height, seen = new Uint8Array(count), queue = [];
  const backdrop = i => data[i + 1] > 70 && data[i + 1] > Math.max(data[i], data[i + 2]) * 1.6 + 20;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const n = y * width + x, i = n * 4;
    if (seen[n]) return;
    seen[n] = 1;
    if (!backdrop(i)) return;
    data[i + 3] = 0;
    queue.push(n);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  for (let head = 0; head < queue.length; head++) {
    const n = queue[head], x = n % width, y = Math.floor(n / width);
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  // Enclosed gaps between arms/legs cannot be reached by the border flood.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 1] > 180 && data[i] < 100 && data[i + 2] < 100) data[i + 3] = 0;
  }
  for (let n = 0; n < count; n++) {
    const i = n * 4;
    if (!data[i + 3]) continue;
    const x = n % width, y = Math.floor(n / width);
    const edge = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .some(([a, b]) => a >= 0 && b >= 0 && a < width && b < height && !data[(b * width + a) * 4 + 3]);
    const neutral = Math.max(data[i], data[i + 2]);
    if (edge && data[i + 1] > neutral * 1.25 + 12) data[i + 1] = neutral;
  }
}

// Generated pose sheets have uneven spacing: equal sixths can include a neighbour's
// shoe while clipping the current pose. Split only in real transparent gutters.
export function spriteColumns(data, width, height, gap = 8) {
  const ranges = [];
  let start = -1, last = -1;
  for (let x = 0; x < width; x++) {
    let occupied = false;
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3]) { occupied = true; break; }
    }
    if (occupied) { if (start < 0) start = x; last = x; }
    else if (start >= 0 && x - last >= gap) { ranges.push([start, last]); start = -1; }
  }
  if (start >= 0) ranges.push([start, last]);
  return ranges;
}

export function spriteComponents(data, width, height, minimum = 128) {
  const seen = new Uint8Array(width * height), components = [];
  for (let n = 0; n < seen.length; n++) {
    if (seen[n] || !data[n * 4 + 3]) continue;
    const pixels = [n];
    seen[n] = 1;
    let left = width, right = 0, top = height, bottom = 0;
    for (let head = 0; head < pixels.length; head++) {
      const p = pixels[head], x = p % width, y = Math.floor(p / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const v of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (v < 0 || v >= seen.length || seen[v] || !data[v * 4 + 3]) continue;
        seen[v] = 1; pixels.push(v);
      }
    }
    if (pixels.length >= minimum) components.push({ left, right, top, bottom, pixels });
  }
  return components.sort((a, b) => a.left - b.left);
}
