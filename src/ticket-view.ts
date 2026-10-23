import './ticket-view.css';
import {restoreWorldFocus} from './world-focus';
import {loadTicketAtlas,ticketDesign,ticketSvg,type TicketRole} from './ticket-art';

/** A role selects one passenger/art pairing, including previously collected tickets. */
export function showMemoryTicket(ticket:{person?:string;role?:string}) {
 const design=ticketDesign(ticket.role);if(!design)return;
 const role=ticket.role as TicketRole;
 let dialog=document.querySelector<HTMLDialogElement>('#memory-ticket');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='memory-ticket';dialog.className='social-dialog memory-ticket';dialog.setAttribute('aria-labelledby','memory-ticket-title');(document.querySelector('.world')??document.body).append(dialog);}
 const d=dialog,previous=document.activeElement as HTMLElement|null;d.replaceChildren();
 const h=document.createElement('h2');h.id='memory-ticket-title';h.textContent=`${design.passenger} 的纪念票`;
 const note=document.createElement('p');note.className='ticket-note';note.textContent='Google 总结会 · 2026.10.10 · 已收入你的收藏';
 const viewport=document.createElement('div');viewport.className='ticket-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','纪念票，窄屏可左右滑动查看完整票面');
 const status=document.createElement('p');status.className='ticket-status';status.setAttribute('role','status');
 const actions=document.createElement('div');actions.className='ticket-actions';
 const save=document.createElement('button');save.textContent='保存票面图片';save.disabled=true;
 const close=document.createElement('button');close.textContent='收好纪念票';close.autofocus=true;close.onclick=()=>d.close();
 actions.append(save,close);d.append(h,note,viewport,status,actions);
 let url:string|undefined;
 const release=()=>{if(url)URL.revokeObjectURL(url);restoreWorldFocus(d,previous);};d.addEventListener('close',release,{once:true});
 const load=async()=>{
  status.textContent='正在展开你的纪念票…';
  try {
   const atlas=await loadTicketAtlas(role);if(!h.isConnected||!d.open)return;
   url=URL.createObjectURL(new Blob([ticketSvg(role,atlas)],{type:'image/svg+xml'}));
   const art=new Image();art.alt=`${design.passenger} · ${design.flight} · 登机口 ${design.gate} · 座位 ${design.seat} · Human 2026 → Agent 2027`;art.width=1000;art.height=336;art.src=url;await art.decode();
   if(!h.isConnected||!d.open)return;
   viewport.replaceChildren(art);status.textContent='同一片天空，更好的你。手机上可左右滑动查看完整票面。';save.disabled=false;
   save.onclick=async()=>{
    save.disabled=true;
    try {
     const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=672;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法保存图片');ctx.imageSmoothingEnabled=false;ctx.drawImage(art,0,0,2000,672);
     const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('无法保存图片')),'image/png'));
     const download=URL.createObjectURL(blob),a=document.createElement('a');a.href=download;a.download=`${design.passenger.replace(/ /g,'-')}-TTC-2026.png`;a.click();setTimeout(()=>URL.revokeObjectURL(download),1000);status.textContent='票面图片已生成，可以保存。';
    }catch{status.textContent='图片保存失败，请重试。';}finally{save.disabled=false;}
   };
  }catch{
   if(!h.isConnected||!d.open)return;status.textContent='票面暂时没展开，领取记录已保存。';
   const retry=document.createElement('button');retry.textContent='重新加载票面';retry.onclick=()=>void load();viewport.replaceChildren(retry);if(url){URL.revokeObjectURL(url);url=undefined;}
  }
 };
 if(!d.open)d.showModal();void load();
}
