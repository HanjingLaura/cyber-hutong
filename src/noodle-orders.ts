import type Phaser from 'phaser';
import {onlineWorld} from './multiplayer/world-client';
import {playerInventory} from './player-inventory';
import {restoreWorldFocus} from './world-focus';
import './noodle-social.css';
type Item={name:string;status:string;picker:string|null;pickerRole:string|null};
type Order={id:string;account:string;role:string|null;table:number;revision:number;status:string;items:Item[]};
type OrdersWorld=Omit<NonNullable<ReturnType<typeof onlineWorld>>,'noodleOrders'>&{noodleOrders:Order[];noodleOrder:(action:string,args:Record<string,unknown>)=>Promise<unknown>};
export function setupNoodleOrders(scene:Phaser.Scene,nearTable:()=>number|null){
 const dialog=document.createElement('dialog');dialog.className='noodle-orders';dialog.id='noodle-orders';dialog.setAttribute('aria-label','米线店点餐单');
 dialog.innerHTML='<header><h2>点餐单</h2><button type="button" aria-label="关闭点餐单">关闭</button></header><form><label>桌号<select name="table"><option value="0">1号桌</option><option value="1">2号桌</option></select></label><span>米线</span><label>小食<select name="chicken"><option value="">不加</option><option>鸡柳</option><option>炸鸡</option></select></label><label>饮料<select name="drink"><option value="">不加</option><option>可乐</option><option>冰红茶</option></select></label><button type="submit">保存点单</button></form><div class="noodle-order-list"></div><p class="noodle-orders-status" role="status"></p>';
 document.body.append(dialog);const form=dialog.querySelector('form')!,list=dialog.querySelector('.noodle-order-list')!,status=dialog.querySelector('.noodle-orders-status')!;
 const table=form.elements.namedItem('table') as HTMLSelectElement,chicken=form.elements.namedItem('chicken') as HTMLSelectElement,drink=form.elements.namedItem('drink') as HTMLSelectElement;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='noodle-order-button';trigger.id='noodle-order-action';trigger.textContent='点餐单';document.querySelector('.world')?.append(trigger);
 let epoch=0,signature='',busy=false,editingId:string|undefined;
 const world=()=>onlineWorld() as OrdersWorld|undefined;
 function render(syncForm=false){
  const w=world(),rows=w?.noodleOrders??[],self=w?.bridge.user?.id;list.replaceChildren();
  const mine=rows.find(o=>o.account===self&&o.status==='active');
  if(syncForm){editingId=mine?.id;table.value=String(mine?.table??nearTable()??0);chicken.value=mine?.items.find(i=>['鸡柳','炸鸡'].includes(i.name))?.name??'';drink.value=mine?.items.find(i=>['可乐','冰红茶'].includes(i.name))?.name??'';}
  if(!rows.length){const p=document.createElement('p');p.textContent='还没有人点餐';list.append(p);}
  for(const order of rows){
   const row=document.createElement('section');row.className='noodle-order-row';const title=document.createElement('p');title.textContent=`${order.role??'朋友'} · ${order.table+1}号桌 · ${({active:'取餐中',completed:'已上齐',cancelled:'已撤单',expired:'已过期'} as Record<string,string>)[order.status]??order.status}`;row.append(title);
   order.items.forEach((item,index)=>{
    const line=document.createElement('div');line.className='noodle-order-item';const text=document.createElement('span');text.textContent=`${item.name} · ${item.status==='served'?'已上桌':item.status==='picked'?`${item.pickerRole??'朋友'}已取`:'待取'}`;line.append(text);
    if(order.status==='active'){
     if(item.status==='pending')line.append(button('帮取',()=>send('pickup',{orderId:order.id,orderRevision:order.revision,item:index})));
     if(item.status==='picked'&&item.picker===self){
      const slot=document.createElement('select');slot.setAttribute('aria-label',`${item.name}放在哪个位置`);slot.append(new Option('选空位',''));
      const object=w?.objects.get(`noodle:table-${order.table}`);(object?.slots??[]).forEach((dish,i)=>{if(!dish)slot.append(new Option(`${i+1}号空位`,String(i)));});
      line.append(slot,button('上桌',()=>{if(slot.value===''){status.textContent='先选桌上空位';return;}void send('serve',{orderId:order.id,orderRevision:order.revision,item:index,table:order.table,slot:Number(slot.value),expectedObjectVersion:object?.version});},playerInventory.hand!==item.name),button('放弃帮取',()=>send('release',{orderId:order.id,orderRevision:order.revision,item:index})));
     }
    }
    row.append(line);
   });
   if(order.account===self)row.append(button(order.status==='active'?'撤单':'收起',()=>send(order.status==='active'?'cancel':'dismiss',{orderId:order.id,orderRevision:order.revision})));
   list.append(row);
  }
 }
 function button(label:string,run:()=>unknown,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=busy||disabled;b.onclick=()=>void run();return b;}
 async function send(action:string,args:Record<string,unknown>){
  const w=world();if(!w?.bridge.user?.role){status.textContent='登录并连接后再点餐';return;}if(busy)return;
  const token=epoch,account=w.bridge.user.id,worldEpoch=w.epoch;busy=true;status.textContent='正在处理';render();
  try{await w.noodleOrder(action,args);if(token===epoch&&scene.sys.isActive()&&dialog.open&&w.bridge.user?.id===account&&w.epoch===worldEpoch){status.textContent=({pickup:'已取餐，请放到指定桌上',serve:'已上桌',release:'已放弃帮取，手中物品保留',cancel:'已撤单，已取食品保留',dismiss:'已收起',save:'已保存点单'} as Record<string,string>)[action];render(action==='save'||action==='cancel');}}
  catch(error){if(token===epoch&&scene.sys.isActive()&&dialog.open&&w.bridge.user?.id===account&&w.epoch===worldEpoch){status.textContent=(error as Error).message;render();}}
  finally{busy=false;if(scene.sys.isActive()&&dialog.open)render();}
 }
 form.onsubmit=event=>{event.preventDefault();const mine=world()?.noodleOrders?.find(o=>o.id===editingId&&o.status==='active');void send('save',{table:Number(table.value),items:['米线',chicken.value,drink.value].filter(Boolean),...(mine?{orderId:mine.id,orderRevision:mine.revision}:{})});};
 function open(index:number){epoch++;status.textContent='';table.value=String(index);render(true);scene.input.keyboard?.resetKeys();if(!dialog.open)dialog.showModal();}
 trigger.onclick=()=>{if(scene.sys.isActive())open(nearTable()??0);};dialog.querySelector('header button')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{epoch++;scene.input.keyboard?.resetKeys();if(scene.sys.isActive())restoreWorldFocus(dialog,trigger);});
 const close=()=>{epoch++;if(dialog.open)dialog.close();};scene.events.on('sleep',()=>{trigger.hidden=true;close();});scene.events.once('shutdown',()=>{close();dialog.remove();trigger.remove();});
 return{open,update(){trigger.hidden=!scene.sys.isActive();const w=world(),next=JSON.stringify([w?.bridge.user?.id,w?.noodleOrders,w?.objects.get('noodle:table-0')?.version,w?.objects.get('noodle:table-1')?.version,playerInventory.hand]);if(signature!==next){signature=next;if(dialog.open)render();}},get openNow(){return dialog.open;}};
}
