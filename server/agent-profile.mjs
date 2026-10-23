import {fail} from './store.mjs';
import {roles} from './personas.mjs';
import {lauraProfileCandidate} from './laura-profile-candidate.mjs';
import {loadAgentPersonas,defaultPersonaDirectory} from './agent-personas.mjs';

const text=(value,max,label)=>{if(typeof value!=='string'||value.length>max)fail(400,label+'格式无效');return value.trim();};
export function createAgentProfiles(store,{directory=defaultPersonaDirectory}={}){
 const personas=directory===null?null:loadAgentPersonas(directory);
 const db=store.db;db.exec('CREATE TABLE IF NOT EXISTS agent_profile_versions(account TEXT NOT NULL,revision INTEGER NOT NULL,profile TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(account,revision))');
 const get=id=>{const row=store.byId(id);if(!row||!roles.includes(row.role))fail(403,'请先领取角色');if(personas)return structuredClone(personas.get(row.role));return JSON.parse(row.profile).agent??(row.role==='laura'?lauraProfileCandidate():{revision:0,source:'',sourceVersion:'',voice:'',facts:[],examples:[],rules:[],confirmed:false,enabled:false,updatedAt:0});};
 return{get,
  save(id,input){if(personas)fail(403,'人物资料由后台目录维护');const row=store.byId(id),old=get(id);if((input.revision??0)!==(old?.revision??0))fail(409,'资料已更新，请重新读取');
   const source=text(input.source??'',200,'资料来源'),voice=text(input.voice??'',1000,'表达习惯');
   const items=(values,samples=false)=>{if(!Array.isArray(values)||values.length>24)fail(400,'资料条目过多');return values.map(value=>{
    if(!value||!['public','private'].includes(value.scope)||value.peer&&!roles.includes(value.peer))fail(400,'资料可见范围无效');
    const common={scope:value.scope,peer:value.scope==='private'?(value.peer??null):null,source:text(value.source??source,200,'条目来源')};
    return samples?{...common,context:text(value.context??'',300,'对话上下文'),reply:text(value.reply,500,'对话样例')}:{...common,text:text(value.text,300,'已确认事实')};
   });};
   const facts=items(input.facts??[]),examples=items(input.examples??[],true);
   const rules=input.rules??[];if(!Array.isArray(rules)||rules.length>20)fail(400,'回复边界过多');
   const confirmed=input.confirmed===true;
   if(confirmed&&(!source||!voice||!facts.length||facts.some(f=>!f.text||!f.source)))fail(400,'确认前请补齐来源、事实和表达习惯');
   if(input.enabled===true&&!confirmed)fail(400,'本人确认资料后才能开启分身回复');
   const profile={revision:(old?.revision??0)+1,source,sourceVersion:text(input.sourceVersion??'',100,'来源版本'),voice,facts,examples,rules:rules.map(rule=>text(rule,300,'回复边界')),confirmed,enabled:confirmed&&input.enabled===true,updatedAt:Date.now()};
   db.prepare('UPDATE accounts SET profile=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.profile),agent:profile}),id);
   db.prepare('INSERT INTO agent_profile_versions VALUES(?,?,?,?)').run(id,profile.revision,JSON.stringify(profile),profile.updatedAt);return profile;
  }
 };
}
export function scopedAgentProfile(profile,channel,peer,role='laura'){
 const visible=item=>item.scope==='public'||channel==='dm'&&item.scope==='private'&&(!item.peer||item.peer===peer);
 return {role,aliases:profile.aliases??[],knownAliases:profile.knownAliases??{},confirmedFacts:profile.facts.filter(visible).map(item=>item.text),voice:profile.voice,examples:profile.examples.filter(visible).map(({context,reply})=>({context,reply})),rules:profile.rules};
}
