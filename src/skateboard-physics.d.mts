import type {RideMotion,DirectionInput} from './ride-physics.mjs';
export type SkateMotion=RideMotion;
export type SkateInput=DirectionInput;
/** delta is in milliseconds; movement heading does not rotate the board artwork. */
export function stepSkate(state:SkateMotion,input:SkateInput,delta:number,walkable:(x:number,y:number,heading?:number)=>boolean):SkateMotion & {vx:number;vy:number};
