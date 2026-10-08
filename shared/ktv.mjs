// Original short songs. Shared clock and furniture rules are used by client and server.
export const ktvSongs = [
 {id:'night',name:'胡同夜唱',bpm:108,notes:[60,64,67,64,62,65,69,67],lines:['把今天装进一段旋律','让晚灯照亮我们的声音','走过胡同 转角再相遇','这一拍 留给身边的你']},
 {id:'breeze',name:'晚风合拍',bpm:90,notes:[57,60,64,67,65,64,60,62],lines:['晚风轻轻推开门','桌边还有一盏灯','把烦恼唱成回声','下一句 我们一起哼']},
 {id:'friends',name:'朋友的副歌',bpm:120,notes:[60,60,67,69,67,65,64,62],lines:['你一句 我一句','把笑声放进旋律','不赶路 不着急','副歌里还有你']},
];
export const ktvLights=['暖光','紫光','派对'];
export const ktvTargets={terminal:[557,226],mic:[417,225],lights:[581,259]};
export const ktvObstacles=[
 [25,98,120,247], // left sofa
 [100,337,128,188], // rear sofa
 [111,307,225,299], // coffee table and stools
 [337,371,140,191], [479,510,139,190], // speakers
 [530,590,138,210], // song terminal
];
export function ktvWalkable(x,y){return x>=30&&x<=606&&y>=185&&y<=345&&!ktvObstacles.some(([l,r,t,b])=>x>l&&x<r&&y>t&&y<b);}
export const songDuration=song=>32*60000/song.bpm;
export const emptyKtvPlayer=()=>({queue:[],playing:false,started:0,offset:0});
// Expired songs are derived from a server timestamp; all listeners hear the same bar.
export function ktvPlayback(state,now=Date.now()){
 const queue=[...(state.queue??[])];
 let elapsed=Math.max(0,state.offset??0)+(state.playing?Math.max(0,now-state.started):0);
 while(queue.length){const song=ktvSongs.find(s=>s.id===queue[0]);if(!song){queue.shift();continue;}const duration=songDuration(song);if(elapsed<duration)return {queue,song,elapsed,playing:!!state.playing};elapsed-=duration;queue.shift();}
 return {queue,song:null,elapsed:0,playing:false};
}
export function changeKtvPlayer(state,action,id,now=Date.now()){
 const current=ktvPlayback(state,now),next={queue:current.queue,playing:current.playing,started:now,offset:current.elapsed};
 if(action==='queue'){
  if(!ktvSongs.some(s=>s.id===id))throw Error('歌曲不存在');
  if(next.queue.length>=12)throw Error('已点满 12 首，唱完再加');
  next.queue.push(id);if(!current.song){next.playing=true;next.offset=0;}
 }else if(action==='skip'){
  if(!next.queue.length)throw Error('还没有点歌');
  next.queue.shift();next.offset=0;next.playing=next.queue.length>0;
 }else if(action==='play'){
  if(!next.queue.length)throw Error('先点一首歌');next.playing=!next.playing;
 }else throw Error('点歌操作无效');
 return next;
}
export function ktvBeatResult(elapsed,bpm){
 const duration=60000/bpm,index=Math.round(elapsed/duration),distance=Math.abs(elapsed-index*duration);
 return {index,grade:distance<=90?'准拍':distance<=190?'合拍':'再跟一拍',points:distance<=90?100:distance<=190?60:0};
}
