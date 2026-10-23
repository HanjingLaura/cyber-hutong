export interface Round {status:'ready'|'playing'|'won'|'lost';remaining:number;started:number;penalty:number;shots:number;found:number[];}
export interface Target {x:number;y:number;w:number;h:number;visibleHeight:number;revealLeft:number;revealRight:number;brightness:number;hint:string;}
export const TARGETS:readonly Readonly<Target>[];
export function createRound():Round;
export function startRound(round:Round,now:number):void;
export function tickRound(round:Round,now:number):void;
export function shoot(round:Round,targetId:number|null,now:number):void;
export function visibleHit(x:number,y:number,alpha:(x:number,y:number)=>number,target?:Readonly<Target>):boolean;
