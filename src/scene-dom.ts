import type Phaser from 'phaser';

/** Bind persistent page controls to one scene lifetime. */
export function bindSceneEvent(scene:Phaser.Scene,element:EventTarget|null,type:string,listener:EventListener){
 if(!element)return;
 const handler:EventListener=event=>{if(scene.sys.isActive())listener(event);};
 element.addEventListener(type,handler);
 scene.events.once('shutdown',()=>element.removeEventListener(type,handler));
}

/** Readable lettering follows the canvas without becoming part of the bitmap. */
export function sceneLabels(scene:Phaser.Scene,labels:{text:string;x:number;y:number;width:number;height:number}[]){
 const world=document.querySelector<HTMLElement>('.world');if(!world)return;
 const nodes=labels.map(label=>{const node=document.createElement('span');node.className='scene-sign';node.textContent=label.text;world.append(node);return node;});
 const layout=()=>{const canvas=scene.game.canvas.getBoundingClientRect(),room=world.getBoundingClientRect();labels.forEach((label,i)=>Object.assign(nodes[i].style,{left:`${canvas.left-room.left-world.clientLeft+canvas.width*label.x/640}px`,top:`${canvas.top-room.top-world.clientTop+canvas.height*label.y/360}px`,width:`${canvas.width*label.width/640}px`,height:`${canvas.height*label.height/360}px`}));};
 const observer=new ResizeObserver(layout);observer.observe(world);observer.observe(scene.game.canvas);
 scene.events.on('sleep',()=>nodes.forEach(node=>node.hidden=true));
 scene.events.on('wake',()=>{nodes.forEach(node=>node.hidden=false);layout();});
 scene.events.once('shutdown',()=>{observer.disconnect();nodes.forEach(node=>node.remove());});layout();
}
