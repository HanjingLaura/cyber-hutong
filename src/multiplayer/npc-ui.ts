import rules from '../../shared/npcs.json';
import positions from '../../shared/guests.json';
import type {MultiplayerBridge} from './bridge';
import {dockPrompt} from '../hud';
import {receiveNpcFeedback, clearNpcFeedback, npcFeedback, paintNpcFeedback, type NpcReaction} from '../npc-feedback';
const names:Record<string,string>={ani:'Ani',lulu:'噜噜',tutu:'图图',buzz:'巴斯光年',zhu:'朱志鑫',ferret:'富贵貂'};
export function setupNPCUI(bridge:MultiplayerBridge,request:(path:string,input?:any)=>Promise<any>,publish:()=>Promise<void>,client:string,notice:(s:string)=>void){
 const root=document.createElement('div');root.id='npc-ui';root.innerHTML='<button id="npc-interact" hidden></button><div id="npc-speech-layer"></div>';document.querySelector('.world')!.append(root);
 // Grab #npc-interact before dockPrompt moves it out of root.
 const button=root.querySelector<HTMLButtonElement>('#npc-interact')!;dockPrompt(button);
 const speech=root.querySelector<HTMLElement>('#npc-speech-layer')!;
 const views=new Map<string,{bubble:HTMLParagraphElement;canvas:HTMLCanvasElement}>();
 let visible:string[]=[],busy=false,generation=0,destroyed=false;
 const nearest=()=>{const p=bridge.state();if(!p||!bridge.user?.role)return;return rules.filter(n=>n.owner===bridge.user!.role&&n.room===p.scene&&visible.includes(n.id)).find(n=>{const point=(positions as Record<string,{x:number;y:number}>)[n.id];return Math.hypot(p.x-point.x,p.y-point.y)<=(n.id==='ani'?75:42);});};
 async function interact(id:string){const account=bridge.user?.id;if(!account||busy||destroyed||!bridge.controller||!bridge.connected)return;busy=true;
  const attempt=generation,current=()=>!destroyed&&generation===attempt&&bridge.user?.id===account&&bridge.controller&&bridge.connected;try{
  await publish();if(!current())return;const result=await request('npc',{npc:id,client});if(!current())return;
  // Immediate owner feedback even if the action and SSE use different replicas.
  receiveNpcFeedback([result.reaction],result.clock);draw();
 }catch(e){if(current())notice((e as Error).message);}finally{if(generation===attempt)busy=false;}}
 button.onclick=()=>{const n=nearest();if(n)void interact(n.id);};
 const click=(e:Event)=>{const id=(e as CustomEvent).detail,rule=rules.find(r=>r.id===id);if(rule?.owner===bridge.user?.role)void interact(id);};window.addEventListener('hutong:npc-interact',click);
 const key=(e:KeyboardEvent)=>{if(e.code!=='KeyE'||e.repeat||document.querySelector('dialog[open]')||![document.querySelector('.world'),bridge.game.canvas].includes(document.activeElement)||bridge.state()?.seat)return;const n=nearest();if(!n)return;e.preventDefault();e.stopImmediatePropagation();void interact(n.id);};window.addEventListener('keydown',key,true);
 const draw=()=>{
  const n=nearest();button.hidden=!n||!bridge.controller||!bridge.connected||!!document.querySelector('dialog[open]');button.disabled=busy;button.textContent=n?'与'+names[n.id]+'互动':'';
  const rect=bridge.game.canvas.getBoundingClientRect(),world=document.querySelector('.world')!.getBoundingClientRect(),scene=bridge.active?.sys.settings.key;
  const shown=new Set<string>(),placed:DOMRect[]=[];
  for(const rule of rules){
   const feedback=npcFeedback(rule.id);if(!feedback||feedback.reaction.scene!==scene||!visible.includes(rule.id))continue;
   const r=feedback.reaction;shown.add(rule.id);let view=views.get(rule.id);
   if(!view){const bubble=document.createElement('p'),canvas=document.createElement('canvas');bubble.className='npc-speech';bubble.setAttribute('role','status');canvas.className='npc-effect';canvas.dataset.npc=rule.id;canvas.width=canvas.height=96;canvas.setAttribute('aria-hidden','true');speech.append(canvas,bubble);view={bubble,canvas};views.set(rule.id,view);}
   if(view.bubble.textContent!==r.text)view.bubble.textContent=r.text;
   const point=bridge.screen({scene:r.scene,x:r.x,y:r.y,facing:0} as any),left=rect.left-world.left+point.x/640*rect.width,top=rect.top-world.top+point.y/360*rect.height;
   const height=(positions as Record<string,{height:number}>)[rule.id].height;
   const bubbleWidth=view.bubble.offsetWidth,bubbleHeight=view.bubble.offsetHeight;
   const bubbleLeft=Math.max(bubbleWidth/2+8,Math.min(world.width-bubbleWidth/2-8,left));
   let bubbleTop=Math.max(bubbleHeight+60,top-(height+12)/360*rect.height);
   for(const box of placed)if(bubbleLeft+bubbleWidth/2>box.left&&bubbleLeft-bubbleWidth/2<box.right&&bubbleTop>box.top&&bubbleTop-bubbleHeight<box.bottom)bubbleTop=box.top-8;
   bubbleTop=Math.max(bubbleHeight+60,bubbleTop);
   view.bubble.style.left=bubbleLeft+'px';view.bubble.style.top=bubbleTop+'px';
   placed.push(new DOMRect(bubbleLeft-bubbleWidth/2,bubbleTop-bubbleHeight,bubbleWidth,bubbleHeight));
   view.canvas.style.left=left+'px';view.canvas.style.top=top+'px';view.canvas.style.width=96/640*rect.width+'px';view.canvas.style.height=96/360*rect.height+'px';
   view.canvas.dataset.reaction=r.id;paintNpcFeedback(view.canvas,rule.id,height);
  }
  for(const [id,view]of views)if(!shown.has(id)){view.bubble.remove();view.canvas.remove();views.delete(id);}
 };const timer=setInterval(draw,100);
 bridge.game.events.once('destroy',()=>{destroyed=true;generation++;clearInterval(timer);clearNpcFeedback();window.removeEventListener('keydown',key,true);window.removeEventListener('hutong:npc-interact',click);button.remove();root.remove();});
 return{receive(data:{npcs?:string[];npcReactions?:NpcReaction[];clock?:number}){if(destroyed)return;visible=data.npcs??visible;receiveNpcFeedback(data.npcReactions??[],data.clock);draw();},reset(){generation++;busy=false;visible=[];clearNpcFeedback();if(!destroyed)draw();}};
}
