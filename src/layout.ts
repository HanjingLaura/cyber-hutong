export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 360;
// Floor and vertical projection are shared by the walls, both desk rows, chairs
// and actors. Physical layout defaults (cm) are estimates, not measured survey data.
export const ROOM_TOP = 100;
export const ROOM_DEPTH = 340;
export const FLOOR_PROJECTION = .55;
export const HEIGHT_PROJECTION = .60;
export const floorY = (centimeters: number) => ROOM_TOP + centimeters * FLOOR_PROJECTION;
export const REVERSE_Y = ROOM_TOP + floorY(ROOM_DEPTH);
// World dimensions belong to the room, not to the arbitrary export canvas of a PNG.
// The original 480-wide desk row and its anchors shrink together to 384.
// Render at 640x360 with nearest-neighbor display to retain small sprite details.
export const PIXEL_RATIO = 1;
export const CONTENT_SCALE = .8;
export const scaleRowPoint = (point: Point, row: 'culture' | 'plain'): Point => {
  const wallY = row === 'culture' ? ROOM_TOP : floorY(ROOM_DEPTH);
  return { x: VIEW_WIDTH / 2 + (point.x - VIEW_WIDTH / 2) * CONTENT_SCALE,
    y: wallY + (point.y - wallY) * CONTENT_SCALE };
};
export const ACTOR_SCALE = .64;
export const METRICS = { standing: 96 * ACTOR_SCALE, seated: 78 * CONTENT_SCALE, chairWidth: 60 * CONTENT_SCALE, chairHeight: 66 * CONTENT_SCALE,
  deskRowWidth: 480 * CONTENT_SCALE, workstationWidth: 120 * CONTENT_SCALE, deskHeight: 84 * CONTENT_SCALE, laptopWidth: 32 * CONTENT_SCALE };
export const DESK_ROWS = [
  { row: 'culture' as const, facing: 2 as Facing, floorStart: floorY(0), floorEnd: scaleRowPoint({ x: 0, y: floorY(70) }, 'culture').y },
  { row: 'plain' as const, facing: 0 as Facing, floorStart: scaleRowPoint({ x: 0, y: floorY(270) }, 'plain').y, floorEnd: floorY(340) },
];
export interface Point { x: number; y: number }
export type Facing = 0 | 1 | 2 | 3;
export interface Workstation { id: string; row: 'culture' | 'plain'; number: number; foot: Point; stand: Point; facing: Facing }

// L/R refer to the real walls when entering the alcove. They stay attached to
// the same seat when the camera switches; they are not screen-space directions.
export const WORKSTATIONS: Workstation[] = ['culture', 'plain'].flatMap((row, index) =>
  Array.from({ length: 4 }, (_, number) => ({
    id: `${index === 0 ? 'R' : 'L'}${number + 1}`,
    row: row as Workstation['row'], number: number + 1,
    foot: scaleRowPoint({ x: 160 + number * 120, y: floorY(index === 0 ? 102 : 238) }, row as Workstation['row']),
    stand: scaleRowPoint({ x: 160 + number * 120, y: index === 0 ? 184 : 204 }, row as Workstation['row']),
    facing: index === 0 ? 2 : 0,
  })),
);
export const SPAWN: Point = { x: 596, y: floorY(ROOM_DEPTH / 2) };
export function project(point: Point, reverse: boolean): Point {
  return reverse ? { x: VIEW_WIDTH - point.x, y: REVERSE_Y - point.y } : { ...point };
}
export function visualFacing(facing: Facing, reverse: boolean): Facing {
  return (reverse ? (facing + 2) % 4 : facing) as Facing;
}
export function canWalk(point: Point, workstations: Workstation[] = WORKSTATIONS): boolean {
  const radius = 5;
  const inAisle = point.x >= 64 + radius && point.x <= 608 - radius && point.y >= 166 && point.y <= 221;
  const inEntrance = point.x >= 581 + radius && point.x <= 613 - radius && point.y >= ROOM_TOP + radius && point.y <= floorY(ROOM_DEPTH) - radius;
  if (!inAisle && !inEntrance) return false;
  return !workstations.some(seat => Math.abs(point.x - seat.foot.x) < METRICS.chairWidth / 2 + radius
    && point.y + radius > seat.foot.y - 13 && point.y - radius < seat.foot.y + 2);
}
