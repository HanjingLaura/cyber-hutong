import { hutong } from './hutong.mjs';

// Floor edges measured from rest-area-v2-1280x720.png and elevator-lobby-1280x720.png.
// Furniture stays in the background. Points below are standing spots in the open floor.
export const restArea = {
  id: 'rest_area',
  background: '/scenes/rest-area.png',
  file: 'rest-area-v2-1280x720.png',
  walkable: [
    { x: 260, y: 430 }, { x: 980, y: 420 }, { x: 1120, y: 560 }, { x: 1200, y: 700 },
    { x: 80, y: 700 }, { x: 160, y: 540 },
  ],
  seats: [],
  exits: [
    {
      id: 'doors',
      label: '门口',
      destination: 'hutong',
      choices: [{ scene: 'hutong', label: '回胡同' }],
      area: [{ x: 520, y: 430 }, { x: 760, y: 430 }, { x: 760, y: 500 }, { x: 520, y: 500 }],
    },
  ],
  spawn: { x: 640, y: 470 },
  targets: {
    coffee_machine: { x: 360, y: 520 },
  },
  foreground: [],
};

export const elevator = {
  id: 'elevator',
  background: '/scenes/elevator.png',
  file: 'elevator-lobby-1280x720.png',
  walkable: [
    { x: 240, y: 430 }, { x: 1040, y: 430 }, { x: 1080, y: 640 }, { x: 200, y: 640 },
  ],
  seats: [],
  exits: [
    {
      id: 'back',
      label: '门口',
      destination: 'hutong',
      choices: [{ scene: 'hutong', label: '回胡同' }],
      area: [{ x: 480, y: 560 }, { x: 800, y: 560 }, { x: 800, y: 630 }, { x: 480, y: 630 }],
    },
  ],
  spawn: { x: 640, y: 560 },
  targets: {
    gather_point: { x: 640, y: 500 },
  },
  foreground: [],
};

const backToHutong = {
  id: 'back',
  label: '门口',
  destination: 'hutong',
  choices: [{ scene: 'hutong', label: '回胡同' }],
  area: [{ x: 480, y: 620 }, { x: 800, y: 620 }, { x: 800, y: 700 }, { x: 480, y: 700 }],
};

export const restroom = {
  id: 'restroom',
  background: '/scenes/restroom.png',
  file: 'office-restroom-4-stalls-2-sinks-v2-1280x720.png',
  walkable: [
    { x: 300, y: 400 }, { x: 980, y: 400 }, { x: 1040, y: 700 }, { x: 240, y: 700 },
  ],
  seats: [],
  exits: [backToHutong],
  spawn: { x: 640, y: 560 },
  targets: { fuguidiao: { x: 420, y: 520 } },
  foreground: [],
};

export const popmart = {
  id: 'popmart',
  background: '/scenes/popmart.png',
  file: 'popmart-store-1280x720.png',
  walkable: [
    { x: 400, y: 300 }, { x: 475, y: 300 }, { x: 475, y: 575 },
    { x: 810, y: 575 }, { x: 810, y: 300 }, { x: 920, y: 300 },
    { x: 1100, y: 610 }, { x: 830, y: 620 }, { x: 830, y: 690 },
    { x: 450, y: 690 }, { x: 450, y: 620 }, { x: 170, y: 610 },
  ],
  seats: [],
  exits: [backToHutong],
  spawn: { x: 640, y: 610 },
  targets: { buzz_lightyear: { x: 860, y: 560 } },
  foreground: [],
};

export const concert = {
  id: 'concert',
  background: '/scenes/concert.png',
  file: 'concert-arena-v2-1280x720.png',
  walkable: [
    { x: 200, y: 430 }, { x: 1080, y: 430 }, { x: 1100, y: 650 }, { x: 180, y: 650 },
  ],
  seats: [],
  exits: [backToHutong],
  spawn: { x: 640, y: 600 },
  targets: { zhu_zhixin: { x: 640, y: 480 } },
  foreground: [],
};

export const hawaii = {
  id: 'hawaii',
  background: '/scenes/hawaii.png',
  file: 'hawaii-room-empty-v3-1280x720.png',
  walkable: [
    { x: 300, y: 340 }, { x: 980, y: 340 }, { x: 1000, y: 700 }, { x: 280, y: 700 },
  ],
  seats: [],
  exits: [backToHutong],
  spawn: { x: 640, y: 560 },
  targets: { celine: { x: 640, y: 460 } },
  foreground: [],
};

export const gym = {
  id: 'gym',
  background: '/scenes/gym.png',
  file: 'office-gym-1280x720.png',
  walkable: [
    { x: 280, y: 300 }, { x: 1000, y: 300 }, { x: 1080, y: 700 }, { x: 200, y: 700 },
  ],
  seats: [],
  exits: [backToHutong],
  spawn: { x: 640, y: 540 },
  targets: { floor: { x: 640, y: 420 }, tutu: { x: 780, y: 500 } },
  foreground: [],
};

export const mixian = {
  id: 'mixian',
  background: '/scenes/mixian.png',
  file: 'mixian-restaurant-1280x720.png',
  walkable: [
    { x: 180, y: 680 }, { x: 1100, y: 680 }, { x: 1080, y: 560 }, { x: 760, y: 560 },
    { x: 760, y: 420 }, { x: 520, y: 420 }, { x: 520, y: 560 }, { x: 200, y: 560 },
  ],
  seats: [],
  exits: [backToHutong],
  spawn: { x: 640, y: 600 },
  targets: { counter: { x: 640, y: 480 } },
  foreground: [],
};

export const guestSprites = {
  zhu_zhixin: {
    name: '朱志鑫', file: 'zhu-zhixin-green.png',
    frames: [[56, 194, 150, 296], [260, 194, 146, 296], [455, 198, 144, 292], [656, 211, 145, 279], [878, 244, 138, 246], [1079, 231, 158, 259]],
  },
  buzz_lightyear: {
    name: '巴斯光年', file: 'buzz-lightyear-green.png',
    frames: [[46, 194, 165, 296], [238, 194, 194, 296], [460, 194, 136, 296], [653, 194, 145, 296], [856, 267, 184, 223], [1064, 262, 184, 228]],
  },
  fuguidiao: {
    name: '富贵貂', file: 'fuguidiao-green.png',
    frames: [[45, 235, 171, 255], [252, 235, 168, 255], [424, 235, 248, 255], [672, 235, 166, 255], [858, 235, 180, 255], [1072, 244, 168, 246]],
  },
  celine: {
    name: 'Celine', file: 'celine-green.png',
    frames: [[54, 190, 150, 300], [264, 194, 142, 296], [456, 198, 142, 292], [655, 202, 146, 288], [874, 240, 146, 250], [1086, 231, 142, 259]],
  },
  tutu: {
    name: '图图', file: 'tutu-green.png',
    frames: [[44, 244, 163, 214], [240, 246, 157, 216], [408, 256, 205, 202], [637, 266, 217, 191], [882, 254, 163, 208], [1090, 254, 153, 211]],
  },
};

export const scenes = {
  hutong: { ...hutong, targets: Object.fromEntries(hutong.seats.map((seat) => [seat.id, seat.stand])) },
  rest_area: restArea,
  elevator,
  restroom,
  popmart,
  concert,
  hawaii,
  gym,
  mixian,
};

export function targetPoint(scene, target) {
  return scene.targets?.[target] ?? null;
}
