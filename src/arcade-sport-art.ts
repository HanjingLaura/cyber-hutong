import basketballInterior from '../assets/props/arcade-basketball-interior.png';
import basketballHoop from '../assets/props/arcade-basketball-hoop.png';
import hockeyTable from '../assets/props/arcade-hockey-table.png';
import basketball from '../assets/props/arcade-sport-basketball.png';
import paddleBlue from '../assets/props/arcade-sport-paddle-blue.png';
import paddlePink from '../assets/props/arcade-sport-paddle-pink.png';
import puck from '../assets/props/arcade-sport-puck.png';

export const sportArt = {
  basketballInterior: {url: basketballInterior, width: 640, height: 420},
  basketballHoop: {url: basketballHoop, width: 92, height: 85},
  hockeyTable: {url: hockeyTable, width: 640, height: 420},
  basketball: {url: basketball, width: 26, height: 26},
  paddleBlue: {url: paddleBlue, width: 36, height: 36},
  paddlePink: {url: paddlePink, width: 36, height: 36},
  puck: {url: puck, width: 16, height: 16},
} as const;
type Art = keyof typeof sportArt;
type Entry = {image: HTMLImageElement; ready: boolean; retryAt: number};
const images = new Map<Art, Entry>();

/** Failed downloads are retried by later frames; an empty canvas is never cached. */
export function drawSportArt(ctx: CanvasRenderingContext2D, key: Art, x: number, y: number) {
  let entry = images.get(key);
  if (!entry || (!entry.ready && entry.retryAt > 0 && Date.now() >= entry.retryAt)) {
    const image = new Image();
    entry = {image, ready: false, retryAt: 0};
    images.set(key, entry);
    const pending = entry;
    image.onload = () => {pending.ready = image.naturalWidth > 0; if (!pending.ready) pending.retryAt = Date.now() + 2000;};
    image.onerror = () => {pending.retryAt = Date.now() + 2000;};
    image.src = sportArt[key].url;
  }
  if (!entry.ready) return false;
  const art = sportArt[key];
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.image, Math.round(x), Math.round(y), art.width, art.height);
  return true;
}
