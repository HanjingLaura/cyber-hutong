import rules from '../../shared/npcs.json';
import positions from '../../shared/guests.json';
import type {MultiplayerBridge} from './bridge';
import {dockPrompt} from '../hud';
const names:Record<string,string>={ani:'Ani',lulu:'噜噜',tutu:'图图',buzz:'巴斯光年',zhu:'朱志鑫',ferret:'富贵貂'};
export function setupNPCUI(bridge:MultiplayerBridge,request:(path:string,input?:any)=>Promise<any>,publish:()=>Promise<void>,client:string,notice:(s:string)=>void){
 const root=document.createElement('div');root.id='npc-ui';root.innerHTML='<button id="npc-interact" hidden></button><div id="npc-speech-layer"></div>';document.querySelector('.world')!.append(root);
 // Grab #npc-interact before dockPrompt moves it out of root.
 const button=root.querySelector<HTMLButtonElement>('#npc-interact')!;dockPrompt(button);
 const speech=root.querySelector<HTMLElement>('#npc-speech-layer')!;
 let visible:string[]=[],reactions:any[]=[],offset=0,busy=false;
 const nearest=()=>{const p=bridge.state();if(!p||!bridge.user?.role)return;return rules.filter(n=>n.owner===bridge.user!.role&&n.room===p.scene&&visible.includes(n.id)).find(n=>{const point=(positions as Record<string,{x:number;y:number}>)[n.id];return Math.hypot(p.x-point.x,p.y-point.y)<=(n.id==='ani'?75:42);});};
 async function interact(id:string){if(busy)return;busy=true;try{await publish();await request('npc',{npc:id,client});}catch(e){notice((e as Error).message);}finally{busy=false;}}
 button.onclick=()=>{const n=nearest();if(n)void interact(n.id);};
 const click=(e:Event)=>{const id=(e as CustomEvent).detail,rule=rules.find(r=>r.id===id);if(rule?.owner===bridge.user?.role)void interact(id);};window.addEventListener('hutong:npc-interact',click);
 const key=(e:KeyboardEvent)=>{if(e.code!=='KeyE'||e.repeat||document.querySelector('dialog[open]')||![document.querySelector('.world'),bridge.game.canvas].includes(document.activeElement)||bridge.state()?.seat)return;const n=nearest();if(!n)return;e.preventDefault();e.stopImmediatePropagation();void interact(n.id);};window.addEventListener('keydown',key,true);
 const draw=()=>{
  const n=nearest();button.hidden=!n||!bridge.controller||!bridge.connected||!!document.querySelector('dialog[open]');button.disabled=busy;button.textContent=n?'与'+names[n.id]+'互动'+(bridge.state()?.seat?'':' · E'):'';
  const rect=bridge.game.canvas.getBoundingClientRect(),world=document.querySelector('.world')!.getBoundingClientRect(),scene=bridge.active?.sys.settings.key;
  speech.replaceChildren();for(const r of reactions.filter(r=>r.scene===scene&&r.expires>Date.now()+offset&&visible.includes(r.npc))){const point=bridge.screen({scene:r.scene,x:r.x,y:r.y,facing:0} as any),bubble=document.createElement('p');bubble.className='npc-speech';bubble.textContent=r.text;bubble.style.left=rect.left-world.left+point.x/640*rect.width+'px';bubble.style.top=rect.top-world.top+(point.y-65)/360*rect.height+'px';speech.append(bubble);}
 };const timer=setInterval(draw,100);
 bridge.game.events.once('destroy',()=>{clearInterval(timer);window.removeEventListener('keydown',key,true);window.removeEventListener('hutong:npc-interact',click);root.remove();});
 return{receive(data:any){visible=data.npcs??visible;reactions=data.npcReactions??reactions;if(data.clock)offset=data.clock-Date.now();draw();},reset(){visible=[];reactions=[];draw();}};
}
