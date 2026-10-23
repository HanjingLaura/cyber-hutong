export const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'] as const;
export type Role=typeof roles[number];
export type User={id:string;username:string;role:Role|null;hand:string|null;revision:number;seasoning?:string[];progressVersion?:number};
export type Player={role:Role;name:string;scene:string;x:number;y:number;facing:number;moving:boolean;seat:string|null;hand:string|null;revision:number;activity?:string;travelId?:string;offline?:boolean;agentReady?:boolean;agentTakeoverAt?:number};
export type ChatChannel='lobby'|'scene'|'dm';
export type AgentStatus={id?:string;role:Role;sender:Role;recipient:Role|null;channel:ChatChannel;scene:string;status:'queued'|'generating'|'sent'|'failed'|'canceled'|'human'|'disabled'|'waiting';reason?:string;at?:number};
export type Message={seq:number;sender:Role;recipient:Role|null;scene:string;body:string;at:number;npc:number;channel?:ChatChannel;mentions?:Role[]};
export type World={self:User;controller:boolean;players:Player[];online:{role:Role;scene:string}[];roster:{role:Role;claimed:boolean}[];npcs?:string[];npcReactions?:import('../npc-feedback').NpcReaction[];clock?:number};
