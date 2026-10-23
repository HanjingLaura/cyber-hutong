import {fail} from './store.mjs';

export const channelOf=message=>message.recipient?'dm':message.channel==='lobby'?'lobby':'scene';
export function normalizeChannel(channel,peer){
 const selected=channel??(peer?'dm':'scene');
 if(!['lobby','scene','dm'].includes(selected)||selected==='dm'&&!peer||selected!=='dm'&&peer)fail(400,'聊天频道与对象无效');
 return selected;
}
export function messageVisible(message,role,scene){
 const channel=channelOf(message);
 return channel==='dm'?message.sender===role||message.recipient===role:channel==='lobby'||message.scene===scene;
}
