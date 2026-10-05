const art:Record<string,string>={
 hutong:new URL('../assets/maps/hutong.png',import.meta.url).href,
 hawaii:new URL('../assets/maps/hawaii.png',import.meta.url).href,
 rest:new URL('../assets/maps/rest.png',import.meta.url).href,
 pop:new URL('../assets/drafts/popmart-store-v3.png',import.meta.url).href,
 bathroom:new URL('../assets/drafts/bathroom-room-v4.png',import.meta.url).href,
 concert:new URL('../assets/drafts/concert-room-v4.png',import.meta.url).href,
 arcade:new URL('../assets/drafts/arcade-room-v3.png',import.meta.url).href,
 noodle:new URL('../assets/drafts/noodle-room-v3.png',import.meta.url).href,
 gym:new URL('../assets/drafts/gym-room-v1.png',import.meta.url).href,
 dance:new URL('../assets/drafts/dance-room-v1.png',import.meta.url).href,
 perler:new URL('../assets/drafts/perler-shop-v2.png',import.meta.url).href,
 rehearsal:new URL('../assets/drafts/rehearsal-room-v1.png',import.meta.url).href,
 elevator:new URL('../assets/drafts/elevator-lobby-v1.png',import.meta.url).href,
 subway:new URL('../assets/drafts/wudaokou-station-v1.png',import.meta.url).href,
};
export function roomArt(key:string){return art[key];}
