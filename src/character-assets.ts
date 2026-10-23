import suki from '../assets/characters/suki/manifest.json';
import sid from '../assets/characters/sid/manifest.json';
import jilly from '../assets/characters/jilly/manifest.json';
import laura from '../assets/characters/laura/manifest.json';
import kay from '../assets/characters/kay/manifest.json';
import franco from '../assets/characters/franco/manifest.json';
import cora from '../assets/characters/cora/manifest.json';
import amber from '../assets/characters/amber/manifest.json';
import celine from '../assets/characters/celine/manifest.json';
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
 officeAction?:'call';officeFrameMs?:number;
 podiumFrames?:CharacterFrame[];podiumFrameMs?:number;
 mobilityFrames?:CharacterFrame[];
}
export interface CharacterManifest {schemaVersion:number;role:AvatarRole;worldHeight:number;seatedHeight:number;sources:Record<string,{file:string;size:number[];sha256:string;origin:string}>;member:CharacterData;provenance:{acceptance:string;date:string;codeBase:string};}
export const characterManifests={suki,sid,jilly,laura,kay,franco,cora,amber,celine} as unknown as Record<AvatarRole,CharacterManifest>;
export const characterRegistry={version:1,worldHeight:laura.worldHeight,seatedHeight:laura.seatedHeight,sources:Object.assign({},...Object.values(characterManifests).map(m=>m.sources)) as Record<string,{file:string;size:number[]}>,members:Object.fromEntries(Object.entries(characterManifests).map(([role,m])=>[role,m.member])) as Record<AvatarRole,CharacterData>};
const files=import.meta.glob(['../assets/characters/*/poses.png','../assets/characters/*/carry.png','../assets/characters/*/walk-side-a.png','../assets/characters/*/walk-side-b.png','../assets/characters/*/run.png','../assets/characters/*/carry-walk.png','../assets/characters/*/dance.png','../assets/characters/*/office-call.png','../assets/characters/*/saxophone.png','../assets/characters/*/mobility.png'],{eager:true,query:'?url',import:'default'}) as Record<string,string>;
export function characterSource(id:string){const file=characterRegistry.sources[id]?.file,url=files['../assets/characters/'+file];if(!url)throw Error('人物素材缺失：'+id);return url;}
const cache=new Map<string,Promise<HTMLImageElement>>();
export function characterImage(id:string){const url=characterSource(id);if(!cache.has(url)){const image=new Image();image.src=url;cache.set(url,image.decode().then(()=>image).catch(e=>{cache.delete(url);throw e;}));}return cache.get(url)!;}

/** Decode every sheet a role needs; resolves only when all are ready to draw. */
export function preloadCharacter(role:AvatarRole){const d=characterRegistry.members[role];return Promise.all([...new Set([...d.frames,...d.carryFrames,...d.officeFrames,...(d.podiumFrames??[]),...(d.mobilityFrames??[])].map(f=>f.source))].map(characterImage));}
