export const TARGETS=Object.freeze([
 {x:501,y:367,w:29,h:48,visibleHeight:29,revealLeft:.18,revealRight:.91,brightness:.60,hint:'看看书铺门口附近'},
 {x:150,y:236,w:28,h:46,visibleHeight:28,revealLeft:.28,revealRight:.94,brightness:.69,hint:'看看左边的窗户附近'},
 {x:1086,y:319,w:27,h:45,visibleHeight:28,revealLeft:.12,revealRight:.78,brightness:.64,hint:'看看右边的小书架附近'},
 {x:690,y:228,w:26,h:43,visibleHeight:26,revealLeft:.25,revealRight:.93,brightness:.68,hint:'看看上面的盆栽附近'},
 {x:247,y:477,w:32,h:53,visibleHeight:30,revealLeft:.15,revealRight:.80,brightness:.63,hint:'看看左下方的木箱附近'},
].map(t=>Object.freeze(t)));
export function createRound(){return {status:'ready',remaining:60,started:0,penalty:0,shots:0,found:[]};}
export function startRound(round,now){Object.assign(round,createRound(),{status:'playing',started:now});}
export function tickRound(round,now){
 if(round.status!=='playing')return;
 round.remaining=Math.max(0,60-(now-round.started)/1000-round.penalty);
 if(round.remaining<=0)round.status='lost';
}
export function shoot(round,targetId,now){
 tickRound(round,now);if(round.status!=='playing')return;
 round.shots++;
 if(Number.isInteger(targetId)&&targetId>=0&&targetId<TARGETS.length&&!round.found.includes(targetId)){
  round.found.push(targetId);if(round.found.length===TARGETS.length)round.status='won';
 }else {round.penalty+=3;tickRound(round,now);}
}
export function visibleHit(x,y,alpha,target=TARGETS[0]){
 if(x<target.x+target.w*target.revealLeft||x>=target.x+target.w*target.revealRight||y<target.y||y>=target.y+target.visibleHeight)return false;
 return alpha((x-target.x)/target.w,(y-target.y)/target.h)>80;
}
