import Phaser from 'phaser';
import type { SpriteFrame } from './frames';

// Side gait: two independent legs pass under the same pelvis in opposite phases.
// Keep the original head, shirt and arms; only the trousers/shoes are animated.
export const sideGaitPhase = (time: number) => Math.floor(time / 85) % 8;
// The sheet's visible arm belongs to the opposite side from the foreground
// procedural leg. Offset its cycle by half a stride to avoid same-side swing.
export const sideUpperFrame = (time: number) => [0, 1, 2, 4, 4, 4, 5, 1][(sideGaitPhase(time) + 4) % 8];
export const heldSideFrame = (time: number) => [0, 1, 1, 2, 2, 3, 3, 0][sideGaitPhase(time)];

export class SideWalkLegs {
  private legs: Phaser.GameObjects.Graphics;
  private nearArm: Phaser.GameObjects.Graphics;
  private farArm: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.legs = scene.add.graphics().setVisible(false);
    this.nearArm = scene.add.graphics().setVisible(false);
    this.farArm = scene.add.graphics().setVisible(false);
  }
  hide() { this.legs.setVisible(false); this.nearArm.setVisible(false); this.farArm.setVisible(false); }
  destroy(){this.legs.destroy();this.nearArm.destroy();this.farArm.destroy();}
  draw(actor: Phaser.GameObjects.Image, frame: SpriteFrame, height: number, direction: number, time: number) {
    const key = actor.texture.key;
    const holding=key==='rest-hold'||key.endsWith('-hold');
    const cut = Math.round(frame.height * (holding ? .70 : .72));
    const name = `gait-upper-${frame.name}`;
    const texture = this.scene.textures.get(key);
    if (!texture.has(name)) texture.add(name, 0, frame.x, frame.y, frame.width, cut);
    const scale = height / frame.referenceHeight;
    if (!holding) {
      // Shorten the arm excursion around the shirt edges. The counter-swing
      // still comes from the phase-matched source pose; head and central shirt
      // pixels keep their original position and scale.
      const smallArmKey = `small-arms-${key}-${frame.name}`;
      if (!this.scene.textures.exists(smallArmKey)) {
        const canvas = this.scene.textures.createCanvas(smallArmKey, frame.width, cut)!;
        const context = canvas.context;
        context.imageSmoothingEnabled = false;
        const source = texture.getSourceImage() as HTMLImageElement;
        const pivot = frame.width * frame.pivotX;
        const left = Math.round(Math.max(0, pivot - frame.referenceHeight * .12));
        const right = Math.round(Math.min(frame.width, pivot + frame.referenceHeight * .07));
        for (let row = 0; row < cut; row++) {
          const blend = Phaser.Math.Clamp((row / frame.height - .45) / .11, 0, 1);
          const armScale = 1 - blend * .6;
          const leftWidth = Math.max(1, Math.round(left * armScale));
          const rightWidth = Math.max(1, Math.round((frame.width - right) * armScale));
          if (blend < 1) context.drawImage(source, frame.x, frame.y + row, left, 1, left - leftWidth, row, leftWidth, 1);
          context.drawImage(source, frame.x + left, frame.y + row, right - left, 1, left, row, right - left, 1);
          if (blend < 1) context.drawImage(source, frame.x + right, frame.y + row, frame.width - right, 1, right, row, rightWidth, 1);
        }
        canvas.refresh();
      }
      actor.setTexture(smallArmKey).setScale(scale);
    } else actor.setTexture(key, name);
    actor.setOrigin(actor.flipX ? 1 - frame.pivotX : frame.pivotX, frame.height / cut);
    const waist = -(frame.height - cut) * scale;
    const pixel = height / 61.44;
    const poses = [[-8,8,0,0],[-4,4,3,0],[0,0,5,0],[4,-4,2,0],[8,-8,0,0],[4,-4,0,3],[0,0,0,5],[-4,4,0,2]];
    const pose = poses[sideGaitPhase(time)];
    const sign = direction === 3 ? -1 : 1;
    this.legs.clear().setPosition(actor.x, actor.y).setDepth(actor.depth - .01).setVisible(true);
    const line = (x0: number,y0: number,x1: number,y1: number,width: number,color: number) => {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));
      this.legs.fillStyle(color);
      for(let i=0;i<=steps;i++) this.legs.fillRect((Math.round(x0+(x1-x0)*i/steps)-width/2)*pixel,Math.round(y0+(y1-y0)*i/steps)*pixel,width*pixel,pixel);
    };
    const drawLeg = (swing: number,lift: number,near: boolean) => {
      const hip = (near ? 0 : -4) * sign, top = waist / pixel - 1;
      const footX = (swing - 2) * sign, footY = -2-lift;
      const kneeX = (swing*.5 - 2 + (lift ? 2 : 0))*sign;
      const kneeY = top*.48-lift*.45;
      line(hip,top,kneeX,kneeY,9,0x0d1013);line(kneeX,kneeY,footX,footY-2,7,0x0d1013);
      const color = near ? 0x292b30 : 0x1b1e23;
      line(hip,top,kneeX,kneeY,7,color);line(kneeX,kneeY,footX,footY-2,5,color);
      // Mirror the shoe around its ankle, including toe extension and highlight.
      const shoeLeft = footX + (sign === 1 ? -3 : -5);
      const highlightLeft = footX + (sign === 1 ? -2 : -4);
      this.legs.fillStyle(0x0c0e11).fillRect(shoeLeft*pixel,(footY-1)*pixel,8*pixel,3*pixel)
        .fillStyle(near ? 0x35383c : 0x25282c).fillRect(highlightLeft*pixel,footY*pixel,6*pixel,pixel);
    };
    drawLeg(pose[0],pose[2],false);drawLeg(pose[1],pose[3],true);
    if (!holding) {
      const drawArm = (graphics: Phaser.GameObjects.Graphics, legSwing: number, near: boolean) => {
        graphics.clear().setPosition(actor.x, actor.y).setDepth(actor.depth + (near ? .02 : -.02)).setVisible(true);
        const shoulderX = (near ? -4 : -1) * sign;
        const shoulderY = waist / pixel - 9;
        const swing = -legSwing / 8 * 3;
        const elbowX = shoulderX + swing * .4 * sign;
        const handX = shoulderX + swing * sign;
        const handY = shoulderY + 10 - Math.abs(swing) * .25;
        const stroke = (x0: number, y0: number, x1: number, y1: number, width: number, color: number) => {
          const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
          graphics.fillStyle(color);
          for (let i = 0; i <= steps; i++) graphics.fillRect((Math.round(x0 + (x1 - x0) * i / steps) - width / 2) * pixel,
            Math.round(y0 + (y1 - y0) * i / steps) * pixel, width * pixel, pixel);
        };
        const elbowY = shoulderY + 5;
        stroke(shoulderX, shoulderY, elbowX, elbowY, 5, 0x101317);
        stroke(elbowX, elbowY, handX, handY - 1, 5, 0x101317);
        stroke(shoulderX, shoulderY, elbowX, elbowY, 3, near ? 0x303239 : 0x202329);
        stroke(elbowX, elbowY, handX, handY - 1, 3, near ? 0x303239 : 0x202329);
        graphics.fillStyle(0x382923).fillRect((Math.round(handX) - 2) * pixel, Math.round(handY) * pixel, 4 * pixel, 3 * pixel)
          .fillStyle(near ? 0xedb78d : 0xcf9874).fillRect((Math.round(handX) - 1) * pixel, Math.round(handY) * pixel, 2 * pixel, 2 * pixel);
      };
      // Each arm is directly tied to its own leg with the opposite sign.
      drawArm(this.farArm, pose[0], false);
      drawArm(this.nearArm, pose[1], true);
    }
  }
}
