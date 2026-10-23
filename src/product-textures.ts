import Phaser from 'phaser';
import atlas from '../assets/props/products.frames.json';

export const productAtlas={key:'product-atlas',url:new URL('../assets/props/products.png',import.meta.url).href};
export function preloadProductTextures(scene:Phaser.Scene){if(!scene.textures.exists(productAtlas.key))scene.load.image(productAtlas.key,productAtlas.url);}
const products=[['tea',7,13],['bowl',13,11],['noodles',14,12],['chicken-strips',11,12],['fried-chicken',12,11],['vinegar',7,10],['sesame',7,10],['macaron',10,8],['cake',11,10],['cola',8,12],['chips',10,12],['bread',11,9],['sausage',5,13],['spicy',9,12]] as const;

/** One generated atlas supplies world, menu, backpack and held-item images. */
export function registerProductTextures(scene:Phaser.Scene){
 if(!scene.textures.exists(productAtlas.key))return;
 if(products.every(([id])=>scene.textures.exists('product-'+id)))return;
 const frames=atlas.frames;
 const image=scene.textures.get(productAtlas.key).getSourceImage() as HTMLImageElement;
 products.forEach(([id,width,height],index)=>{
  const key='product-'+id;if(scene.textures.exists(key))return;
  const f=frames[index],canvas=document.createElement('canvas');canvas.width=width*3;canvas.height=height*3;
  const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;c.drawImage(image,f.x,f.y,f.width,f.height,0,0,canvas.width,canvas.height);
  scene.textures.addCanvas(key,canvas);
 });
}
