import geometry from '../shared/interactions.json';

/** Pelvis height on the furniture, rather than a character's shoe position. */
export function seatSurface(room:string,seat:string|null):number|undefined {
  if(seat===null)return;
  const seats=(geometry as Record<string,{seats:Record<string,{surfaceY?:number}>}>)[room]?.seats;
  return seats?.[seat]?.surfaceY;
}
