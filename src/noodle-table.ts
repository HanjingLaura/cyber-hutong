import type Phaser from 'phaser';
import {playerInventory,type ItemName} from './player-inventory';
import {onlineWorld} from './multiplayer/world-client';
import {bindSceneEvent} from './scene-dom';
export type NoodleDish={name:ItemName;seasoning:string[]};
type State={dishes:(NoodleDish|null)[][];seated:number|null};
/** Selection is local. Capture the version when a slot is selected, not when an action is sent. */
export function setupNoodleTable(scene:Phaser.Scene,getState:()=>State,local:(table:number,slot:number,action:string,item?:string)=>void,openOrders:(table:number)=>void){
 const dialog=document.querySelector<HTMLDialogElement>('#noodle-menu')!,choices=document.querySelector('#noodle-choices')!;
 let table=0,selected:number|null=null,version:number|undefined,epoch=0,busy=false,message='';
 const invalidate=()=>{epoch++;busy=false;selected=null;version=undefined;message='';};
 bindSceneEvent(scene,dialog,'close',invalidate);
 scene.events.on('sleep',invalidate);
 const button=(label:string,run:()=>void,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled||busy;b.onclick=run;return b;};
 function render(){
  const state=getState(),dish=selected===null?null:state.dishes[table][selected],hand=playerInventory.hand;
  document.querySelector('#noodle-title')!.textContent=`${table+1}号桌`;
  document.querySelector('#noodle-menu-hand')!.textContent=`手中：${hand??'空'}`;choices.replaceChildren();
  const grid=document.createElement('div');grid.className='noodle-slot-grid';grid.setAttribute('aria-label','选择桌上位置');
  state.dishes[table].forEach((d,slot)=>{const b=button(`${slot+1} · ${d?.name??'空位'}${d?.seasoning.length?'（'+d.seasoning.join('、')+'）':''}`,()=>select(slot));b.setAttribute('aria-pressed',String(selected===slot));b.dataset.slot=String(slot);grid.append(b);});choices.append(grid);
  const hint=document.createElement('p');hint.className='noodle-selection';hint.textContent=message||(selected===null?'先选一份食物或空位':`已选 ${selected+1} 号位置`);choices.append(hint);
  const run=(action:string,item?:string,fromHand=false)=>{
   if(busy||selected===null&&!fromHand)return;const target=selected??0,captured=epoch;
   const args={slot:target,...(!fromHand&&version!==undefined?{expectedObjectVersion:version}:{}),...(item?{item}:{}),...(fromHand?{fromHand:true}:{})};
   const w=onlineWorld();if(w?.bridge.user?.role){
    const account=w.bridge.user.id,worldEpoch=w.epoch;busy=true;message='正在处理';render();
    const current=()=>epoch===captured&&scene.sys.isActive()&&dialog.open&&w.bridge.user?.id===account&&w.epoch===worldEpoch;
    void w.action(`noodle:table-${table}`,action,args).then(()=>{if(current()){selected=null;version=undefined;message='已完成';}}).catch(error=>{if(current()){selected=null;version=undefined;message=(error as Error).message;}}).finally(()=>{if(current()){busy=false;render();}});return;
   }
   local(table,target,fromHand?'consumeHand':action,item);selected=null;render();
  };
  if(selected!==null){
   if(!dish)choices.append(button(hand?`放下${hand}`:'放下物品',()=>run('put'),!hand));
   else{
    choices.append(button(`拿起${dish.name}`,()=>run('take'),!!hand));
    if(dish.name==='米线')for(const name of ['醋','麻油'])choices.append(button(`加${name}`,()=>run('season',name),dish.seasoning.includes(name)));
    if(['米线','鸡柳','炸鸡'].includes(dish.name))choices.append(button(`吃这份${dish.name}`,()=>run('consume'),state.seated===null));
   }
  }
  if(hand&&['米线','鸡柳','炸鸡'].includes(hand))choices.append(button(`吃手里的${hand}`,()=>run('consume',undefined,true),state.seated===null));
  choices.append(button('点餐单',()=>{dialog.close();openOrders(table);}));
 }
 function select(slot:number){message='';selected=slot;version=onlineWorld()?.objects.get(`noodle:table-${table}`)?.version;render();}
 return{open(index:number,slot?:number){invalidate();table=index;render();if(slot!==undefined)select(slot);scene.input.keyboard?.resetKeys();if(!dialog.open)dialog.showModal();},close(){invalidate();if(dialog.open)dialog.close();},get selectedSlot(){return selected;}};
}
