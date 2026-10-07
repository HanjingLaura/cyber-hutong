import {gachaNames,plushNames} from './gacha-assets';
import type { HeldItem } from './held-item';
export type ItemName = `拼豆·${string}` | `娃娃·${typeof plushNames[number]}` | `扭蛋·${typeof gachaNames[number]}` | '咖啡' | '可乐' | '气泡水' | '薯片' | '面包' | '火腿肠' | '辣条' | '马卡龙' | '蛋糕' | '冰红茶' | '碗筷' | '米线' | '鸡柳' | '炸鸡' | '水';
export const consumables:readonly string[]=['咖啡','可乐','气泡水','薯片','面包','火腿肠','辣条','马卡龙','蛋糕','冰红茶','米线','鸡柳','炸鸡','水'];
export const drinks:readonly string[]=['咖啡','可乐','气泡水','冰红茶','水'];
/** What the item in hand allows: eat/drink it, put it in the backpack, put it in the 收藏 cabinet. */
export function handOptions(hand:string|null|undefined){const edible=!!hand&&consumables.includes(hand);return{edible,verb:edible?(drinks.includes(hand!)?'喝掉':'吃掉'):'',stow:!!hand,collect:!!hand&&!edible&&hand!=='碗筷'};}
export function itemLabel(name:string){return name.startsWith('拼豆·')?'拼豆作品':name;}
export const vendingProducts: ItemName[] = ['可乐', '气泡水', '薯片', '面包', '火腿肠', '辣条'];
// Inventory belongs to the player and survives scene/camera changes.
export const playerInventory: { hand: ItemName | null; noodleSeasoning:string[] } = { hand: null, noodleSeasoning:[] };
export const fridgeDefaults: ItemName[] = ['面包', '马卡龙', '蛋糕'];
export const items: Record<ItemName, HeldItem> = {
 ...Object.fromEntries(gachaNames.map((name,i)=>[`扭蛋·${name}`,{texture:'gacha-toy-'+i,frame:'toy',width:15,height:18,grip:{x:.18,y:.68}}])) as Record<ItemName,HeldItem>,
 ...Object.fromEntries(plushNames.map((name,i)=>[`娃娃·${name}`,{texture:'claw-plush-'+i,frame:'toy',width:15,height:18,grip:{x:.18,y:.68}}])) as Record<ItemName,HeldItem>,
  '水': { texture:'held-water',frame:'bottle',width:6,height:11,grip:{x:-.16,y:.8}},
  '冰红茶': { texture:'product-tea',frame:'__BASE',width:7,height:13,grip:{x:.08,y:.65}},
  '碗筷': { texture:'product-bowl',frame:'__BASE',width:13,height:11,grip:{x:.08,y:.65}},
  '米线': { texture:'product-noodles',frame:'__BASE',width:14,height:12,grip:{x:.08,y:.65}},
  '鸡柳': { texture:'product-chicken-strips',frame:'__BASE',width:11,height:12,grip:{x:.08,y:.65}},
  '炸鸡': { texture:'product-fried-chicken',frame:'__BASE',width:12,height:11,grip:{x:.08,y:.65}},
  '咖啡': { texture: 'rest-kit', frame: 'coffee-cup', width: 10, height: 10, grip: { x: .85, y: .55 } },
  '气泡水': { texture: 'held-water', frame: 'bottle', width: 6, height: 11, grip: { x: -.16, y: .8 } },
  '可乐': { texture: 'product-cola', frame: '__BASE', width: 8, height: 12, grip: { x: .08, y: .65 } },
  '薯片': { texture: 'product-chips', frame: '__BASE', width: 10, height: 12, grip: { x: .08, y: .7 } },
  '面包': { texture: 'product-bread', frame: '__BASE', width: 11, height: 9, grip: { x: .08, y: .65 } },
  '火腿肠': { texture: 'product-sausage', frame: '__BASE', width: 5, height: 13, grip: { x: .08, y: .7 } },
  '马卡龙': { texture: 'product-macaron', frame: '__BASE', width: 10, height: 8, grip: { x: .08, y: .65 } },
  '蛋糕': { texture: 'product-cake', frame: '__BASE', width: 11, height: 10, grip: { x: .08, y: .7 } },
  '辣条': { texture: 'product-spicy', frame: '__BASE', width: 9, height: 12, grip: { x: .08, y: .7 } },
};

