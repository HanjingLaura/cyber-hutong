import designs from '../shared/memory-tickets.json';

export type TicketRole = keyof typeof designs;
export const ticketRoles = Object.keys(designs) as TicketRole[];
const atlases = [
 new URL('../assets/tickets/portraits-1.png', import.meta.url).href,
 new URL('../assets/tickets/portraits-2.png', import.meta.url).href,
];
export function ticketDesign(role: string | undefined) {
 return role && Object.hasOwn(designs, role) ? designs[role as TicketRole] : null;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const plane = '<path d="M0 12h16L8 0h8l16 12h12v8H32L16 32H8l8-12H0z"/>';

/** All identity and travel fields come from the role manifest, never arbitrary HTML. */
export function ticketSvg(role: TicketRole, atlas: string): string {
 const d = designs[role], x = d.tile % 2 * 100, y = Math.floor(d.tile / 2) * 100;
 const text = (x:number,y:number,size:number,value:string,extra='') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escape(value)}</text>`;
 const fields = [['PASSENGER',d.passenger,320],['FLIGHT',d.flight,480],['GATE',d.gate,574],['SEAT',d.seat,650],['BOARDING','13:30',728],['DATE','10.10.2026',822]] as const;
 const bars = Array.from({length:44},(_,i)=>`<rect x="936" y="${100+i*3}" width="${i%3===0?37:45}" height="${i%4===0?2:1}"/>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="336" viewBox="0 0 1000 336" role="img" aria-label="${escape(d.passenger)} boarding pass">
 <rect width="1000" height="336" fill="${d.paper}"/>
 <svg x="4" y="4" width="292" height="328" viewBox="${x} ${y} 100 100" preserveAspectRatio="xMidYMid slice"><image width="200" height="200" href="${escape(atlas)}" style="image-rendering:pixelated"/></svg>
 <rect x="920" y="4" width="76" height="328" fill="${d.accent}"/>
 <g fill="${d.ink}" font-family="Consolas,monospace" font-weight="bold">
 <g transform="translate(320 28) scale(.85)">${plane}</g>
 ${text(368,55,36,'TTC AIR')}${text(320,76,12,'true talent connect','letter-spacing="2"')}
 ${text(900,38,17,'BOARDING PASS','text-anchor="end"')}${text(900,60,12,'FLY FURTHER','text-anchor="end"')}${text(900,76,12,'BE KINDER','text-anchor="end"')}
 ${text(320,163,53,'Human')}${text(320,194,24,'2026')}
 <g transform="translate(563 137) scale(1.15)">${plane}</g>
 ${text(705,163,53,'Agent')}${text(705,194,24,'2027')}
 <path d="M320 212H900" stroke="${d.ink}" stroke-width="2"/>
 ${fields.map(([label,value,x])=>text(x,236,10,label)+text(x,260,label==='PASSENGER'?17:label==='DATE'?12:15,value??'—')).join('')}
 ${text(320,308,11,'SAME SKY A BRIGHTER YOU')}${text(900,308,11,'Q3 SPECIAL EDITION','text-anchor="end"')}
 ${text(958,40,21,'TTC','text-anchor="middle"')}${text(958,62,21,'AIR','text-anchor="middle"')}
 <g transform="translate(945 71) scale(.6)">${plane}</g>${bars}
 ${text(958,255,10,'TRAVEL','text-anchor="middle"')}${text(958,269,10,'BRIGHTER','text-anchor="middle"')}
 <path d="M948 286h8v4h4v-4h8v4h4v8h-4v4h-4v4h-4v4h-4v-4h-4v-4h-4v-4h-4v-8h4z"/>
 </g><path d="M916 4v328" stroke="${d.ink}" stroke-width="2" stroke-dasharray="5 5"/>
 <path d="M8 2H992v4h6v326h-6v2H8v-2H2V6h6z" fill="none" stroke="${d.ink}" stroke-width="4"/>
 </svg>`;
}

const atlasData = new Map<number,Promise<string>>();
export function loadTicketAtlas(role: TicketRole): Promise<string> {
 const index = designs[role].atlas;
 if (!atlasData.has(index)) {
  const pending = fetch(atlases[index]).then(async response => {
   if (!response.ok) throw Error('票面图片加载失败，请重试');
   const blob = await response.blob();
   return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('票面图片读取失败'));reader.readAsDataURL(blob);});
  }).catch(error=>{atlasData.delete(index);throw error;});
  atlasData.set(index,pending);
 }
 return atlasData.get(index)!;
}
