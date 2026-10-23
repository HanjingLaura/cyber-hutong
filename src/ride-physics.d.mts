export type RideMotion={x:number;y:number;speed:number;heading:number;vx?:number;vy?:number};
export type DirectionInput={x:number;y:number};
export type RideOptions={maxSpeed?:number;acceleration?:number;deceleration?:number};
export function stepRide(state:RideMotion,input:DirectionInput,delta:number,walkable:(x:number,y:number,heading?:number)=>boolean,options?:RideOptions):RideMotion & {vx:number;vy:number};
