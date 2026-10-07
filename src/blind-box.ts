export const toyNames = ['胡迪', '巴斯', '红心', '海绵宝宝', '派大星', '比奇堡', 'MOLLY', 'DIMOO', 'SKULLPANDA', 'LABUBU'] as const;
export const themes = {
  story: { name: '玩具总动员', members: [0, 1, 2] },
  bikini: { name: '比奇堡', members: [3, 4, 5] },
  classic: { name: 'POP MART 经典 IP', members: [6, 7, 8, 9] },
  all: { name: 'POP MART', members: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
} as const;
export type Theme = keyof typeof themes;
export type Stock = (number | null)[];
export interface ToyRecord { toy: number; source: 'shelf' | 'machine'; theme: Theme; slot: number; at: number }
type ThemeStock = Record<Theme, Stock>;
interface Save { version: 2; shelf: ThemeStock; machine: ThemeStock; collection: ToyRecord[]; legacy: string[] }
const key = 'hutong-popmart-v2';
function randomToy(theme: Theme) {
  const pool = themes[theme].members, bytes = new Uint32Array(1);
  const limit = Math.floor(4294967296 / pool.length) * pool.length;
  let value: number;
  do { crypto.getRandomValues(bytes); value = bytes[0]; } while (value >= limit);
  return pool[value % pool.length];
}
function stock(theme: Theme): Stock { return Array.from({ length: 18 }, () => randomToy(theme)); }
function themeStock(): ThemeStock { return { story: stock('story'), bikini: stock('bikini'), classic: stock('classic'), all: stock('all') }; }
function validStock(value: unknown, theme: Theme): value is Stock {
  return Array.isArray(value) && value.length === 18 && value.every(v => v === null || (themes[theme].members as readonly number[]).includes(v));
}
function load(): Save {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    for (const source of ['shelf','machine']) if (value?.[source] && !value[source].all) value[source].all = stock('all');
    if (value?.version === 2 && ['shelf', 'machine'].every(source => Object.keys(themes).every(theme => validStock(value[source]?.[theme],theme as Theme)))
      && Array.isArray(value.legacy) && value.legacy.every((name:unknown) => typeof name === 'string') && Array.isArray(value.collection)
      && value.collection.every((r:ToyRecord) => r && themes[r.theme] && (themes[r.theme].members as readonly number[]).includes(r.toy) && ['shelf','machine'].includes(r.source) && Number.isInteger(r.slot) && r.slot>=0 && r.slot<18 && Number.isFinite(r.at))) return value;
  } catch { /* Invalid saves start fresh; the old key is never overwritten. */ }
  const legacy: string[] = [];
  try {
    const previous = JSON.parse(localStorage.getItem('hutong-popmart-v1') ?? 'null');
    const names = ['粉色小熊','薄荷小兔','蓝色机器人','橙色小猫','紫色精灵','金色伙伴'];
    if (Array.isArray(previous?.collection)) previous.collection.forEach((r:{toy:number}) => { if(r && Number.isInteger(r.toy) && names[r.toy]) legacy.push(names[r.toy]); });
  } catch { /* Legacy collectibles are optional. */ }
  return { version: 2, shelf: themeStock(), machine: themeStock(), collection: [], legacy };
}
export const blindBoxes = {
  data: load(),
  stock(source:'shelf'|'machine',theme:Theme) { return this.data[source][theme]; },
  save() { try { localStorage.setItem(key,JSON.stringify(this.data)); return true; } catch { return false; } },
  take(source:'shelf'|'machine',theme:Theme,slot:number) {
    const contents=this.stock(source,theme), toy=contents[slot];
    if(toy===null||toy===undefined)return null;
    contents[slot]=null;
    const record:ToyRecord={toy,source,theme,slot,at:Date.now()};
    this.data.collection.push(record);this.save();return record;
  },
  refill(source:'shelf'|'machine',theme:Theme) { this.data[source][theme]=stock(theme);this.save(); },
};
blindBoxes.save();
// Hand-pixelled Q-style figures, one per toy (assets/props/toys/toy-N.png).
const figureUrls=import.meta.glob('../assets/props/toys/toy-*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
let toyImages:string[]=Array.from({length:toyNames.length},(_,i)=>figureUrls[`../assets/props/toys/toy-${i}.png`]);
export function setToyImages(images:string[]) { toyImages=images; }
export function toyImage(toy:number) { return toyImages[toy]; }
