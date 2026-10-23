import type {MultiplayerBridge} from './multiplayer/bridge';
import {preparePhoto,type PreparedPhoto} from './multiplayer/album-image';
import {cropRect,type CropRect} from './camera-selection.mjs';
import './scene-camera.css';

export function setupSceneCamera(bridge:MultiplayerBridge,onPhoto:(photo:PreparedPhoto,scene:string)=>void,notice:(text:string)=>void){
 const dialog=document.createElement('dialog');dialog.id='scene-camera';dialog.className='social-dialog camera-dialog';dialog.setAttribute('aria-labelledby','camera-title');
 dialog.innerHTML=`<div class="panel-heading"><h2 id="camera-title">场景拍照</h2><button id="camera-cancel" type="button">取消</button></div>
 <p id="camera-instructions">拖动框选拍照范围，可重新拖动调整。也可以直接拍下全景。</p>
 <div id="camera-stage" tabindex="0" role="group" aria-label="照片取景区：拖动框选，方向键微调，Shift 加方向键调整大小" aria-describedby="camera-instructions camera-status"><div id="camera-selection" hidden></div></div>
 <p id="camera-status" role="status" aria-live="polite"></p><div class="camera-actions"><button id="camera-full" type="button">全景</button><button id="camera-confirm" type="button" disabled>预览照片</button></div>`;
 document.querySelector('.world')!.append(dialog);
 const $=<T extends HTMLElement=HTMLElement>(id:string)=>dialog.querySelector<T>('#'+id)!;
 const stage=$('camera-stage'),selection=$('camera-selection'),confirm=$<HTMLButtonElement>('camera-confirm');
 const frame=new Image();frame.id='camera-frame';frame.alt='当前场景的定格画面';frame.draggable=false;frame.hidden=true;stage.prepend(frame);
 const button=document.createElement('button');button.id='camera-open';button.textContent='拍照';
 const albumButton=document.getElementById('album-open')!;albumButton.after(button);
 // A captured touch drag can suppress the browser's following synthetic click.
 // Activate a control only when the same finger starts and ends on that button.
 let touchButton:{id:number;button:HTMLButtonElement}|null=null;
 dialog.addEventListener('pointerdown',event=>{const target=(event.target as Element).closest<HTMLButtonElement>('button');if(event.pointerType==='touch'&&event.isPrimary)touchButton=target&&!target.disabled?{id:event.pointerId,button:target}:null;});
 dialog.addEventListener('pointerup',event=>{const pending=touchButton;touchButton=null;if(!pending||event.pointerId!==pending.id||pending.button.disabled)return;const rect=pending.button.getBoundingClientRect();if(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom){event.preventDefault();pending.button.click();}});
 dialog.addEventListener('pointercancel',()=>{touchButton=null;});
 let scene='',owner='',epoch=0,busy=false,ready=false,selected:CropRect|null=null,start:{x:number;y:number}|null=null,pointer:number|null=null;
 let beforeDrag:CropRect|null=null;
 const current=(version:number)=>dialog.open&&version===epoch&&bridge.user?.id===owner&&bridge.active?.sys.settings.key===scene&&!bridge.transitioning;
 function draw(){
  selection.hidden=!selected;
  if(selected){Object.assign(selection.style,{left:`${selected.x/frame.naturalWidth*100}%`,top:`${selected.y/frame.naturalHeight*100}%`,width:`${selected.width/frame.naturalWidth*100}%`,height:`${selected.height/frame.naturalHeight*100}%`});}
  confirm.disabled=busy||!ready||!selected;
  $('camera-status').textContent=selected?`取景 ${selected.width} × ${selected.height} · 确认后可预览，尚未存入相册。`:'框选范围太小，请重新拖动，或选择全景。';
 }
 function full(){if(!ready||busy)return;selected={x:0,y:0,width:frame.naturalWidth,height:frame.naturalHeight};draw();}
 function point(event:PointerEvent){const rect=stage.getBoundingClientRect();return {x:Math.max(0,Math.min(frame.naturalWidth,(event.clientX-rect.left)/rect.width*frame.naturalWidth)),y:Math.max(0,Math.min(frame.naturalHeight,(event.clientY-rect.top)/rect.height*frame.naturalHeight))};}
 stage.onpointerdown=event=>{
  if(!ready||busy||!event.isPrimary||event.button!==0)return;if(event.pointerType!=='touch')event.preventDefault();stage.focus();beforeDrag=selected;start=point(event);pointer=event.pointerId;stage.setPointerCapture(pointer);selected=null;draw();
 };
 stage.onpointermove=event=>{if(!start||event.pointerId!==pointer)return;selected=cropRect(start,point(event),frame.naturalWidth,frame.naturalHeight);draw();};
 stage.onpointerup=event=>{if(!start||event.pointerId!==pointer)return;selected=cropRect(start,point(event),frame.naturalWidth,frame.naturalHeight);start=null;pointer=null;if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);draw();};
 stage.onpointercancel=()=>{start=null;pointer=null;selected=beforeDrag;draw();};
 stage.onkeydown=event=>{
  if(!selected||busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();const dx=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0,dy=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0;
  if(event.shiftKey){selected.width=Math.max(8,Math.min(frame.naturalWidth-selected.x,selected.width+dx));selected.height=Math.max(8,Math.min(frame.naturalHeight-selected.y,selected.height+dy));}
  else{selected.x=Math.max(0,Math.min(frame.naturalWidth-selected.width,selected.x+dx));selected.y=Math.max(0,Math.min(frame.naturalHeight-selected.height,selected.y+dy));}draw();
 };
 function clean(){epoch++;ready=false;busy=false;selected=null;start=null;pointer=null;touchButton=null;frame.hidden=true;frame.removeAttribute('src');selection.hidden=true;confirm.disabled=true;}
 dialog.addEventListener('close',()=>{clean();document.querySelector<HTMLElement>('.world')?.focus();});
 $('camera-cancel').onclick=()=>dialog.close();$('camera-full').onclick=full;
 button.onclick=()=>{
  if(!bridge.user?.role){notice('请先登录并领取角色');return;}
  if(bridge.transitioning||!bridge.active){notice('场景正在切换，请稍后拍照');return;}
  if(document.querySelector('dialog[open]'))return;
  clean();owner=bridge.user.id;scene=bridge.active.sys.settings.key;const version=epoch;
  $('camera-status').textContent='正在定格场景…';dialog.showModal();
  let settled=false;
  const timeout=setTimeout(()=>{if(!settled&&current(version)){settled=true;dialog.close();notice('画面暂时无法读取，请重试拍照');}},8000);
  try{
   bridge.game.renderer.snapshot(async image=>{
    clearTimeout(timeout);if(settled||!current(version))return;settled=true;
    try{if(!(image instanceof HTMLImageElement))throw Error('截图失败');frame.src=image.src;await frame.decode();if(!current(version))return;frame.hidden=false;ready=true;full();stage.focus();}
    catch{if(current(version)){dialog.close();notice('画面读取失败，请重试拍照');}}
   },'image/png');
  }catch{clearTimeout(timeout);dialog.close();notice('这个浏览器暂时无法拍照，请重试');}
 };
 confirm.onclick=async()=>{
  if(!selected||!ready||busy)return;busy=true;confirm.disabled=true;$('camera-status').textContent='正在准备照片…';const version=epoch,area={...selected};
  try{
   const canvas=document.createElement('canvas');canvas.width=area.width;canvas.height=area.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法处理照片');
   ctx.imageSmoothingEnabled=false;ctx.drawImage(frame,area.x,area.y,area.width,area.height,0,0,area.width,area.height);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('无法处理照片')),'image/png'));
   const photo=await preparePhoto(new File([blob],'场景留影.png',{type:'image/png'}));
   if(!current(version)){URL.revokeObjectURL(photo.preview);return;}
   const capturedScene=scene;dialog.close();onPhoto(photo,capturedScene);
  }catch(error){if(current(version)){$('camera-status').textContent=(error as Error).message+'，请重试或取消。';confirm.disabled=false;}}
  finally{if(version===epoch)busy=false;}
 };
 const check=()=>{if(dialog.open&&(bridge.user?.id!==owner||bridge.active?.sys.settings.key!==scene||bridge.transitioning)){dialog.close();notice('场景或账号已变化，请重新拍照');}};
 bridge.game.events.on('poststep',check);
 bridge.game.events.once('destroy',()=>{clean();bridge.game.events.off('poststep',check);dialog.remove();button.remove();});
 return {reset(){dialog.close();clean();}};
}
