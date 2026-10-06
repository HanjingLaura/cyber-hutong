import Phaser from 'phaser';
import { registerFrames, setSpriteFrame, type SpriteFrame } from './frames';
import { SideWalkLegs, sideUpperFrame, heldSideFrame } from './side-walk-legs';
import { HeldItemView, type GripSlot } from './held-item';
import { METRICS } from './layout';
import { playerInventory, items } from './player-inventory';
import gripRegistry from '../assets/metadata/owner-grips.json';

/** Uses the approved avatar sheets and the same gait/held-item renderer as the office. */
export class ShopActor {
  private frames: Record<string, SpriteFrame[]>;
  private actor: Phaser.GameObjects.Image;
  private legs: SideWalkLegs;
  private held: HeldItemView;
  private grips: Map<string, GripSlot>;
  private time = 0;
  private facing = 0;
  constructor(scene: Phaser.Scene) {
    this.frames = {
      idle: registerFrames(scene, 'idle', 4, 1, true),
      walk: registerFrames(scene, 'walk', 4, 4, true),
      side: registerFrames(scene, 'sideWalk', 6, 2, true),
      seated: registerFrames(scene, 'seated', 3, 2, true),
      seatedHold: registerFrames(scene, 'rest-seated-hold', 3, 1, true),
      hold: registerFrames(scene, 'rest-hold', 4, 5, true, { x: [0, .32, .51, .70, 1], y: [0, .207, .412, .609, .808, 1] }),
    };
    this.grips = new Map(Object.entries(gripRegistry['rest-hold'].slots));
    this.actor = scene.add.image(320, 320, 'idle');
    this.legs = new SideWalkLegs(scene);
    this.held = new HeldItemView(scene);
  }
  hide(){this.actor.setVisible(false);this.legs.hide();this.held.hide();}
  draw(x: number, y: number, facing: number, moving: boolean, delta: number, seated = false, depth = y + 1, renderHeight?: number, seatPose=0, seatSurface?:number) {
    this.actor.setVisible(true);
    this.time = moving && this.facing === facing ? this.time + Math.min(delta, 50) : 0;
    this.facing = facing;
    this.legs.hide(); this.actor.setFlipX(false);
    const hand = playerInventory.hand;
    const height = renderHeight ?? (seated ? METRICS.seated : METRICS.standing);
    const frontSeat = seated && facing !== 2;
    const holdKey = frontSeat ? 'rest-seated-hold' : 'rest-hold';
    let frame: SpriteFrame;
    if (hand) {
      const phase = facing === 1 || facing === 3 ? heldSideFrame(this.time) : Math.floor(this.time / 125) % 4;
      frame = frontSeat ? this.frames.seatedHold[0] : this.frames.hold[moving ? (facing === 0 ? 4 : facing === 2 ? 12 : 8) + phase : facing];
      setSpriteFrame(this.actor, holdKey, frame, height);
      this.actor.setFlipX(moving && facing === 3);
      if (this.actor.flipX) this.actor.setOrigin(1 - frame.pivotX, 1);
    } else if (seated) {
      frame = this.frames.seated[facing === 2 ? Math.max(0,Math.min(2,seatPose)) : 3];
      setSpriteFrame(this.actor, 'seated', frame, height);
    } else {
      const side = moving && (facing === 1 || facing === 3);
      frame = side ? this.frames.side[(facing === 1 ? 0 : 6) + sideUpperFrame(this.time)]
        : moving ? this.frames.walk[facing * 4 + Math.floor(this.time / 125) % 4] : this.frames.idle[facing];
      setSpriteFrame(this.actor, side ? 'sideWalk' : moving ? 'walk' : 'idle', frame, height);
    }
    if(seated&&seatSurface!==undefined)y=seatSurface+this.actor.displayHeight*.28;
    this.actor.setPosition(Math.round(x), Math.round(y)).setDepth(depth);
    if (moving && (facing === 1 || facing === 3) && !hand) this.legs.draw(this.actor, frame, height, facing, this.time);
    if (hand && items[hand]) this.held.draw(this.actor, holdKey, frame,
      frontSeat ? gripRegistry['rest-seated-hold'].slots[frame.name as keyof typeof gripRegistry['rest-seated-hold']['slots']] : this.grips.get(frame.name)!,
      height, renderHeight ? { ...items[hand], width: items[hand].width * height / METRICS.standing, height: items[hand].height * height / METRICS.standing } : items[hand], this.actor.depth, facing);
    else this.held.hide();
  }
}
