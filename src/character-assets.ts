import data from '../assets/metadata/team-v3.json';
import motion from '../assets/metadata/team-motion-v4.json';
import lauraMotion from '../assets/metadata/laura-motion-v5.json';
import lauraWalk from '../assets/metadata/laura-walk-v7.json';
import teamWalk from '../assets/metadata/team-walk-v8.json';
import teamRun from '../assets/metadata/team-run-v10.json';
import teamCarry from '../assets/metadata/team-carry-v12.json';
import lauraDance from '../assets/metadata/laura-dance-v12.json';
import celine from '../assets/metadata/celine-v1.json';
import type {Role} from './multiplayer/types';
import type {GripSlot} from './held-item';
export type AvatarRole=Role|'celine';
export interface CharacterFrame {
 name:string;source:string;rect:number[];pivotX:number;referenceHeight:number;
 foot:number[];seat:number[];grip:number[]|null;gripSide:number;slot:GripSlot|null;
 scaleXRatio?:number;offsetYRatio?:number;
}
export interface CharacterData {
 seat:string;frames:CharacterFrame[];carryFrames:CharacterFrame[];officeFrames:CharacterFrame[];
 carryFrontLoop:number[];carryBackLoop:number[];carryRightLoop:number[];walkLoopLength:number;approvedLegacy:boolean;
 sideWalkLoop?:number[];runLoop?:number[];sideWalkFrameMs?:number;runFrameMs?:number;carrySideFrameMs?:number;
}
export const characterRegistry=data as unknown as {version:number;worldHeight:number;seatedHeight:number;sources:Record<string,{file:string;size:number[]}>;members:Record<AvatarRole,CharacterData>;blackLaura:CharacterData};
characterRegistry.sources['celine-v1']={file:'../npcs/celine-v1.png',size:[1246,1263]};
const guestFrame=(index:number):CharacterFrame=>{const f=celine.frames[index],[,,w,h]=f.rect;return {...f,source:'celine-v1',referenceHeight:celine.referenceHeight,pivotX:.5,foot:[w/2,h],seat:[w/2,h*.72],grip:null,gripSide:0,slot:null};};
const guestFrames=Array.from({length:64},(_,i)=>guestFrame(i===0?0:i===1?2:i===2?1:i===4?10:i===5?11:i>=8&&i<12?6+i%2:i>=16&&i<20?8+i%2:i>=24&&i<30?4+i%2:i===39?10:i>=62?4+i%2:0));
characterRegistry.members.celine={seat:'L4',frames:guestFrames,carryFrames:guestFrames,officeFrames:[10,10,11,11].map(guestFrame),carryFrontLoop:[8,9,8,9],carryBackLoop:[16,17,16,17],carryRightLoop:[24,25,24,25],walkLoopLength:2,approvedLegacy:false};
const motionRegistry=motion as unknown as {sources:typeof characterRegistry.sources;members:Partial<Record<AvatarRole,{frames:CharacterFrame[];walkLoop:number[];runLoop:number[]}>>};
Object.assign(characterRegistry.sources,motionRegistry.sources);
for(const [role,animation]of Object.entries(motionRegistry.members)){
 const member=characterRegistry.members[role as AvatarRole],offset=member.frames.length;
 member.frames.push(...animation.frames);
 member.sideWalkLoop=animation.walkLoop.map(i=>i+offset);member.runLoop=animation.runLoop.map(i=>i+offset);
}
const lauraRegistry=lauraMotion as unknown as {sources:typeof characterRegistry.sources;members:Partial<Record<AvatarRole,{frames:CharacterFrame[];walkLoop:number[];runLoop:number[];sideWalkFrameMs:number;runFrameMs:number}>>};
Object.assign(characterRegistry.sources,lauraRegistry.sources);
for(const [role,animation]of Object.entries(lauraRegistry.members)){
 const member=characterRegistry.members[role as AvatarRole],offset=member.frames.length;
 member.frames.push(...animation.frames);member.sideWalkLoop=animation.walkLoop.map(i=>i+offset);member.runLoop=animation.runLoop.map(i=>i+offset);
 member.sideWalkFrameMs=animation.sideWalkFrameMs;member.runFrameMs=animation.runFrameMs;
}
Object.assign(characterRegistry.sources,lauraWalk.sources);
const walkMember=characterRegistry.members.laura,walkOffset=walkMember.frames.length;
walkMember.frames.push(...lauraWalk.members.laura.frames as CharacterFrame[]);
walkMember.sideWalkLoop=lauraWalk.members.laura.walkLoop.map(i=>i+walkOffset);
walkMember.sideWalkFrameMs=lauraWalk.members.laura.sideWalkFrameMs;
Object.assign(characterRegistry.sources,teamWalk.sources);
for(const [role,animation]of Object.entries(teamWalk.members)){
 const member=characterRegistry.members[role as AvatarRole],offset=member.frames.length;
 member.frames.push(...animation.frames as CharacterFrame[]);
 member.sideWalkLoop=animation.walkLoop.map(index=>index+offset);
 member.sideWalkFrameMs=animation.sideWalkFrameMs;
}
Object.assign(characterRegistry.sources,teamRun.sources);
for(const [role,animation]of Object.entries(teamRun.members)){
 const member=characterRegistry.members[role as AvatarRole],offset=member.frames.length;
 member.frames.push(...animation.frames as CharacterFrame[]);
 member.runLoop=animation.runLoop.map(index=>index+offset);member.runFrameMs=animation.runFrameMs;
}
Object.assign(characterRegistry.sources,teamCarry.sources,lauraDance.sources);
for(const [role,animation]of Object.entries(teamCarry.members)){
 const member=characterRegistry.members[role as AvatarRole],offset=member.carryFrames.length;
 member.carryFrames.push(...animation.frames as CharacterFrame[]);
 member.carryRightLoop=animation.carryLoop.map(index=>index+offset);member.carrySideFrameMs=animation.carrySideFrameMs;
}
lauraDance.members.laura.indices.forEach((index,i)=>{characterRegistry.members.laura.frames[index]=lauraDance.members.laura.frames[i] as CharacterFrame;});
const files=import.meta.glob(['../assets/characters/team/v3/*.png','../assets/characters/team/v4/*.png','../assets/characters/team/v8/*.png','../assets/characters/team/v10/*.png','../assets/characters/team/v12/*.png','../assets/characters/laura/v5/*.png','../assets/characters/laura/v6/*.png','../assets/characters/laura/v7/*.png','../assets/characters/laura/approved/*.png','../assets/npcs/celine-v1.png'],{eager:true,query:'?url',import:'default'}) as Record<string,string>;
export function characterSource(id:string){const file=characterRegistry.sources[id]?.file,url=id==='celine-v1'?files['../assets/npcs/celine-v1.png']:files['../assets/characters/'+file];if(!url)throw Error('人物素材缺失：'+id);return url;}
const cache=new Map<string,Promise<HTMLImageElement>>();
export function characterImage(id:string){const url=characterSource(id);if(!cache.has(url)){const image=new Image();image.src=url;cache.set(url,image.decode().then(()=>image).catch(e=>{cache.delete(url);throw e;}));}return cache.get(url)!;}
