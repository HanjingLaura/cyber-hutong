import type {ChatChannel,Message,Role,AgentStatus} from './types';

type MessageScope=Pick<Message,'sender'|'recipient'|'scene'|'channel'>;
export const messageChannel=(message:MessageScope):ChatChannel=>message.recipient?'dm':message.channel==='lobby'?'lobby':'scene';
export const compareMessages=(a:Message,b:Message)=>(a.at??0)-(b.at??0)||a.seq-b.seq;
type Thread={draft:string;mentions:Set<Role>;messages:Map<number,Message>;unread:number;jobs:Map<string,AgentStatus>;pendingSend?:{text:string;id:string}};
export class ChatState{
 channel:ChatChannel='scene';scene='hutong';peer:Role|null=null;
 private threads=new Map<string,Thread>();private seen=new Set<number>();
 constructor(readonly role:Role){}
 get key(){return this.channel==='lobby'?'lobby':this.channel==='dm'?'dm:'+this.peer:'scene:'+this.scene;}
 get current(){return this.thread(this.key);}
 thread(key:string){let thread=this.threads.get(key);if(!thread){thread={draft:'',mentions:new Set(),messages:new Map(),unread:0,jobs:new Map()};this.threads.set(key,thread);}return thread;}
 select(channel:ChatChannel,scene:string,peer:Role|null,read=true){this.channel=channel;this.scene=scene;this.peer=peer;if(read)this.current.unread=0;}
 keyFor(message:MessageScope){const channel=messageChannel(message);if(channel==='dm'){if(message.sender!==this.role&&message.recipient!==this.role)return null;return 'dm:'+(message.sender===this.role?message.recipient:message.sender);}return channel==='lobby'?'lobby':'scene:'+message.scene;}
 agent(status:AgentStatus){const key=this.keyFor(status);if(!key)return;const jobs=this.thread(key).jobs,id=status.id??'ephemeral:'+status.role,old=jobs.get(id);if(old&&['sent','failed','canceled'].includes(old.status)&&['queued','generating'].includes(status.status))return;if(status.id)jobs.delete('ephemeral:'+status.role);jobs.set(id,{...status,at:status.at??Date.now()});while(jobs.size>30)jobs.delete(jobs.keys().next().value!);}
 receive(message:Message,viewing:boolean){const key=this.keyFor(message);if(!key||this.seen.has(message.seq))return false;this.seen.add(message.seq);const thread=this.thread(key);thread.messages.set(message.seq,message);if(!(viewing&&key===this.key)&&message.sender!==this.role)thread.unread++;this.trim(thread);return true;}
 history(key:string,messages:Message[]){const thread=this.thread(key);for(const message of messages){if(this.keyFor(message)!==key)continue;thread.messages.set(message.seq,message);this.seen.add(message.seq);}this.trim(thread);}
 private trim(thread:Thread){if(thread.messages.size>100){const ordered=[...thread.messages.values()].sort(compareMessages);for(const message of ordered.slice(0,-100))thread.messages.delete(message.seq);}}
 unread(){return [...this.threads].map(([key,thread])=>[key,thread.unread] as const).filter(([,count])=>count>0);}
}
