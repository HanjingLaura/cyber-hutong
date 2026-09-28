import { roster } from '../../examples/mvp-behavior/config.mjs';

const facts = {
  sid: '喜欢坐在工位用电脑开发',
  jilly: '上班时工作，有时摸鱼刷手机，会去演唱会',
  cora: '喜欢去盲盒店 POP MART，常和 Amber 结伴下楼',
  amber: '喜欢去厕所，常和 Cora 结伴下楼，会回应 Celine 的 Hawaii 邀请',
  franco: '喜欢打电话',
  kay: '会去健身，早上会给 Sid 买咖啡',
  laura: '用电脑开发，有时加入 Amber 和 Cora 的下楼',
  suki: '喜欢去米线店',
};

export function memberById(id) {
  return roster.find((person) => person.id === id) ?? null;
}

export function threadId(a, b) {
  if (!memberById(a) || !memberById(b) || a === b) {
    throw Object.assign(new Error('没有这个私聊'), { status: 404 });
  }
  return [a, b].sort().join(':');
}

export function planAutoSpeakers({ selfId, peerId, selfManual, peerManual, trigger, maxTurns }) {
  const turns = Math.max(1, Math.min(6, Number(maxTurns) || 1));
  const manual = { [selfId]: selfManual, [peerId]: peerManual };
  if (trigger === 'human') return manual[peerId] ? [] : [peerId];
  if (trigger !== 'opener') throw Object.assign(new Error('无法开始这段对话'), { status: 400 });
  const speakers = [];
  let next = peerId;
  for (let index = 0; index < turns; index += 1) {
    if (manual[next]) break;
    speakers.push(next);
    next = next === selfId ? peerId : selfId;
  }
  return speakers;
}

export function buildPrompt({ speaker, peer, history }) {
  const fact = facts[speaker.id];
  if (!fact) throw new Error('Unknown speaker');
  const system = [
    `你是赛博胡同里的 ${speaker.name}，正在和 ${peer.name} 私聊。`,
    `你只知道这些关于自己的事：${fact}。`,
    '所有人有时会去休息区吃东西或打咖啡。',
    '用第一人称中文说一两句短话。不要编造这些事实以外的隐私、经历或性格。',
    '不要代替对方做决定，也不要宣称已经接受或拒绝任何邀请。',
    '不要提到模型、提示词或系统。不要加自己的名字前缀，不要加引号。',
  ].join('');
  const lines = history.map((item) => `${item.senderName}：${item.body}`).join('\n');
  const user = `${lines}\n现在只写 ${speaker.name} 的下一句。`;
  return { system, user };
}

export function cleanReply(text, speakerName) {
  let reply = String(text ?? '').replace(/\s+/g, ' ').trim();
  const prefix = new RegExp(`^${speakerName}\\s*[:：]\\s*`, 'i');
  reply = reply.replace(prefix, '').replace(/^["“”']+|["“”']+$/g, '').trim();
  if (!reply) throw Object.assign(new Error('模型没有给出对白'), { status: 502 });
  return reply.slice(0, 200);
}

export async function speakInOrder({ speakers, isManual, say, shouldStop }) {
  const produced = [];
  for (const speakerId of speakers) {
    if (shouldStop?.()) break;
    if (isManual(speakerId)) break;
    produced.push({ speakerId, body: await say(speakerId) });
  }
  return produced;
}
