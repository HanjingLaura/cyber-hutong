/** Resume play after a panel closes, without taking focus from newer UI. */
export function restoreWorldFocus(closed:HTMLElement,opener?:HTMLElement|null){
 if(document.querySelector('dialog[open]'))return;
 const active=document.activeElement,world=document.querySelector<HTMLElement>('.world');
 if(!active||active===document.body||active===world||active===opener||closed.contains(active)||!active.isConnected)world?.focus();
}

/** Native Escape and explicit close buttons share the same focus recovery. */
export function bindDialogFocus(dialog:HTMLDialogElement,opener:()=>HTMLElement|null){
 dialog.addEventListener('close',()=>restoreWorldFocus(dialog,opener()));
}
