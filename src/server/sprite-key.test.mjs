import test from 'node:test';
import assert from 'node:assert/strict';
import { removeGreenScreen, spriteColumns, spriteComponents } from '../shared/sprite-key.mjs';

test('overlapping horizontal extents are separated by connected pixels', () => {
  const data = new Uint8ClampedArray(10 * 10 * 4);
  for (let x = 1; x < 7; x++) data[(2 * 10 + x) * 4 + 3] = 255;
  for (let x = 4; x < 9; x++) data[(6 * 10 + x) * 4 + 3] = 255;
  const parts = spriteComponents(data, 10, 10, 1);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map(p => [p.left, p.right, p.top]), [[1, 6, 2], [4, 8, 6]]);
});

test('uneven pose spacing splits at transparent gutters rather than equal cells', () => {
  const data = new Uint8ClampedArray(80 * 8 * 4);
  for (const [left, right] of [[2, 8], [19, 35], [48, 60]]) {
    for (let x = left; x <= right; x++) data[(3 * 80 + x) * 4 + 3] = 255;
  }
  assert.deepEqual(spriteColumns(data, 80, 8), [[2, 8], [19, 35], [48, 60]]);
});
test('removes enclosed green holes but preserves olive armour and dark outlines', () => {
  const data = new Uint8ClampedArray(7 * 7 * 4);
  for (let n = 0; n < 49; n++) data.set([0, 255, 0, 255], n * 4);
  for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) data.set([30, 30, 30, 255], (y * 7 + x) * 4);
  data.set([0, 255, 0, 255], 24 * 4);
  data.set([135, 180, 65, 255], 23 * 4);
  removeGreenScreen(data, 7, 7);
  assert.equal(data[3], 0);
  assert.equal(data[24 * 4 + 3], 0);
  assert.equal(data[23 * 4 + 3], 255);
  assert.equal(data[8 * 4 + 3], 255);
});
