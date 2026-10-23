import type Phaser from 'phaser';
import {sceneLabels} from './scene-dom';

const details=[
 ['noodle-utensil-tray',new URL('../assets/props/noodle-utensil-tray.png',import.meta.url).href],
 ['noodle-condiment-tray',new URL('../assets/props/noodle-condiment-tray.png',import.meta.url).href],
 ['noodle-order-pad',new URL('../assets/props/noodle-order-pad.png',import.meta.url).href],
] as const;
export function preloadNoodleArt(scene:Phaser.Scene){for(const[key,url]of details)if(!scene.textures.exists(key))scene.load.image(key,url);}
/** Canonical prop sprites; player food, seats and orders remain live state. */
export function decorateNoodleShop(scene:Phaser.Scene,openOrder:(table:number)=>void){
 sceneLabels(scene,[{text:'饮料',x:78,y:36,width:41,height:15},{text:'米线',x:231,y:36,width:90,height:16},{text:'鸡柳',x:435,y:36,width:90,height:16}]);
 scene.add.image(155,157,'noodle-utensil-tray').setOrigin(.5,1).setDisplaySize(26,20).setDepth(155);
 for(const[index,x]of [213,439].entries()){
  scene.add.image(x+51,222,'noodle-condiment-tray').setOrigin(.5,1).setDisplaySize(18,14).setDepth(264.1);
  scene.add.image(x+52,247,'noodle-order-pad').setOrigin(.5,1).setDisplaySize(11,13).setDepth(264.4).setInteractive({useHandCursor:true}).on('pointerdown',()=>openOrder(index));
 }
}
