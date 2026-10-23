import {roomArt} from './room-art';
import rooms from '../shared/rooms.json';
import {project} from './layout';
import {warmRoom,prepareRoom} from './asset-warmup';
import {setExitGuide} from './hud';
import type {MultiplayerBridge} from './multiplayer/bridge';
type RoomKey=keyof typeof rooms;
export function setupNavigation(bridge:MultiplayerBridge,request:(path:string,input?:any)=>Promise<any>,publish:()=>Promise<string|undefined>,client:string,notice:(text:string)=>void){
 const dialog=document.createElement('dialog');dialog.id='location-map';dialog.className='social-dialog location-map';
 dialog.innerHTML='<div class="panel-heading"><h2 id="location-title">地点</h2><button type="button" data-cancel>关闭</button></div><p data-current></p><p data-error role="status"></p><button type="button" data-find-exit hidden>出口方向</button><div data-places></div>';
 dialog.setAttribute('aria-labelledby','location-title');
 document.querySelector('.world')!.append(dialog);let selected:RoomKey|null=null,busy=false;let mark:Phaser.GameObjects.Graphics|undefined,markScene:Phaser.Scene|undefined;
 let preparing:AbortController|undefined;
 const quickSetting=document.querySelector<HTMLInputElement>('#quick-travel')!;
 try{quickSetting.checked=localStorage.getItem('hutong:quick-travel')==='true';}catch{}
 quickSetting.addEventListener('change',()=>{try{localStorage.setItem('hutong:quick-travel',String(quickSetting.checked));}catch{}});
 const canTravel=()=>{const p=bridge.state();return !!p&&!p.seat&&['walk',undefined].includes(p.activity)&&(quickSetting.checked||exitNear());};
 const exitNear=()=>{const p=bridge.state(),r=p&&rooms[p.scene as RoomKey];return !!p&&!!r&&!p.seat&&Math.hypot(p.x-r.exit[0],p.y-r.exit[1])<28&&!(bridge.active as any)?.prefersInteraction?.();};
 const findExit=()=>{dialog.close();const p=bridge.state(),r=p&&rooms[p.scene as RoomKey];if(!p||!r)return;const point=project({x:r.exit[0],y:r.exit[1]},['hutong','hawaii'].includes(p.scene)&&!!bridge.active?.reverse);const direction=point.x<213?'左侧':point.x>427?'右侧':point.y>240?'下方':point.y<120?'上方':'中间';notice(`出口在画面${direction}，走到那里后再互动`);};
 dialog.querySelector('[data-find-exit]')!.addEventListener('click',findExit);
 const syncSelection=()=>{
  dialog.querySelectorAll<HTMLButtonElement>('[data-place]').forEach(button=>{
   const on=button.dataset.place===selected;
   button.setAttribute('aria-pressed',String(on));
   button.classList.toggle('is-selected',on);
   const room=rooms[button.dataset.place as RoomKey];
   button.setAttribute('aria-label',on?`进入${room.name}`:`选择${room.name}`);
   button.querySelector<HTMLElement>('.place-enter')!.hidden=!on;
  });
 };
 const open=()=>{
  if(busy)return;
  if(document.querySelector('dialog[open]:not(#location-map)'))return;
  selected=null;const p=bridge.state();
  dialog.querySelector('[data-current]')!.textContent='当前位置：'+(p?rooms[p.scene as RoomKey].name:'');
  dialog.querySelector('[data-error]')!.textContent=quickSetting.checked?'点选地点，再点图上的“进入”。请先结束当前互动。':exitNear()?'点选地点，再点图上的“进入”。':'可以查看所有地点。切换地点前，请先走到当前房间的出口。';
  (dialog.querySelector('[data-find-exit]') as HTMLButtonElement).hidden=quickSetting.checked||exitNear();
  const list=dialog.querySelector('[data-places]')!;list.replaceChildren();
  for(const group of ['办公','休闲','出行']){
   const section=document.createElement('section'),label=document.createElement('strong');label.textContent=group;section.append(label);
   for(const [key,r]of Object.entries(rooms).filter(([,room])=>room.group===group)){
    const b=document.createElement('button');b.type='button';b.dataset.place=key;b.disabled=p?.scene===key;
    const frame=document.createElement('span');frame.className='place-frame';
    const img=document.createElement('img');img.src=roomArt(key);img.alt='';img.loading='lazy';img.decoding='async';
    const enter=document.createElement('span');enter.className='place-enter';enter.textContent='进入';enter.hidden=true;
    frame.append(img,enter);
    const name=document.createElement('span');name.className='place-name';name.textContent=r.name;
    b.append(frame,name);
    b.onclick=()=>{
     if(b.disabled||busy)return;
     const keyPlace=key as RoomKey;
     if(selected===keyPlace){void go(keyPlace);return;}
     selected=keyPlace;syncSelection();warmRoom(keyPlace,bridge.game);
    };
    section.append(b);
   }
   list.append(section);
  }
  syncSelection();bridge.active?.input.keyboard?.resetKeys();if(!dialog.open)dialog.showModal();
 };
 dialog.addEventListener('cancel',event=>{if(busy&&!preparing)event.preventDefault();else preparing?.abort();});
 dialog.querySelector('[data-cancel]')!.addEventListener('click',()=>{if(busy&&!preparing)return;preparing?.abort();dialog.close();});dialog.addEventListener('close',()=>{preparing?.abort();selected=null;document.querySelector<HTMLElement>('.world')!.focus();});
 const changeScene=async(key:string)=>{const target=key==='hutong'?'culture':key;window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:target}));const scene=bridge.game.scene.getScene(key);
  const deadline=performance.now()+12000;while(!scene.sys.isActive()||!(scene as any).actor){if(performance.now()>deadline)throw new Error('地点载入失败，请重试');await new Promise(resolve=>setTimeout(resolve,50));}
  return scene;
 };
 const go=async(target:RoomKey)=>{
  if(busy)return;
  if(bridge.navigationRecovery){notice('位置恢复中，请稍后再操作');return;}
  if(!canTravel()){const p=bridge.state();dialog.querySelector('[data-error]')!.textContent=p?.seat||p&&!['walk',undefined].includes(p.activity)?'请先起身或结束当前互动，再进入其他地点。':'请先走到当前房间的出口，或在设置中开启“地图快捷切换”。';return;}
  if(document.querySelector('dialog[open]:not(#location-map)'))return;
  const before=bridge.state()!,preparation=new AbortController();busy=true;bridge.transitioning=true;let committed=false,submitted=false,errorMessage='';
  preparing=preparation;
  const closeButton=dialog.querySelector<HTMLButtonElement>('[data-cancel]')!;closeButton.disabled=false;
  bridge.active?.input.keyboard?.resetKeys();
  dialog.querySelector('[data-error]')!.textContent='正在载入地点…';
  dialog.querySelectorAll<HTMLButtonElement>('[data-place]').forEach(b=>b.disabled=true);
  try{
   // Confirm the source pose while decoding destination textures. Commit travel only after both succeed.
   // publish() refreshes bridge.connected (events|party) and throws 连接恢复/位置尚未确认 itself.
   if(bridge.user?.role&&!bridge.controller)throw new Error('连接恢复后再切换地点');
   // Cached textures may finish before a slow pose checkpoint. Cancellation must
   // release this wait too; a late checkpoint may confirm the source, never travel.
   let cancelWait:()=>void=()=>{},checkpoint:string|undefined;
   const cancelled=new Promise<never>((_,reject)=>{cancelWait=()=>reject(new Error('已取消地点载入'));preparation.signal.addEventListener('abort',cancelWait,{once:true});});
   try{[,checkpoint]=await Promise.race([Promise.all([prepareRoom(target,bridge.game,(done,total)=>{dialog.querySelector('[data-error]')!.textContent=`正在载入地点… ${done}/${total}`;},preparation.signal),bridge.user?.role?publish():Promise.resolve(undefined)]),cancelled]);}
   finally{preparation.signal.removeEventListener('abort',cancelWait);}
   if(preparation.signal.aborted||!dialog.open)throw new Error('已取消地点载入');
   dialog.querySelector('[data-error]')!.textContent='正在准备地点…';
   const destination=bridge.game.scene.getScene(target);
   if(!destination.sys.isSleeping()&&!destination.sys.isActive()&&!destination.sys.isPaused()){await new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);destination.events.off('create',created);destination.load.off('loaderror',failed);preparation.signal.removeEventListener('abort',cancelled);};const cancelled=()=>{cleanup();bridge.game.scene.stop(target);reject(new Error('已取消地点载入'));};const failed=()=>{cleanup();bridge.game.scene.stop(target);reject(new Error('素材加载失败，请重试'));};const created=()=>{cleanup();resolve();};const timer=setTimeout(()=>{cleanup();bridge.game.scene.stop(target);reject(new Error('素材加载超时'));},12000);destination.events.once('create',created);destination.load.once('loaderror',failed);preparation.signal.addEventListener('abort',cancelled,{once:true});bridge.game.scene.run(target);});if(destination.sys.isActive())bridge.game.scene.sleep(target);}
   if(preparation.signal.aborted||!dialog.open)throw new Error('已取消地点载入');
   preparing=undefined;closeButton.disabled=true;dialog.querySelector('[data-error]')!.textContent='正在确认位置…';
   let player={...before,scene:target,x:rooms[target].exit[0],y:rooms[target].exit[1],seat:null,facing:0};
   if(bridge.user?.role){if(!bridge.connected||!bridge.controller)throw new Error('连接恢复后再切换地点');submitted=true;const result=await request('transition',{target,client,quick:quickSetting.checked,checkpoint});player=result.player;committed=true;bridge.players=bridge.players.filter(p=>p.role!==bridge.user?.role);bridge.players.push(player);}
   await changeScene(target);bridge.apply(player);dialog.close();document.querySelector<HTMLElement>('.world')!.focus();
  }catch(e){errorMessage=(e as Error).message;notice(errorMessage);let current=committed?bridge.players.find(p=>p.role===bridge.user?.role):before;
   // A lost HTTP response does not tell us whether the server committed the move.
   if(submitted&&bridge.user?.role){try{current=(await request('location')).player;bridge.navigationRecovery=false;}catch{bridge.navigationRecovery=true;notice('尚未确认服务器位置，连接恢复后将自动恢复');}}
   if(current){try{await changeScene(current.scene);bridge.apply(current);}catch{notice('地点恢复失败，请刷新重连');}}
  }finally{if(preparing===preparation)preparing=undefined;preparation.abort();busy=false;bridge.transitioning=false;closeButton.disabled=false;if(dialog.open){open();if(errorMessage)dialog.querySelector('[data-error]')!.textContent=errorMessage;}else document.querySelector<HTMLElement>('.world')!.focus();}
 };
 document.querySelector('#room-open')!.addEventListener('click',open);
 const key=(e:KeyboardEvent)=>{if(e.code==='KeyE'&&!e.repeat&&!dialog.open&&!document.querySelector('dialog[open]')&&[document.querySelector('.world'),bridge.game.canvas].includes(document.activeElement)&&exitNear()){e.preventDefault();e.stopImmediatePropagation();open();}};
 window.addEventListener('keydown',key,true);
 bridge.game.events.on('poststep',()=>{const s=bridge.active,p=bridge.state();if(!s||!p){setExitGuide(false);return;}
  if(markScene!==s){mark?.destroy();markScene=s;mark=s.add.graphics().setDepth(0);}
  const r=rooms[p.scene as RoomKey],point=project({x:r.exit[0],y:r.exit[1]},['hutong','hawaii'].includes(p.scene)&&!!s.reverse);mark!.clear().lineStyle(1,0xc3c6ac,.7).strokeRect(point.x-12,point.y-5,24,10).fillStyle(0xc3c6ac,.8).fillRect(point.x-3,point.y-1,6,2);
  setExitGuide(exitNear()&&!dialog.open&&!document.querySelector('dialog[open]'));
 });
 return{open,exitNear};
}
