// Sources: cyber-hutong examples/mvp-behavior/config.mjs and server/game-store.mjs.
// Habits are supplied facts, not inferred descriptions of real personalities.
export const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
export const habits={sid:'喜欢在工位用电脑开发。',laura:'用电脑开发，有时加入 Amber 和 Cora 的下楼活动。',jilly:'上班工作，有时刷手机，喜欢去演唱会。',cora:'喜欢 POP MART，常和 Amber 结伴下楼。',amber:'常和 Cora 结伴下楼，会回应 Celine 的夏威夷邀请。',franco:'喜欢打电话。',kay:'会去健身，早上给 Sid 买咖啡。',suki:'喜欢去米线店。'};
export function distillProfile(input,role){
  const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
  const facts=clean(input.habits,700)||habits[role];
  const voice=clean(input.voice,300),examples=clean(input.examples,1200);
  const quotes=examples.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,8),rules={};
  for(const quote of quotes){const match=quote.match(/^\[(办公|碰面|运动)\]\s*(.+)$/);if(match)(rules[match[1]]??=[]).push(match[2].slice(0,200));}
  return {habits:facts,voice,examples,confirmed:input.confirmed===true,autoReply:input.confirmed===true&&input.autoReply===true,
    distilled:{facts:facts.split(/[。\n]/).map(s=>s.trim()).filter(Boolean).slice(0,12),expression:voice,quotes,rules},version:2};
}
export function replyFor(role,text,profile){
  const p=distillProfile(profile||{},role);
  const event=/工作|电脑|开发|办公|上班/.test(text)?'办公':/健身|跑步|哑铃|运动/.test(text)?'运动':/你好|hi|hello|嗨|一起|要不要/i.test(text)?'碰面':null;
  if(p.confirmed&&event&&p.distilled.rules[event]?.length)return p.distilled.rules[event][0];
  if(/你好|hi|hello|嗨/i.test(text))return '嗨，今天过得怎么样？';
  if(/一起|去不去|要不要|走吗/.test(text))return '你打算去哪儿？我们先聊聊。';
  if(/喜欢|平时|做什么|习惯/.test(text))return p.distilled.facts[0]?.replace(/^喜欢/,'我喜欢').replace(/^用/,'我用').replace(/^常/,'我常').replace(/^会/,'我会')||'我有时会去休息室坐坐。';
  if(/咖啡|休息|吃/.test(text))return role==='suki'?'我喜欢米线，你想吃点什么？':'休息一下也不错，你想吃点什么？';
  // Only owner-provided examples can alter expression; never inspect other DMs.
  if(p.confirmed&&p.distilled.quotes.length)return p.distilled.quotes[0].slice(0,200);
  return '我听到了，你接着说。';
}
