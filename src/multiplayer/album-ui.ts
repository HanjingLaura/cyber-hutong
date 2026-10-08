import type {MultiplayerBridge} from './bridge';
import rooms from '../../shared/rooms.json';
import {apiUrl} from '../base';
import {preparePhoto,type PreparedPhoto} from './album-image';
import './album.css';

type Photo={id:string;scene:string;caption:string;width:number;height:number;owner:string|null;editable:boolean;visibility:'public'|'selected';recipients?:string[];created:number;updated:number};
type Member={role:string;claimed:boolean};
type Album={scene:string;photos:Photo[];members:Member[]};
const title=(s:string)=>s[0].toUpperCase()+s.slice(1);
const imageUrl=(p:Photo)=>apiUrl('album-photo?id='+encodeURIComponent(p.id)+'&v='+p.updated);

export function setupAlbumUI(bridge:MultiplayerBridge,request:(path:string,input?:any)=>Promise<any>,notice:(text:string)=>void){
  const dialog=document.createElement('dialog');dialog.id='album-dialog';dialog.className='social-dialog album-dialog';dialog.setAttribute('aria-labelledby','album-title');
  dialog.innerHTML=`<div class="panel-heading"><h2 id="album-title">相册</h2><button id="album-close" type="button">关闭</button></div>
    <p id="album-status" role="status" aria-live="polite"></p>
    <section id="album-browse"><div class="album-bar"><p id="album-count"></p><button id="album-refresh" type="button">刷新</button><button id="album-add" type="button">上传照片</button></div><div id="album-grid" class="album-grid"></div></section>
    <section id="album-compose" hidden><form id="album-form"><p class="album-help">把以前在这里留下的照片放进相册。</p><label class="album-file-label">选择照片<input id="album-files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><p class="album-help">JPG / PNG / WebP，每次最多 10 张。</p><div id="album-previews" class="album-previews"></div><label>照片说明（选填）<input id="album-caption" maxlength="120" placeholder="想记住的那一刻"></label><div id="album-upload-sharing"></div><div class="album-actions"><button id="album-submit" type="submit" disabled>保存照片</button><button id="album-cancel-upload" type="button">返回相册</button></div></form></section>
    <section id="album-detail" hidden><button id="album-back" type="button">返回相册</button><div id="album-full"></div><p id="album-detail-caption"></p><p id="album-detail-meta" class="album-help"></p><form id="album-share-form" hidden><div id="album-edit-sharing"></div><div class="album-actions"><button id="album-save-sharing" type="submit">保存可见范围</button><button id="album-delete" class="album-danger" type="button">删除照片</button></div></form><div id="album-delete-confirm" hidden><p>删除这张照片？相册里的其他成员也将无法查看。</p><div class="album-actions"><button id="album-confirm-delete" class="album-danger" type="button">确认删除</button><button id="album-keep" type="button">保留照片</button></div></div></section>`;
  document.querySelector('.world')!.append(dialog);
  const $=<T extends HTMLElement=HTMLElement>(id:string)=>dialog.querySelector<T>('#'+id)!;
  const button=document.createElement('button');button.id='album-open';button.textContent='相册';
  const tools=document.getElementById('game-tools')!;tools.insertBefore(button,document.getElementById('collection-open')?.nextSibling??tools.querySelector('#settings-open'));
  let scene='',owner='',epoch=0,busy=false,loading=false,preparing=false,album:Album|null=null,selected:Photo|null=null,prepared:PreparedPhoto[]=[],signature='',poll:ReturnType<typeof setInterval>|undefined;
  const current=(version:number)=>version===epoch&&owner===bridge.user?.id&&dialog.open;
  function status(text:string,error=false){$('album-status').textContent=text;$('album-status').classList.toggle('album-error',error);}
  function pane(which:'browse'|'compose'|'detail'){
    for(const name of ['browse','compose','detail'])$('album-'+name).hidden=name!==which;
    $('album-delete-confirm').hidden=true;dialog.scrollTop=0;
  }
  function clearPrepared(){for(const photo of prepared)URL.revokeObjectURL(photo.preview);prepared=[];$('album-previews').replaceChildren();$('album-files' as string).closest('form')?.reset();}
  function controls(){
    dialog.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button').forEach(el=>{el.disabled=busy||preparing||el.dataset.unclaimed==='true';});
    $('album-submit').toggleAttribute('disabled',busy||preparing||!prepared.length);
    $('album-confirm-delete').toggleAttribute('disabled',busy);$('album-keep').toggleAttribute('disabled',busy);
    $('album-close').toggleAttribute('disabled',busy||preparing);
    $('album-submit').textContent=busy?'正在保存…':preparing?'正在处理照片…':prepared.length?`保存 ${prepared.length} 张照片`:'保存照片';
  }
  function sharing(container:HTMLElement,prefix:string,visibility='selected',recipients:string[]=[]){
    container.replaceChildren();
    const field=document.createElement('fieldset');field.className='album-sharing';
    const legend=document.createElement('legend');legend.textContent='谁可以看到';field.append(legend);
    for(const [value,label] of [['public','所有人（8 位成员）'],['selected','指定成员']]){
      const row=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name=prefix+'-visibility';radio.value=value;radio.checked=value===visibility;row.append(radio,document.createTextNode(label));field.append(row);
    }
    const members=document.createElement('div');members.className='album-members';members.setAttribute('aria-label','选择能看到照片的成员');
    for(const member of album?.members??[]){
      if(member.role===bridge.user?.role)continue;
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.name=prefix+'-recipient';check.value=member.role;check.checked=recipients.includes(member.role);check.disabled=!member.claimed;check.dataset.unclaimed=String(!member.claimed);label.append(check,document.createTextNode(title(member.role)+(member.claimed?'':'（未领取）')));members.append(label);
    }
    const hint=document.createElement('p');hint.className='album-help';
    const update=()=>{const all=field.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value==='public';members.hidden=all;hint.textContent=all?'八位成员登录后都能看到。':'你始终可见；可多选其他成员，不勾选则仅自己可见。';};
    field.addEventListener('change',update);field.append(members,hint);container.append(field);update();
  }
  function permissions(prefix:string){return {visibility:dialog.querySelector<HTMLInputElement>(`input[name="${prefix}-visibility"]:checked`)!.value,recipients:[...dialog.querySelectorAll<HTMLInputElement>(`input[name="${prefix}-recipient"]:checked`)].map(input=>input.value)};}
  function previews(){
    const grid=$('album-previews');grid.replaceChildren();prepared.forEach((photo,index)=>{
      const item=document.createElement('figure'),img=document.createElement('img'),remove=document.createElement('button');img.src=photo.preview;img.alt=photo.name;remove.type='button';remove.textContent='移除';remove.setAttribute('aria-label','移除 '+photo.name);remove.onclick=()=>{URL.revokeObjectURL(photo.preview);prepared.splice(index,1);previews();controls();};item.append(img,remove);grid.append(item);
    });
  }
  function draw(){
    const grid=$('album-grid');grid.replaceChildren();const photos=album?.photos??[];
    $('album-count').textContent=photos.length?`${photos.length} 张照片`:'还没有你能看到的照片';
    if(!photos.length){const empty=document.createElement('p');empty.className='album-empty';empty.textContent='上传一张以前在这里留下的照片，让这个场景多一段回忆。';grid.append(empty);}
    for(const photo of photos){
      const card=document.createElement('figure'),open=document.createElement('button'),img=document.createElement('img'),caption=document.createElement('figcaption'),label=document.createElement('p');
      card.className='album-photo';open.className='album-photo-open';open.type='button';open.setAttribute('aria-label','查看 '+(photo.caption||'照片'));img.src=imageUrl(photo);img.alt=photo.caption||'这个场景留下的照片';img.loading='lazy';img.width=photo.width;img.height=photo.height;open.append(img);open.onclick=()=>detail(photo);
      label.textContent=photo.caption||'留在这里的照片';caption.append(label);card.append(open,caption);grid.append(card);
    }
  }
  function detail(photo:Photo){
    selected=photo;pane('detail');status('');const img=document.createElement('img');img.src=imageUrl(photo);img.alt=photo.caption||'场景照片';img.onerror=()=>{if(selected?.id===photo.id){$('album-full').replaceChildren();status('照片暂时无法查看，请刷新相册重试。',true);}};$('album-full').replaceChildren(img);
    $('album-detail-caption').textContent=photo.caption||'留在这里的照片';$('album-detail-meta').textContent=photo.owner?title(photo.owner)+' 上传':'';$('album-detail-meta').hidden=!photo.owner;
    $('album-share-form').hidden=!photo.editable;if(photo.editable)sharing($('album-edit-sharing'),'edit',photo.visibility,photo.recipients);
  }
  async function refresh(quiet=false){
    if(loading||busy||preparing||!dialog.open)return;loading=true;const version=epoch;
    if(!quiet)status('正在读取相册…');
    try{
      const next:Album=await request('albums?scene='+encodeURIComponent(scene));if(!current(version))return;
      const nextSignature=JSON.stringify(next);album=next;
      if(nextSignature!==signature){signature=nextSignature;draw();
        if(selected){const photo=next.photos.find(p=>p.id===selected!.id);if(!photo){selected=null;$('album-full').replaceChildren();pane('browse');status('这张照片已删除或不再对你可见。');}else if(photo.updated!==selected.updated)detail(photo);}
      }
      if(!quiet)status('');
    }catch(e){if(current(version)){status((e as Error).message,true);if(quiet){$('album-grid').replaceChildren();$('album-full').replaceChildren();signature='';selected=null;pane('browse');}}}
    finally{if(version===epoch)loading=false;}
  }
  function clean(){epoch++;clearInterval(poll);poll=undefined;loading=false;busy=false;preparing=false;clearPrepared();album=null;selected=null;signature='';owner='';$('album-grid').replaceChildren();$('album-full').replaceChildren();status('');pane('browse');controls();}
  button.onclick=()=>{
    if(!bridge.user?.role){notice('请先登录并领取角色');return;}if(bridge.transitioning){notice('场景正在切换，请稍后打开相册');return;}
    clean();owner=bridge.user.id;scene=bridge.active?.sys.settings.key??'hutong';const room=(rooms as Record<string,{name:string}>)[scene];$('album-title').textContent=(room?.name??scene)+' 相册';dialog.showModal();void refresh();poll=setInterval(()=>void refresh(true),10_000);
  };
  $('album-close').onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(busy||preparing)event.preventDefault();});dialog.addEventListener('close',()=>{clean();document.querySelector<HTMLElement>('.world')?.focus();});
  $('album-refresh').onclick=()=>void refresh();
  $('album-add').onclick=()=>{if(!album)return;pane('compose');clearPrepared();sharing($('album-upload-sharing'),'upload');status('');controls();};
  $('album-cancel-upload').onclick=()=>{clearPrepared();pane('browse');status('');};
  $('album-files').onchange=async()=>{
    const input=$<HTMLInputElement>('album-files'),files=[...input.files??[]];input.value='';if(!files.length)return;
    if(files.length+prepared.length>10){status('一次最多选择 10 张照片，请减少数量后重试。',true);return;}
    preparing=true;controls();const version=epoch;status('正在处理照片…');let failed=0;
    for(const file of files){try{const photo=await preparePhoto(file);if(!current(version)){URL.revokeObjectURL(photo.preview);return;}prepared.push(photo);}catch(e){if(!current(version))return;failed++;status((e as Error).message,true);}}
    if(!current(version))return;preparing=false;previews();controls();if(!failed)status('照片已准备好，确认可见范围后保存。');
  };
  $('album-form').onsubmit=async event=>{
    event.preventDefault();if(busy||preparing||!prepared.length)return;
    if(bridge.active?.sys.settings.key!==scene){status('场景已变化，请重新打开相册再上传。',true);return;}
    busy=true;controls();const version=epoch;let saved=0;const caption=$<HTMLInputElement>('album-caption').value,sharing=permissions('upload');
    try{
      while(prepared.length){const photo=prepared[0];await request('albums',{scene,image:photo.image,caption,...sharing,requestId:photo.requestId});if(!current(version))return;prepared.shift();URL.revokeObjectURL(photo.preview);saved++;status(`已保存 ${saved} 张照片…`);}
      pane('browse');status(`已保存 ${saved} 张照片。`);signature='';
    }catch(e){if(current(version))status(`${saved?`已保存 ${saved} 张。`:''}${(e as Error).message}，剩余照片可重试。`,true);}
    finally{if(current(version)){busy=false;previews();controls();if(!prepared.length)await refresh(true);}}
  };
  $('album-back').onclick=()=>{selected=null;$('album-full').replaceChildren();pane('browse');status('');};
  $('album-share-form').onsubmit=async event=>{
    event.preventDefault();if(busy||!selected)return;busy=true;controls();const version=epoch,id=selected.id;
    try{const result=await request('album-photo',{action:'share',id,...permissions('edit')});if(!current(version))return;detail(result.photo);status('可见范围已更新。');signature='';}
    catch(e){if(current(version))status((e as Error).message,true);}
    finally{if(current(version)){busy=false;controls();await refresh(true);}}
  };
  $('album-delete').onclick=()=>{$('album-delete-confirm').hidden=false;$('album-share-form').hidden=true;};
  $('album-keep').onclick=()=>{$('album-delete-confirm').hidden=true;$('album-share-form').hidden=false;};
  $('album-confirm-delete').onclick=async()=>{
    if(busy||!selected)return;busy=true;controls();const version=epoch;
    try{await request('album-photo',{action:'delete',id:selected.id});if(!current(version))return;selected=null;$('album-full').replaceChildren();pane('browse');status('照片已删除。');signature='';}
    catch(e){if(current(version))status((e as Error).message,true);}
    finally{if(current(version)){busy=false;controls();await refresh(true);}}
  };
  bridge.game.events.once('destroy',()=>{clean();dialog.remove();button.remove();});
  return {reset(){dialog.close();clean();}};
}
