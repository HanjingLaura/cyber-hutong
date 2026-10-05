import Phaser from 'phaser';
import type { SpriteFrame } from './frames';

export interface GripSlot {
  x: number; y: number; side: number;
  handRect: number[]; handOffset: number[];
}
export interface HeldItem {
  texture: string; frame: string; width: number; height: number;
  grip: { x: number; y: number };
}

// Keep the complete pose; a shared pixel-round hand grips replaceable props.
export class HeldItemView {
  private item: Phaser.GameObjects.Image;
  private palm: Phaser.GameObjects.Graphics;
  private arm: Phaser.GameObjects.Image;
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.item = scene.add.image(0, 0, 'rest-kit').setVisible(false);
    this.palm = scene.add.graphics().setVisible(false);
    this.arm = scene.add.image(0, 0, 'rest-hold').setVisible(false);
  }

  hide() { this.item.setVisible(false); this.palm.setVisible(false); this.arm.setVisible(false); }
  destroy(){this.item.destroy();this.palm.destroy();this.arm.destroy();}
  get visible() { return this.item.visible; }
  draw(actor: Phaser.GameObjects.Image, key: string, frame: SpriteFrame, slot: GripSlot, height: number, item: HeldItem, depth = actor.depth, direction = 0) {
    const sign = actor.flipX ? -1 : 1;
    const outward = slot.side * sign;
    const flip = outward !== (item.grip.x > .5 ? -1 : 1);
    const palmWidth = slot.handRect[2] / frame.referenceHeight;
    const gripX = actor.x + (slot.x + slot.side * palmWidth * .22) * height * sign;
    const gripY = actor.y + slot.y * height;
    this.item.setTexture(item.texture, item.frame).setDisplaySize(item.width, item.height)
      .setFlipX(flip).setOrigin(flip ? 1 - item.grip.x : item.grip.x, item.grip.y)
      .setPosition(gripX, gripY).setDepth(depth + .1).setVisible(true);
    const palmX = actor.x + slot.x * height * sign;
    const palmY = actor.y + slot.y * height;
    const back = direction === 2;
    const pixel = height / 61.44 * (back ? .75 : 1);
    this.arm.setVisible(false);
    if (back) {
      // Replay the actual bent sleeve in front of the prop. Keep the original
      // shoulder and elbow silhouette rather than drawing a connector bar.
      const [handX, handY, , handHeight] = slot.handRect;
      const reach = Math.round(frame.referenceHeight * .07);
      const left = Math.max(frame.x, handX - reach);
      const top = Math.max(frame.y, handY - reach);
      const width = handX + 2 - left;
      const armHeight = handY + handHeight - 2 - top;
      const name = `back-arm-${frame.name}`;
      const texture = this.scene.textures.get(key);
      if (!texture.has(name)) texture.add(name, 0, left, top, width, armHeight);
      const scale = height / frame.referenceHeight;
      this.arm.setTexture(key, name).setOrigin(actor.flipX ? 1 : 0, 0).setFlipX(actor.flipX).setScale(scale)
        .setPosition(actor.x + (left - frame.x - frame.width * frame.pivotX) * scale * sign,
          actor.y + (top - frame.y - frame.height) * scale)
        .setDepth(depth + .15).setVisible(true);
    }
    // Cover just the original gripping hand with its cuff, then draw a compact
    // stepped circle. No new forearm or sleeve connector is introduced.
    const [,, width, rows] = slot.handRect;
    const sourceScale = height / frame.referenceHeight;
    this.palm.clear().setDepth(depth + (back ? .2 : .05)).setVisible(true)
      .fillStyle(0x292b30).fillRect(palmX - (width - 4) * sourceScale / 2, palmY - (rows - 4) * sourceScale / 2,
        (width - 4) * sourceScale, (rows - 4) * sourceScale);
    const roundHand = ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'];
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
      if (roundHand[row][col] !== '#') continue;
      const edge = row === 0 || row === 6 || col === 0 || col === 6 ||
        roundHand[row][col - 1] !== '#' || roundHand[row][col + 1] !== '#';
      this.palm.fillStyle(edge ? 0x392a23 : 0xedb78d)
        .fillRect(palmX + (col - 3.5) * pixel, palmY + (row - 3.5) * pixel, pixel, pixel);
    }
  }
}
