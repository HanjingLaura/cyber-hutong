import {stepRide} from './ride-physics.mjs';
/** Same direct directional controls, with a lighter and slower board response. */
export function stepSkate(state,input,delta,walkable){
 return stepRide(state,input,delta,walkable,{maxSpeed:105,acceleration:1900,deceleration:1800});
}
