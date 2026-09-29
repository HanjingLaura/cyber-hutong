// Canonical coordinates use the TTC-wall side view, not the login illustration.
export const VIEW = { width: 1280, height: 720 };
export const SPEED = 112;
export const ACTOR_RADIUS = 10;
export const INTERACT_RADIUS = 52;
export const LEASE_MS = 15000;

export const hutong = {
  id: 'hutong',
  background: '/scenes/hutong.png',
  file: 'cyber-hutong-empty-view-1-office-faithful-v2-1280x720.png',
  views: [
    { label: 'TTC 墙', background: '/scenes/hutong.png' },
    { label: '另一侧', background: '/scenes/hutong-reverse.png' },
  ],
  walkable: [
    { x: 30, y: 365 }, { x: 1250, y: 365 }, { x: 1250, y: 700 },
    { x: 1125, y: 700 }, { x: 1125, y: 485 }, { x: 30, y: 485 },
  ],
  // Far to near, matching the wall each row faces.
  seats: [
    { id: 'ttc-1', owner: 'jilly', stand: { x: 330, y: 390 }, sit: { x: 330, y: 340 }, facing: 'up' },
    { id: 'ttc-2', owner: 'cora', stand: { x: 560, y: 390 }, sit: { x: 560, y: 340 }, facing: 'up' },
    { id: 'ttc-3', owner: 'amber', stand: { x: 790, y: 390 }, sit: { x: 790, y: 340 }, facing: 'up' },
    { id: 'ttc-4', owner: 'franco', stand: { x: 1020, y: 390 }, sit: { x: 1020, y: 340 }, facing: 'up' },
    { id: 'opposite-1', owner: 'sid', stand: { x: 330, y: 465 }, sit: { x: 330, y: 515 }, facing: 'down' },
    { id: 'opposite-2', owner: 'suki', stand: { x: 560, y: 465 }, sit: { x: 560, y: 515 }, facing: 'down' },
    { id: 'opposite-3', owner: 'laura', stand: { x: 790, y: 465 }, sit: { x: 790, y: 515 }, facing: 'down' },
    { id: 'opposite-4', owner: 'kay', stand: { x: 1020, y: 465 }, sit: { x: 1020, y: 515 }, facing: 'down' },
  ],
  exits: [
    {
      id: 'aisle-mouth',
      label: '门口',
      destination: null,
      choices: [
        { scene: 'elevator', label: '电梯间' },
        { scene: 'rest_area', label: '休息区' },
        { scene: 'restroom', label: '厕所' },
        { scene: 'popmart', label: 'POP MART' },
        { scene: 'concert', label: '演唱会' },
        { scene: 'hawaii', label: 'Hawaii' },
        { scene: 'gym', label: '健身房' },
        { scene: 'mixian', label: '米线店' },
      ],
      area: [{ x: 1145, y: 620 }, { x: 1230, y: 620 }, { x: 1230, y: 690 }, { x: 1145, y: 690 }],
    },
  ],
  spawn: { x: 1180, y: 650 },
  targets: {},
  // Furniture slices of the same background, drawn again when they are closer than a sprite.
  foreground: [
    { x: 174, y: 490, w: 936, h: 148, depth: 535 },
  ],
};

export function heightAt(y, sceneId) {
  const profiles = {
    hutong: [0, 720, 112, 112], hawaii: [0, 720, 112, 112],
    rest_area: [350, 700, 106, 160], elevator: [350, 700, 112, 160],
    restroom: [300, 700, 110, 164], popmart: [300, 690, 92, 124],
    concert: [300, 700, 96, 112], gym: [280, 700, 112, 132], mixian: [320, 700, 108, 132],
  };
  const [far, near, small, large] = profiles[sceneId] || [350, 700, 100, 140];
  const t = Math.min(1, Math.max(0, (y - far) / (near - far)));
  return small + t * (large - small);
}

// The reverse illustration is a separate asset, never a mirrored bitmap (wall text stays correct).
// This affine projection is its own inverse. Input, actors and speech share the same mapping.
export function hutongPoint(point, reverse = false) {
  return reverse ? { x: 1280 - point.x, y: 790 - point.y } : { x: point.x, y: point.y };
}
export function hutongFacing(facing, reverse = false) {
  return reverse ? ({ up: 'down', down: 'up', left: 'right', right: 'left' }[facing] || facing) : facing;
}
