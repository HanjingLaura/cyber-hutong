export const campusCones:{x:number;y:number;radius:number}[];
export function outdoorWalkable(scene:string,x:number,y:number):boolean;
export function scooterWalkable(x:number,y:number):boolean;
export function skateboardWalkable(x:number,y:number):boolean;
export function scooterPathClear(ax:number,ay:number,bx:number,by:number):boolean;
export function walkerScooterPathClear(ax:number,ay:number,bx:number,by:number,scooter?:{x:number;y:number}|null):boolean;
export function scooterDismountPoint(x:number,y:number,scooter?:{x:number;y:number}|null):[number,number];
export function safeOutdoorPoint(scene:string,x:number,y:number,mode?:string):[number,number];
