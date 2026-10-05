// Separate from the existing blind-box save: old collections remain intact.
const key='hutong-popmart-gacha-v1';
function load():number[]{
  try { const value=JSON.parse(localStorage.getItem(key)??'null');
    if(Array.isArray(value)&&value.length===6&&value.every(n=>Number.isSafeInteger(n)&&n>=0))return value;
  } catch { /* An unavailable or invalid save starts an empty collection. */ }
  return [0,0,0,0,0,0];
}
export const gacha={
  counts:load(),
  draw(){const bytes=new Uint32Array(1);do{crypto.getRandomValues(bytes);}while(bytes[0]>=4294967292);return bytes[0]%6;},
  collect(toy:number){this.counts[toy]++;try{localStorage.setItem(key,JSON.stringify(this.counts));}catch{/* Still collectible for this session. */}}
};
