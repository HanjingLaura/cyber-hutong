import { removeGreenScreen, spriteColumns, spriteComponents } from './shared/sprite-key.mjs';
// Visual asset binding, independent of legacy claim IDs. Used by portraits and world actors.
const files = {
  suki: "f01",
  franco: "f06",
  sid: "f02",
  jilly: "f03",
  laura: "f04",
  kay: "f05",
  cora: "f07",
  amber: "f08",
};
const poseNames = ["front", "back", "side", "walk", "sit", "sit_back"];
const sheets = new Map();
const cache = new Map();
const guestCache = new Map();
const makeCanvas = () => typeof document === 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
let worker;
let workerId = 0;
let workerFailed = false;
const jobs = new Map();

async function prepareSheet(src, fallback) {
  if (!workerFailed && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      if (!worker) {
        worker = new Worker(new URL('./sprite-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
          const job = jobs.get(data.id);
          if (!job) return;
          jobs.delete(data.id);
          clearTimeout(job.timer);
          if (data.error) job.reject(new Error(data.error));
          else job.resolve(data.sheet);
        };
        worker.onerror = () => {
          workerFailed = true;
          worker.terminate();
          worker = null;
          for (const job of jobs.values()) { clearTimeout(job.timer); job.reject(new Error('Sprite worker failed')); }
          jobs.clear();
        };
      }
      return await new Promise((resolve, reject) => {
        const id = ++workerId;
        const timer = setTimeout(() => { jobs.delete(id); reject(new Error('Sprite timeout')); }, 15000);
        jobs.set(id, { resolve, reject, timer });
        worker.postMessage({ id, src: new URL(src, location.href).href, fallback });
      });
    } catch { /* Unsupported worker/CSP: retain a compatible main-thread fallback. */ }
  }
  const image = new Image();
  image.src = src;
  await image.decode();
  await new Promise(resolve => setTimeout(resolve, 0));
  return splitSheet(image, fallback);
}

function keyBackground(ctx, width, height, key = true) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  if (key) removeGreenScreen(data, width, height);
  ctx.putImageData(image, 0, 0);
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!data[(y * width + x) * 4 + 3]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    left,
    top,
    width: Math.max(1, right - left + 1),
    height: Math.max(1, bottom - top + 1),
    anchorX: (left + right) / 2,
    anchorY: bottom,
  };
}

function cutCell(image, box, key = true) {
  const [x, y, w, h] = box;
  const source = makeCanvas();
  source.width = w;
  source.height = h;
  const ctx = source.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
  return { source, ...keyBackground(ctx, w, h, key) };
}
export function splitSheet(image, fallback) {
  const keyed = cutCell(image, [0, 0, image.width, image.height]).source;
  const data = keyed.getContext('2d').getImageData(0, 0, keyed.width, keyed.height).data;
  const columns = spriteColumns(data, keyed.width, keyed.height);
  if (columns.length !== poseNames.length && fallback?.length === poseNames.length) {
    // The ferret's walking tail overlaps the side pose's horizontal extent.
    // Isolate actual connected pixels so neither pose contains the other's tail.
    const components = spriteComponents(data, keyed.width, keyed.height);
    if (components.length === poseNames.length) {
      return Object.fromEntries(components.map((part, index) => {
        const source = makeCanvas();
        source.width = part.right - part.left + 5;
        source.height = part.bottom - part.top + 5;
        const ctx = source.getContext('2d');
        const frame = ctx.createImageData(source.width, source.height);
        for (const n of part.pixels) {
          const x = n % keyed.width - part.left + 2, y = Math.floor(n / keyed.width) - part.top + 2;
          frame.data.set(data.subarray(n * 4, n * 4 + 4), (y * source.width + x) * 4);
        }
        ctx.putImageData(frame, 0, 0);
        return [poseNames[index], { source, ...keyBackground(ctx, source.width, source.height, false) }];
      }));
    }
  }
  let frames;
  if (columns.length === poseNames.length) {
    frames = columns.map(([left, right]) => {
      const x = Math.max(0, left - 2), end = Math.min(keyed.width, right + 3);
      return [x, 0, end - x, keyed.height];
    });
  } else if (fallback) frames = fallback;
  else throw new Error('角色素材的六个姿势无法分开');
  return Object.fromEntries(frames.map((box, index) => [poseNames[index], cutCell(keyed, box, false)]));
}
async function load(id) {
  const sheet = await loadSheet(id);
  return sheet?.front ?? null;
}
export async function loadSheet(id) {
  if (!files[id]) return null;
  if (!sheets.has(id)) sheets.set(id, cutSheet(id));
  return sheets.get(id);
}
async function cutSheet(id) {
  const src =
    (document.documentElement.dataset.base || "") +
    "/characters/" +
    files[id] +
    ".png";
  return prepareSheet(src);
}
export async function loadGuestSheet(src, frames) {
  if (!frames?.length) return null;
  const key = JSON.stringify([src, frames]);
  if (!guestCache.has(key)) guestCache.set(key, prepareSheet(src, frames).catch(error => { guestCache.delete(key); throw error; }));
  return guestCache.get(key);
}
export async function portrait(canvas, id) {
  canvas.dataset.actor = id;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!files[id]) return;
  if (!cache.has(id))
    cache.set(
      id,
      load(id).catch(() => null),
    );
  const pose = await cache.get(id);
  if (!pose || canvas.dataset.actor !== id) return;
  const scale = Math.min(
      canvas.width / pose.width,
      canvas.height / pose.height,
    ),
    w = Math.floor(pose.width * scale),
    h = Math.floor(pose.height * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    pose.source,
    pose.left,
    pose.top,
    pose.width,
    pose.height,
    Math.floor((canvas.width - w) / 2),
    canvas.height - h,
    w,
    h,
  );
}
