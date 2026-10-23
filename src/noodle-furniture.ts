import Phaser from 'phaser';

const furniture = [
  ['noodle-wood-table', new URL('../assets/props/noodle-wood-table-v1.png', import.meta.url).href],
  ['noodle-wood-stool', new URL('../assets/props/noodle-wood-stool-v1.png', import.meta.url).href],
] as const;

/** Generated transparent art keeps the existing seats, table bounds and pivots. */
export function preloadNoodleFurniture(scene: Phaser.Scene) {
  for (const [key, url] of furniture) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

export function registerNoodleFurniture(scene: Phaser.Scene) {
  for (const [key] of furniture) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
