import { splitSheet } from './portraits.js';

self.onmessage = async ({ data: { id, src, fallback } }) => {
  let image;
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error('Sprite unavailable');
    image = await createImageBitmap(await response.blob());
    const sheet = splitSheet(image, fallback);
    const transfers = [];
    for (const pose of Object.values(sheet)) {
      pose.source = pose.source.transferToImageBitmap();
      transfers.push(pose.source);
    }
    self.postMessage({ id, sheet }, transfers);
  } catch (error) {
    self.postMessage({ id, error: String(error.message || error) });
  } finally { image?.close(); }
};
