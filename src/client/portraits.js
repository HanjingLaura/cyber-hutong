const files = {
  suki: "f01",
  franco: "f02",
  sid: "f03",
  jilly: "f04",
  laura: "f05",
  kay: "f06",
  cora: "f07",
  amber: "f08",
};
const cache = new Map();
async function load(id) {
  const image = new Image();
  image.src =
    (document.documentElement.dataset.base || "") +
    "/characters/" +
    files[id] +
    ".png";
  await image.decode();
  const source = document.createElement("canvas");
  source.width = Math.floor(image.width / 6);
  source.height = image.height;
  const ctx = source.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, source.width, source.height);
  let left = source.width,
    right = 0,
    top = source.height,
    bottom = 0;
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4,
        d = pixels.data;
      if (d[i + 1] > 140 && d[i + 1] > d[i] * 1.5 && d[i + 1] > d[i + 2] * 1.5)
        d[i + 3] = 0;
      else if (d[i + 3]) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  ctx.putImageData(pixels, 0, 0);
  return {
    source,
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
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
