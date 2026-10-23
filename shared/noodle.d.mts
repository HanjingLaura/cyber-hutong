export const noodleTables:{x:number;y:number}[];
export const noodleSeats:{id:string;index:number;x:number;y:number;approach:number[];surfaceY:number;facing:number;table:number}[];
export function noodleSlotPosition(table:number,slot:number):{x:number;y:number};
export function noodleTableReachable(table:number,x:number,y:number):boolean;
