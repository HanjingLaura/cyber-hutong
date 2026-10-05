import {roomArt} from './room-art';
import rooms from '../shared/rooms.json';
import {project} from './layout';
import type {MultiplayerBridge} from './multiplayer/bridge';
type RoomKey=keyof typeof rooms;
export function setupNavigation(bridge:MultiplayerBridge,request:(path:string,input?:any)=>Promise<any>,publish:()=>Promise<void>,client:string,notice:(text:string)=>void){
 const dialog=document.createElement('dialog');dialog.id='location-map';dialog.className='social-dialog location-map';
 dialog.innerHTML='<div class="panel-heading"><h2>地点</h2><button type="button" data-cancel>关闭 · Esc</button></div><p data-current></p><div data-places></div><p data-error role="status"></p><button type="button" data-enter disabled>进入</button>';
 document.querySelector('.world')!.append(dialog);let selected:RoomKey|null=null,busy=false;let mark:Phaser.GameObjects.Graphics|undefined,markScene:Phaser.Scene|undefined;
 const exitNear=()=>{const p=bridge.state(),r=p&&rooms[p.scene as RoomKey];return !!p&&!!r&&!p.seat&&Math.hypot(p.x-r.exit[0],p.y-r.exit[1])<28;};
 let exitHint=false,savedGuide='';
 const open=()=>{if(busy)return;selected=null;const p=bridge.state();dialog.querySelector('[data-current]')!.textContent='当前位置：'+(p?rooms[p.scene as RoomKey].name:'');const list=dialog.querySelector('[data-places]')!;list.replaceChildren();
  for(const group of ['办公','休闲','出行']){const section=document.createElement('section'),label=document.createElement('strong');label.textContent=group;section.append(label);for(const [key,r]of Object.entries(rooms).filter(([,r])=>r.group===group)){const b=document.createElement('button');b.type='button';const img=document.createElement('img');img.src=roomArt(key);img.alt='';img.loading='lazy';const name=document.createElement('span');name.textContent=r.name;b.append(img,name);b.disabled=p?.scene===key;b.dataset.place=key;b.onclick=()=>{selected=key as RoomKey;list.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));(dialog.querySelector('[data-enter]') as HTMLButtonElement).disabled=!exitNear();};section.append(b);}list.append(section);}
  dialog.querySelector('[data-error]')!.textContent=exitNear()?'':'走到地上的出口标记，按 E 前往其他地点。';(dialog.querySelector('[data-enter]') as HTMLButtonElement).disabled=true;bridge.active?.input.keyboard?.resetKeys();dialog.showModal();
 };
 dialog.querySelector('[data-cancel]')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>document.querySelector<HTMLElement>('.world')!.focus());
 const changeScene=async(key:string)=>{const target=key==='hutong'?'culture':key;window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:target}));const scene=bridge.game.scene.getScene(key);
  const deadline=performance.now()+12000;while(!scene.sys.isActive()||!(scene as any).actor){if(performance.now()>deadline)throw new Error('地点载入失败，请重试');await new Promise(resolve=>setTimeout(resolve,50));}
  return scene;
 };
 const enter=async()=>{if(!selected||busy)return;if(!exitNear()||document.querySelector('dialog[open]:not(#location-map)')){notice('先结束互动，再走到出口');return;}
  const before=bridge.state()!,target=selected;busy=true;bridge.transitioning=true;let committed=false;(dialog.querySelector('[data-enter]') as HTMLButtonElement).disabled=true;
  try{
   if(bridge.user?.role&&(!bridge.connected||!bridge.controller))throw new Error('连接恢复后再切换地点');
   // Prepare textures before moving the server-owned player or releasing its seat.
   const destination=bridge.game.scene.getScene(target);
   if(!destination.sys.isSleeping()&&!destination.sys.isActive()){await new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);destination.events.off('create',created);destination.load.off('loaderror',failed);};const failed=()=>{cleanup();bridge.game.scene.stop(target);reject(new Error('素材加载失败，请重试'));};const created=()=>{cleanup();resolve();};const timer=setTimeout(()=>{cleanup();bridge.game.scene.stop(target);reject(new Error('素材加载超时'));},12000);destination.events.once('create',created);destination.load.once('loaderror',failed);bridge.game.scene.run(target);});bridge.game.scene.sleep(target);}
   let player={...before,scene:target,x:rooms[target].exit[0],y:rooms[target].exit[1],seat:null,facing:0};
   if(bridge.user?.role){await publish();const result=await request('transition',{target,client});player=result.player;committed=true;bridge.players=bridge.players.filter(p=>p.role!==bridge.user?.role);bridge.players.push(player);}
   await changeScene(target);bridge.apply(player);dialog.close();document.querySelector<HTMLElement>('.world')!.focus();
  }catch(e){notice((e as Error).message);const current=committed?bridge.players.find(p=>p.role===bridge.user?.role):before;if(current){await changeScene(current.scene);bridge.apply(current);}}finally{busy=false;bridge.transitioning=false;(dialog.querySelector('[data-enter]') as HTMLButtonElement).disabled=!selected||!exitNear();}
 };
 dialog.querySelector('[data-enter]')!.addEventListener('click',()=>void enter());
 document.querySelector('#room-open')!.addEventListener('click',open);
 const key=(e:KeyboardEvent)=>{if(e.code==='KeyE'&&!e.repeat&&!dialog.open&&!document.querySelector('dialog[open]')&&document.activeElement===document.querySelector('.world')&&exitNear()){e.preventDefault();e.stopImmediatePropagation();open();}};
 window.addEventListener('keydown',key,true);
 bridge.game.events.on('poststep',()=>{const s=bridge.active,p=bridge.state();if(!s||!p)return;
  if(markScene!==s){mark?.destroy();markScene=s;mark=s.add.graphics().setDepth(0);exitHint=false;savedGuide='';}
  const r=rooms[p.scene as RoomKey],point=project({x:r.exit[0],y:r.exit[1]},['hutong','hawaii'].includes(p.scene)&&!!s.reverse);mark!.clear().lineStyle(1,0xc3c6ac,.7).strokeRect(point.x-12,point.y-5,24,10).fillStyle(0xc3c6ac,.8).fillRect(point.x-3,point.y-1,6,2);
  const near=exitNear()&&!dialog.open&&!document.querySelector('dialog[open]'),guide=document.querySelector('#guide-action');
  if(guide){if(near){if(!exitHint){savedGuide=guide.textContent||'';exitHint=true;}guide.textContent='E · 出门';}else if(exitHint){exitHint=false;guide.textContent=savedGuide;}}
 });
 return{open,exitNear};
}
