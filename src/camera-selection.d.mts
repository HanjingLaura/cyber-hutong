export type CropRect={x:number;y:number;width:number;height:number};
export function cropRect(start:{x:number;y:number},end:{x:number;y:number},width:number,height:number):CropRect|null;
