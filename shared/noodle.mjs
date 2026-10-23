import geometry from './interactions.json' with {type:'json'};
export const noodleTables=[{x:213,y:264},{x:439,y:264}];
export const noodleSeats=Object.entries(geometry.noodle.seats).map(([id,s])=>({id,index:Number(id),x:s.at[0],y:s.at[1],approach:s.approach,surfaceY:s.surfaceY,facing:s.facing??2,table:Number(id)%4<2?0:1}));
export function noodleSlotPosition(table,slot){const t=noodleTables[table];return{x:t.x+(slot%3-1)*29,y:224+Math.floor(slot/3)*8};}
export function noodleTableReachable(table,x,y){
 const t=noodleTables[table];if(!t||!Number.isFinite(x)||!Number.isFinite(y))return false;
 // Narrow bands at each table edge and each seat: no counter-to-table reach.
 return Math.abs(x-t.x)<=85&&y>=224&&y<=318||noodleSeats.some(s=>s.table===table&&Math.abs(x-s.x)<=25&&Math.abs(y-s.y)<=28);
}
