import { apiUrl } from '../base';
import Phaser from 'phaser';
import { MultiplayerBridge } from './bridge';
import { playerInventory,type ItemName } from '../player-inventory';
import { roles,type Role,type User,type World,type Message,type Player } from './types';
import './social.css';
import {WorldClient} from './world-client';
import {setupLifeUI} from './life-ui';
import {setupNPCUI} from './npc-ui';
import {setupNavigation} from '../room-navigation';
import {dockPrompt} from '../hud';
import {PartyPresence,mergePartyPlayers} from './party-client';
const title=(role:string)=>role[0].toUpperCase()+role.slice(1);
const meetPlaces={rest:'休息室',arcade:'娱乐室',dance:'舞室',gym:'健身房'} as const;
type MeetPlace=keyof typeof meetPlaces;
type Reply={user?:User|null;self?:User;roster?:World['roster'];messages?:Message[]};
export async function api<T=Reply>(path:string,input?:unknown):Promise<T>{let res:Response;try{res=await fetch(apiUrl(path),{method:input===undefined?'GET':'POST',headers:input===undefined?{}:{'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)});}catch{window.dispatchEvent(new Event('hutong:connection-lost'));throw new Error('连接中，请稍后重试');}let data:any=null;try{data=await res.json();}catch{window.dispatchEvent(new Event('hutong:connection-lost'));throw Object.assign(new Error(res.ok?'联机服务响应异常':'请求失败'),{status:res.status});}if(!res.ok)throw Object.assign(new Error(data?.error||'请求失败'),{status:res.status});return data;}

export function startSocial(game:Phaser.Game){
  const bridge=new MultiplayerBridge(game),client=crypto.randomUUID();
  let user:User|null=null,world:World|null=null,events:EventSource|null=null,peer:Role|null=null,authMode='login',busy=false,sending=false,connected=false,lastSent='',lastRoom='',initializedRole:string|null=null,historyEpoch=0,handSynced=false;
  let lastChatContext:Role|null=null,nearRole:Role|null=null,emoting=false;
  const messages=new Map<number,Message>(),bubbles=new Map<Role,{element:HTMLElement;expires:number;scene:string}>(),unread=new Map<Role,number>();
  document.body.classList.add('game-fullscreen');
  const root=document.createElement('div');root.id='social-ui';root.innerHTML=`
    <nav id="game-tools" aria-label="游戏操作"><button id="room-open">地图</button><button id="people-open">人物</button><button id="chat-open">聊天</button><button id="settings-open">设置</button><span id="connection-state" role="status"></span></nav>
    <dialog id="settings-dialog" class="social-dialog"><div class="panel-heading"><h2>设置</h2><button data-close="settings-dialog">关闭</button></div><div class="settings-actions"><button id="account-open">登录 / 领取角色</button><button id="collection-open">收藏册</button><button id="fullscreen-toggle">全屏</button><button id="details-open" hidden>调试操作</button></div></dialog>
    <section id="people-panel" class="social-panel" hidden><div class="panel-heading"><strong>人物</strong><button data-close="people-panel">关闭</button></div><div id="people-list"></div><button id="take-control" hidden>在这个窗口接管</button></section>
    <section id="chat-panel" class="social-panel" hidden><div class="panel-heading"><strong id="chat-title">当前场景</strong><button data-close="chat-panel">关闭</button></div><button id="chat-room">场景聊天</button><div id="chat-history" role="log" aria-live="polite"></div><form id="chat-form"><label class="sr-only" for="chat-input">消息</label><input id="chat-input" maxlength="200" placeholder="Enter 发送" autocomplete="off"/><button>发送</button></form></section>
    <div id="near-social" hidden><span id="near-label"></span><button data-near="greet" type="button">招呼</button><button data-near="gift" type="button">赠送</button><button data-near="chat" type="button">私聊</button><button data-near="invite" type="button">邀约</button><button data-near="wave" type="button" title="挥手">👋</button><button data-near="cheer" type="button" title="加油">🙌</button><button data-near="bow" type="button" title="点头">🙇</button></div>
    <dialog id="account-dialog" class="social-dialog"><div class="account-wall"><h1 class="account-wordmark">赛博胡同</h1><div class="panel-heading"><h2 id="account-title">登录</h2><button data-close="account-dialog">关闭</button></div><nav id="account-tabs" aria-label="账号操作"><button id="account-login" type="button" aria-current="true">登录</button><button id="account-register" type="button">注册</button></nav><form id="account-form"><label>英文名 / 用户名<input id="account-name" list="account-names" autocomplete="username" minlength="2" maxlength="24" required/><datalist id="account-names">${roles.map(role=>`<option value="${title(role)}"></option>`).join('')}</datalist></label><label id="invite-label" hidden>领取码<input id="account-invite" autocomplete="off"/></label><label>密码<input id="account-password" type="password" autocomplete="current-password" minlength="10" maxlength="128" required/></label><label id="confirm-label" hidden>确认密码<input id="account-confirm" type="password" autocomplete="new-password" minlength="10" maxlength="128"/></label><button id="account-submit">登录</button><button id="account-mode" type="button" hidden>注册新账号</button></form><div id="claim-section" hidden><div id="claim-roles"></div></div><div id="account-session" hidden><p id="account-summary"></p><button id="logout">退出账号</button></div><p id="account-error" role="alert"></p></div></dialog>
    <div id="speech-layer" aria-hidden="true"></div><p id="game-notice" role="status" hidden></p>`;
  document.querySelector('.world')!.append(root);
  dockPrompt(document.getElementById('near-social'));
  dockPrompt(document.getElementById('game-notice'));
  requestAnimationFrame(()=>game.scale.refresh());
  const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const applySelf=(self:User|null|undefined)=>{
    if(!self||(user&&self.id===user.id&&self.revision<user.revision))return false;
    const newer=!user||self.id!==user.id||self.revision>user.revision;
    const applyHand=newer||!handSynced;
    if(applyHand){
      user=self;bridge.user=self;handSynced=true;
      playerInventory.hand=self.hand as ItemName|null;playerInventory.noodleSeasoning=self.seasoning??[];
    }else{
      user={...self,hand:playerInventory.hand,seasoning:playerInventory.noodleSeasoning};bridge.user=user;
    }
    $('social-ui').dataset.revision=String(user.revision);return true;
  };
  const focus=()=>document.querySelector<HTMLElement>('.world')!.focus();
  let noticeTimer:ReturnType<typeof setTimeout>;
  function notice(text:string){$('game-notice').textContent=text;$('game-notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('game-notice').hidden=true,4000);}
  function close(id:string){const el=$(id);if(el instanceof HTMLDialogElement)el.close();else el.hidden=true;focus();}
  function updateBadges(){const total=[...unread.values()].reduce((n,v)=>n+v,0);for(const id of ['chat-open','people-open'] as const){const button=$(id);button.dataset.badge=total?String(total>9?'9+':total):'';button.setAttribute('aria-label',total?`${button.textContent}，${total} 条未读私聊`:button.textContent||'');}}
  const shared=new WorldClient(bridge,api,()=>publishPresence(true),client,notice);
  setupNavigation(bridge,api,()=>publishPresence(true),client,notice);
  const lifeUI=setupLifeUI(bridge,api,()=>publishPresence(true),client,notice);
  const npcUI=setupNPCUI(bridge,api,()=>publishPresence(true),client,notice);
  const applyPartyView=()=>{
    if(!world)return;
    if(party.enabled&&party.connected){
      bridge.players=mergePartyPlayers(party.list(),world.players,user?.role);
      bridge.onlineRoles=party.online().map(p=>p.role);
      world.online=party.online();
    }else{
      bridge.players=world.players;
      bridge.onlineRoles=world.online.map(p=>p.role);
    }
    people();
  };
  const party=new PartyPresence(bridge,client,api,()=>applyPartyView(),notice);
  $('settings-open').onclick=()=>($('settings-dialog') as HTMLDialogElement).showModal();
  $('collection-open').onclick=()=>{close('settings-dialog');window.dispatchEvent(new Event('hutong:open-collection'));};
  root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close!));
  let accountSignature='',peopleSignature='';
  function hardLogout(text?:string){
    events?.close();events=null;party.disconnect();lifeUI.reset();npcUI.reset();shared.reset();
    user=null;world=null;bridge.user=null;bridge.players=[];bridge.onlineRoles=[];bridge.controller=true;bridge.connected=false;bridge.clearTransition();
    playerInventory.hand=null;initializedRole=null;connected=false;handSynced=false;$('social-ui').dataset.revision='-1';
    for(const b of bubbles.values())b.element.remove();bubbles.clear();messages.clear();unread.clear();updateBadges();
    nearRole=null;peer=null;lastChatContext=null;$('near-social').hidden=true;
    $('connection-state').textContent='';if(bridge.active?.input.keyboard)bridge.active.input.keyboard.enabled=true;
    accountSignature='';peopleSignature='';if(text)notice(text);account();people();
  }
  function account(){
    const signature=JSON.stringify([user?.username,user?.role,authMode,world?.roster]);if(signature===accountSignature)return;accountSignature=signature;
    $('account-title').textContent=user?'你的角色':authMode==='login'?'登录':'注册';$('account-form').hidden=!!user;
    $('account-dialog').dataset.entry=String(!user);$('account-tabs').hidden=!!user;
    $('claim-section').hidden=!user||!!user.role;$('account-session').hidden=!user;
    $('account-summary').textContent=user?`${user.username} · ${user.role?title(user.role):'尚未领取角色'}`:'';
    $('account-open').textContent=user?.role?title(user.role):user?'领取角色':'登录 / 领取角色';
    $('claim-roles').replaceChildren();for(const entry of world?.roster||[]){const button=document.createElement('button');button.textContent=title(entry.role)+(entry.claimed?' · 已领取':'');button.disabled=entry.claimed;button.onclick=async()=>{try{const res=await api('claim',{role:entry.role});user=res.user!;bridge.user=user;initializedRole=null;connect();account();close('account-dialog');notice(`已领取 ${title(entry.role)}`);}catch(e){$('account-error').textContent=(e as Error).message;await refresh();account();}};$('claim-roles').append(button);}
  }
  async function refresh(){const result=await api('me');user=result.user||null;bridge.user=user;if(!world)world={self:user!,controller:true,players:[],online:[],roster:result.roster||[]};else world.roster=result.roster||world.roster;account();people();}
  function connect(){events?.close();if(!user)return;events=new EventSource(apiUrl('events?client='+encodeURIComponent(client)));
    events.addEventListener('world',e=>{let next:World;try{next=JSON.parse((e as MessageEvent).data) as World;}catch{notice('联机数据异常');return;}const previousController=bridge.controller;world=next;applySelf(next.self);bridge.controller=next.controller;if(previousController&&!next.controller)shared.pause();if(next.controller&&!previousController){bridge.stand();const self=next.players.find(p=>p.role===user?.role);if(self)bridge.apply(self);if(party.enabled)void party.connect();}bridge.connected=true;connected=true;
      if(user?.role&&initializedRole!==user.role){const self=next.players.find(p=>p.role===user!.role);if(self){bridge.pendingSpawn=self;initializedRole=user.role;}if(party.enabled){party.reopen();void party.connect();}}
      const partyHint=party.enabled?(party.connected?' · PartyKit':' · PartyKit…'):'';
      $('connection-state').textContent=(next.controller?'已连接':'在另一个窗口操作')+partyHint;$('take-control').hidden=next.controller;
      bridge.claimedRoles=next.roster.filter(p=>p.claimed).map(p=>p.role);account();applyPartyView();const keyboard=bridge.active?.input.keyboard;if(keyboard)keyboard.enabled=next.controller;
      lifeUI.receive(next);shared.receive(next);npcUI.receive(next);bridge.npcEpoch=(next as any).npcEpoch??0;
    });
    events.addEventListener('message',e=>{try{receive(JSON.parse((e as MessageEvent).data));}catch{notice('联机消息异常');}});
    events.addEventListener('logout',()=>{hardLogout('登录已结束');});
    events.onopen=()=>{connected=true;bridge.connected=true;loadHistory();if(user?.role&&party.enabled){party.reopen();void party.connect();}};events.onerror=()=>{const wasConnected=connected;connected=false;bridge.connected=false;if(wasConnected)shared.pause();$('connection-state').textContent='连接中…';};
  }
  function playPlaceFor(role:Role):MeetPlace{const online=world?.online.find(p=>p.role===role)||world?.players.find(p=>p.role===role);const scene=online?.scene;return scene&&scene in meetPlaces?scene as MeetPlace:'arcade';}
  async function invite(role:Role,place:MeetPlace){if(!user?.role){showAccount();return;}try{await publishPresence(true);await api('invite',{peer:role,place,client,requestId:crypto.randomUUID()});notice(`已邀请一起去${meetPlaces[place]}`);}catch(e){notice((e as Error).message);}}
  function people(){const signature=JSON.stringify([user?.role,world?.online,playerInventory.hand,[...unread.keys()]]);if(signature===peopleSignature)return;peopleSignature=signature;const list=$('people-list');list.replaceChildren();for(const role of roles){
    const row=document.createElement('div');row.className='person-row';const text=document.createElement('span'),online=world?.online.find(p=>p.role===role),pending=unread.get(role)||0;text.textContent=`${title(role)}${role===user?.role?' · 你':online?' · 在线':' · 离线'}${pending?` · ${pending} 未读`:''}`;row.append(text);
    if(role!==user?.role){const chat=document.createElement('button');chat.textContent=pending?'私聊 · 新':'私聊';chat.onclick=()=>openChat(role);row.append(chat);
      if(online||world?.roster.find(p=>p.role===role)?.claimed){const rest=document.createElement('button');rest.textContent='一起休息';rest.onclick=()=>void invite(role,'rest');row.append(rest);const play=document.createElement('button');const place=playPlaceFor(role);play.textContent=`去${meetPlaces[place]}`;play.onclick=()=>void invite(role,place);row.append(play);const greet=document.createElement('button');greet.textContent='招呼';greet.onclick=()=>interact(role,'greet');const gift=document.createElement('button');gift.textContent='赠送';gift.disabled=!playerInventory.hand;gift.onclick=()=>interact(role,'gift');row.append(greet,gift);}}
    list.append(row);
  }}
  async function interact(role:Role,action:string){if(!user?.role){showAccount();return;}try{await publishPresence(true);await api('interact',{peer:role,action,client,revision:user.revision,requestId:crypto.randomUUID()});if(action==='gift')notice('正在等对方收下，物品暂时保留在手中');}catch(e){notice((e as Error).message);}}
  async function emote(kind:'wave'|'cheer'|'bow'){if(!user?.role||!bridge.controller||emoting)return;emoting=true;try{await api('interact',{action:'emote',emote:kind,client,requestId:crypto.randomUUID()});}catch(e){notice((e as Error).message);}finally{emoting=false;}}
  function showAccount(){close('settings-dialog');account();$('account-error').textContent='';$('account-dialog') instanceof HTMLDialogElement&&($('account-dialog') as HTMLDialogElement).showModal();}
  function openChat(role:Role|null){if(!user?.role){showAccount();return;}const changed=peer!==role;peer=role;lastChatContext=role;$('chat-panel').hidden=false;$('people-panel').hidden=true;$('chat-title').textContent=role?`与 ${title(role)} 私聊`:'当前场景';if(role){unread.delete(role);updateBadges();people();}if(changed||!messages.size){if(changed)messages.clear();renderChat();loadHistory();}$('chat-input').focus();}
  function relevant(m:Message){return peer?(m.sender===user?.role&&m.recipient===peer)||(m.sender===peer&&m.recipient===user?.role):!m.recipient&&m.scene===bridge.state()?.scene;}
  function receive(m:Message){if(messages.has(m.seq))return;if(relevant(m)){messages.set(m.seq,m);renderChat();}if(!m.recipient){const el=document.createElement('div');el.className='speech';el.textContent=m.body;bubbles.get(m.sender)?.element.remove();$('speech-layer').append(el);bubbles.set(m.sender,{element:el,expires:performance.now()+5500,scene:m.scene});}else if(m.recipient===user?.role){const viewing=!$('chat-panel').hidden&&peer===m.sender;if(!viewing){unread.set(m.sender,(unread.get(m.sender)||0)+1);updateBadges();people();}if($('chat-panel').hidden)notice(`${title(m.sender)} 发来了私聊`);}}
  function renderChat(){const history=$('chat-history');history.replaceChildren();for(const m of [...messages.values()].sort((a,b)=>a.seq-b.seq).slice(-60)){const line=document.createElement('p'),speaker=document.createElement('strong');speaker.textContent=title(m.sender)+(m.npc?' · 角色回复':'')+'：';line.append(speaker,document.createTextNode(m.body));history.append(line);}history.scrollTop=history.scrollHeight;}
  async function loadHistory(){if(!user?.role)return;const epoch=++historyEpoch;try{const result=await api('history'+(peer?'?peer='+peer:''));if(epoch!==historyEpoch)return;messages.clear();for(const m of result.messages||[])if(relevant(m))messages.set(m.seq,m);renderChat();}catch(e){notice((e as Error).message);}}
  function setAuthMode(mode:string){if(busy)return;authMode=mode;$('invite-label').hidden=mode!=='register';$('confirm-label').hidden=mode!=='register';($('account-invite') as HTMLInputElement).required=mode==='register';($('account-confirm') as HTMLInputElement).required=mode==='register';$('account-submit').textContent=mode==='login'?'登录':'注册';($('account-password') as HTMLInputElement).autocomplete=mode==='login'?'current-password':'new-password';for(const id of ['login','register']){const button=$('account-'+id);if(id===mode)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');}$('account-error').textContent='';account();}
  $('account-open').onclick=showAccount;$('account-mode').onclick=()=>setAuthMode(authMode==='login'?'register':'login');$('account-login').onclick=()=>setAuthMode('login');$('account-register').onclick=()=>setAuthMode('register');
  $('account-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const password=($('account-password') as HTMLInputElement).value;if(authMode==='register'&&password!==($('account-confirm') as HTMLInputElement).value){$('account-error').textContent='两次密码不一致';return;}const name=($('account-name') as HTMLInputElement).value.trim(),role=roles.find(r=>r===name.toLowerCase());if(authMode==='register'&&!role){$('account-error').textContent='请填写八位成员之一的英文名';return;}busy=true;($('account-submit') as HTMLButtonElement).disabled=true;$('account-error').textContent='';try{const result=await api(authMode,{username:role??name,password,invite:($('account-invite') as HTMLInputElement).value,role:authMode==='register'?role:undefined});user=result.user!;bridge.user=user;($('account-password') as HTMLInputElement).value='';($('account-confirm') as HTMLInputElement).value='';world={self:user,controller:true,players:[],online:[],roster:result.roster||[]};initializedRole=null;account();connect();if(user.role)close('account-dialog');}catch(e){$('account-error').textContent=(e as Error).message;}finally{busy=false;($('account-submit') as HTMLButtonElement).disabled=false;}};
  $('logout').onclick=async()=>{try{await api('logout',{});hardLogout();await refresh();}catch(e){notice((e as Error).message);}};
  $('people-open').onclick=()=>{$('people-panel').hidden=!$('people-panel').hidden;if(!$('people-panel').hidden)$('chat-panel').hidden=true;people();};$('chat-open').onclick=()=>openChat(lastChatContext);$('chat-room').onclick=()=>openChat(null);
  $('chat-form').onsubmit=async e=>{e.preventDefault();if(!user?.role){showAccount();return;}if(sending)return;const input=$('chat-input') as HTMLInputElement,text=input.value.trim();if(!text)return;sending=true;try{await api('chat',{text,peer,requestId:crypto.randomUUID()});input.value='';}catch(e){notice((e as Error).message);}finally{sending=false;}};
  $('take-control').onclick=async()=>{try{await api('control',{client});if(party.enabled){party.reopen();void party.connect();}notice('已接管');}catch(e){notice((e as Error).message);}};
  $('details-open').hidden=!(import.meta as any).env.DEV||!location.search.includes('debug=1');$('details-open').onclick=()=>document.body.classList.toggle('show-game-details');
  $('fullscreen-toggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('当前窗口不支持切换全屏');}};
  $('near-social').onclick=e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-near]');if(!button||!nearRole)return;const action=button.dataset.near!;if(action==='chat')openChat(nearRole);else if(action==='invite')void invite(nearRole,playPlaceFor(nearRole));else if(action==='greet'||action==='gift')void interact(nearRole,action);else if(action==='wave'||action==='cheer'||action==='bow')void emote(action);};
  window.addEventListener('keydown',e=>{
    const worldFocused=document.activeElement===document.querySelector('.world');
    if(e.key==='Enter'&&worldFocused){e.preventDefault();openChat(lastChatContext);}
    if(worldFocused&&bridge.controller&&user?.role&&!document.querySelector('dialog[open]')&&['Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3'].includes(e.code)){e.preventDefault();void emote(e.code.includes('1')?'wave':e.code.includes('2')?'cheer':'bow');}
    if(e.key==='Escape'&&!($('account-dialog') as HTMLDialogElement).open){$('people-panel').hidden=true;$('chat-panel').hidden=true;document.body.classList.remove('show-scene-picker','show-game-details');}
    if(user?.role&&!bridge.controller&&[document.querySelector('.world'),game.canvas].includes(document.activeElement)&&/^(Arrow|Key[WASDEFV]|Space|Escape)/.test(e.code)){e.stopImmediatePropagation();e.preventDefault();}
  },true);
  async function publishPresence(force=false){if(force&&sendingPresence){const deadline=Date.now()+3000;while(sendingPresence&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));if(sendingPresence)throw new Error('连接恢复后再操作');}if(!user?.role||!connected||!bridge.controller||sendingPresence)return;const state=bridge.state();if(!state)return;party.publish(state,force);const signature=JSON.stringify(state);if(!force&&signature===lastSent)return;sendingPresence=true;try{const result=await api<{self:User;player:Player}>('presence',{...state,client});if(user?.id!==result.self.id)return;applySelf(result.self);lastSent=signature;}catch(e){const err=e as Error&{status?:number};if(err.status===409){bridge.stand();const self=world?.players.find(p=>p.role===user?.role);if(self)bridge.apply(self);notice(err.message);}else if(err.status===401){hardLogout('登录已结束');}else if(err.status!==429)notice(err.message);}finally{sendingPresence=false;}}
  let sendingPresence=false,lastPulse=0,lastPartyMove=0;
  function livePlayers(){return (party.enabled&&party.connected?party.list():null)||world?.players||[];}
  function updateNear(){const hud=$('near-social'),state=bridge.state();if(!user?.role||!state||!bridge.controller){nearRole=null;hud.hidden=true;return;}let best:Role|null=null,bestDist=55;for(const p of livePlayers()){if(p.role===user.role||p.scene!==state.scene)continue;const d=Math.hypot(p.x-state.x,p.y-state.y);if(d<=bestDist){bestDist=d;best=p.role;}}nearRole=best;hud.hidden=!best;if(best){$('near-label').textContent=title(best);($('near-social').querySelector('[data-near="gift"]') as HTMLButtonElement).disabled=!playerInventory.hand;const inviteBtn=$('near-social').querySelector('[data-near="invite"]') as HTMLButtonElement;inviteBtn.textContent=`去${meetPlaces[playPlaceFor(best)]}`;}
  }
  setInterval(()=>{const pulse=performance.now()-lastPulse>15000;if(pulse)lastPulse=performance.now();void publishPresence(pulse).catch(()=>{});const state=bridge.state();if(party.enabled&&state&&bridge.controller&&performance.now()-lastPartyMove>80){lastPartyMove=performance.now();party.publish(state);}if(party.enabled&&pulse)void party.refreshIfNeeded().catch(()=>{});if(state&&state.scene!==lastRoom){lastRoom=state.scene;lastSent='';if(!peer){messages.clear();loadHistory();}document.body.classList.remove('show-scene-picker');}updateNear();const rect=game.canvas.getBoundingClientRect();for(const [role,b] of bubbles){if(b.expires<performance.now()){b.element.remove();bubbles.delete(role);continue;}const p=role===user?.role?state:livePlayers().find(p=>p.role===role);if(!p||p.scene!==state?.scene||b.scene!==state.scene){b.element.hidden=true;continue;}const screen=bridge.screen(p);b.element.hidden=false;b.element.style.left=Math.max(90,Math.min(innerWidth-90,rect.left+screen.x/640*rect.width))+'px';b.element.style.top=Math.max(62,rect.top+(screen.y-65)/360*rect.height)+'px';}},100);
  refresh().then(()=>{if(user)connect();else showAccount();}).catch(()=>{$('connection-state').textContent='';showAccount();$('account-error').textContent='联机服务暂未连接，请稍后重试';});
  window.addEventListener('hutong:hand-changed',()=>{people();});
  window.addEventListener('pagehide',()=>{events?.close();party.disconnect();});
  const connectionLost=()=>{const wasConnected=connected;connected=false;bridge.connected=false;if(wasConnected)shared.pause();$('connection-state').textContent='连接中…';};
  window.addEventListener('offline',()=>{connectionLost();events?.close();party.disconnect();});
  window.addEventListener('online',()=>{if(user){party.reopen();connect();}});
  window.addEventListener('hutong:connection-lost',()=>{connectionLost();if(user&&navigator.onLine){party.reopen();connect();}});
  (window as unknown as Record<string,unknown>).__socialPreview={getState:()=>({user:user?{role:user.role,username:user.username,revision:user.revision,hand:user.hand}:null,connected,controller:bridge.controller,players:bridge.players,party:party.enabled?{host:party.host(),connected:party.connected,players:party.list()}:null,room:bridge.state()?.scene,peer,client,nearRole,unread:[...unread.entries()]}),bridge};
  return bridge;
}
