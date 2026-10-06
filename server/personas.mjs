// Sources: cyber-hutong examples/mvp-behavior/config.mjs and server/game-store.mjs.
// Habits are supplied facts, not inferred descriptions of real personalities.
export const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];

// Multi-clause habits distill into several first-person facts so offline replies feel less template-like.
export const habits={
  sid:'喜欢在工位用电脑开发。说话偏短，偶尔提一下手头的事。',
  laura:'用电脑开发，有时加入 Amber 和 Cora 的下楼活动。说话自然，会主动约人。',
  jilly:'上班工作，有时刷手机，喜欢去演唱会。语气轻松。',
  cora:'喜欢 POP MART，常和 Amber 结伴下楼。说话干脆。',
  amber:'常和 Cora 结伴下楼，会回应 Celine 的夏威夷邀请。语气友好。',
  franco:'喜欢打电话。说话直接，不绕弯。',
  kay:'会去健身，早上给 Sid 买咖啡。说话温和。',
  suki:'喜欢去米线店。说话随和，常提吃的。'
};

export const voices={
  sid:'短句，偶尔带一点工程师口吻。',
  laura:'自然口语，愿意一起行动。',
  jilly:'轻松随意，会聊演唱会。',
  cora:'干脆，爱提盲盒和下楼。',
  amber:'友好，常约 Cora。',
  franco:'直接，不拖泥带水。',
  kay:'温和，会提健身和咖啡。',
  suki:'随和，常聊米线和吃的。'
};

const splitFacts=text=>text.split(/[。！？!?\n；;]/).map(s=>s.trim()).filter(Boolean).slice(0,12);

const extractLikes=facts=>{
  const likes=[];
  for(const fact of facts){
    const match=fact.match(/(?:喜欢|爱|常会|常和|常提|会去|会|常)([^，。；;]+)/);
    if(match)likes.push(match[1].trim().slice(0,40));
  }
  return [...new Set(likes)].slice(0,6);
};

const pick=(list,seed='')=>{
  if(!list?.length)return null;
  let hash=0;
  for(let i=0;i<seed.length;i++)hash=(hash*31+seed.charCodeAt(i))>>>0;
  return list[hash%list.length];
};

const firstPerson=fact=>fact
  .replace(/^喜欢/,'我喜欢')
  .replace(/^用/,'我用')
  .replace(/^常和/,'我常和')
  .replace(/^常提/,'我常提')
  .replace(/^常/,'我常')
  .replace(/^会去/,'我会去')
  .replace(/^会/,'我会')
  .replace(/^上班/,'我上班')
  .replace(/^说话/,'我说话')
  .replace(/^语气/,'我语气')
  .replace(/^有时/,'我有时');

export function distillProfile(input,role){
  const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
  const factsText=clean(input.habits,700)||habits[role]||'';
  const voice=clean(input.voice,300)||voices[role]||'';
  const examples=clean(input.examples,1200);
  const quotes=examples.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,8);
  const rules={};
  for(const quote of quotes){
    const match=quote.match(/^\[(办公|碰面|运动)\]\s*(.+)$/);
    if(match)(rules[match[1]]??=[]).push(match[2].slice(0,200));
  }
  const facts=splitFacts(factsText);
  return {
    habits:factsText,
    voice,
    examples,
    confirmed:input.confirmed===true,
    autoReply:input.confirmed===true&&input.autoReply===true,
    distilled:{
      facts,
      likes:extractLikes(facts),
      expression:voice,
      quotes,
      rules
    },
    version:3
  };
}

export function replyFor(role,text,profile,context={}){
  const p=distillProfile(profile||{},role);
  const seed=String(text||'')+'|'+String(context.peer||'')+'|'+String(context.scene||'')+'|'+role;
  const event=/工作|电脑|开发|办公|上班/.test(text)?'办公'
    :/健身|跑步|哑铃|运动/.test(text)?'运动'
    :/你好|hi|hello|嗨|一起|要不要/i.test(text)?'碰面':null;

  if(p.confirmed&&event&&p.distilled.rules[event]?.length){
    return pick(p.distilled.rules[event],seed)||p.distilled.rules[event][0];
  }

  if(/你好|hi|hello|嗨/i.test(text)){
    const peer=typeof context.peer==='string'&&context.peer?context.peer[0].toUpperCase()+context.peer.slice(1):'';
    if(p.confirmed){
      const plain=p.distilled.quotes.filter(quote=>!/^\[/.test(quote));
      const quote=pick(plain,seed);
      if(quote)return quote.slice(0,200);
    }
    return pick([
      peer?`嗨 ${peer}，今天怎么样？`:'嗨，今天过得怎么样？',
      '嗨，刚忙完一会儿。',
      role==='kay'?'嗨，要不要喝点什么？':role==='suki'?'嗨，要不要一起去吃点？':'嗨，最近还好吗？'
    ],seed);
  }

  if(/一起|去不去|要不要|走吗/.test(text)){
    return pick([
      '你打算去哪儿？我们先聊聊。',
      '可以啊，你想去哪边？',
      role==='amber'||role==='cora'?'好啊，我们下楼走走？':role==='kay'?'行，我跟你一起。':'嗯，说说你想去哪儿。'
    ],seed);
  }

  if(/喜欢|平时|做什么|习惯/.test(text)){
    const fact=pick(p.distilled.facts,seed)||p.distilled.facts[0];
    if(fact){
      const line=firstPerson(fact);
      return /[。！？!?]$/.test(line)?line:`${line}。`;
    }
    return '我有时会去休息室坐坐。';
  }

  if(/咖啡|休息|吃|米线|健身|演唱会|盲盒|POP/.test(text)){
    if(role==='suki')return pick(['我喜欢米线，你想吃点什么？','去米线店坐会儿也不错。'],seed);
    if(role==='kay')return pick(['休息一下也不错，要不要来杯咖啡？','我刚想去健身，你呢？'],seed);
    if(role==='jilly')return pick(['休息一下也好，最近有想看的演唱会吗？','可以啊，先歇一会儿。'],seed);
    if(role==='cora'||role==='amber')return pick(['可以啊，要不要下楼逛逛？','休息一下也不错，你想吃点什么？'],seed);
    return pick(['休息一下也不错，你想吃点什么？','可以啊，先歇一会儿。'],seed);
  }

  if(p.confirmed&&p.distilled.quotes.length){
    const plain=p.distilled.quotes.filter(quote=>!/^\[/.test(quote));
    const quote=pick(plain.length?plain:p.distilled.quotes,seed);
    if(quote)return quote.replace(/^\[(办公|碰面|运动)\]\s*/,'').slice(0,200);
  }

  if(p.distilled.likes.length&&Math.abs(seed.length%5)===0){
    const like=pick(p.distilled.likes,seed);
    if(like)return `说到这个，我比较在意${like}。`;
  }

  return pick(['我听到了，你接着说。','嗯，我在听。','好，你继续说。'],seed);
}
