import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {roles} from './personas.mjs';

export const defaultPersonaDirectory=fileURLToPath(new URL('./agent-personas/',import.meta.url));
export function loadAgentPersonas(directory=defaultPersonaDirectory){
 const profiles=new Map();
 for(const role of roles){
  try{
   const raw=readFileSync(join(directory,role+'.json'),'utf8');if(Buffer.byteLength(raw)>65536)throw Error();const input=JSON.parse(raw);
   const string=(value,max)=>{if(typeof value!=='string'||value.length>max)throw Error();return value.trim();};
   if(input.role!==role||typeof input.confirmed!=='boolean'||typeof input.enabled!=='boolean'||input.enabled&&!input.confirmed)throw Error();
   const source=string(input.source,200),voice=string(input.voice,1000),sourceVersion=string(input.sourceVersion,100);
   const aliases=input.aliases??[];if(!Array.isArray(aliases)||aliases.length>8)throw Error();const names=aliases.map(alias=>string(alias,40));if(names.some(alias=>!alias))throw Error();
   const entries=(items,examples=false)=>{if(!Array.isArray(items)||items.length>24)throw Error();return items.map(item=>{if(!['public','private'].includes(item.scope)||item.peer&&!roles.includes(item.peer))throw Error();const entry={scope:item.scope,peer:item.scope==='private'?item.peer??null:null,source:string(item.source??source,200)};return examples?{...entry,context:string(item.context??'',300),reply:string(item.reply,500)}:{...entry,text:string(item.text,300)};});};
   const facts=entries(input.facts),examples=entries(input.examples,true);if(!Array.isArray(input.rules)||input.rules.length>20)throw Error();const rules=input.rules.map(rule=>string(rule,300));
   if(input.confirmed&&(!source||!voice||!facts.length||facts.some(fact=>!fact.text||!fact.source)))throw Error();
   const revision=parseInt(createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0,12),16);
   profiles.set(role,{revision,source,sourceVersion,voice,aliases:names,facts,examples,rules,confirmed:input.confirmed,enabled:input.enabled,updatedAt:0});
  }catch{throw Error('后台人物配置无效或缺失：'+role+'.json');}
 }
 const owners=new Map(roles.map(role=>[role,role])),knownAliases={};
 for(const [role,profile] of profiles){knownAliases[role]=profile.aliases;for(const name of profile.aliases){const key=name.toLowerCase();if(owners.has(key))throw Error('后台人物昵称重复：'+role+'.json');owners.set(key,role);}}
 for(const profile of profiles.values()){profile.knownAliases=knownAliases;profile.revision=parseInt(createHash('sha256').update(JSON.stringify({revision:profile.revision,knownAliases})).digest('hex').slice(0,12),16);}
 return profiles;
}
