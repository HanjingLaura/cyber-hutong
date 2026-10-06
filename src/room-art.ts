const art:Record<string,string>={
 // Map cards use the compact 640×360 previews — not full room drafts.
 hutong:new URL('../assets/maps/memories/hutong.png',import.meta.url).href,
 hawaii:new URL('../assets/maps/memories/hawaii.png',import.meta.url).href,
 rest:new URL('../assets/maps/memories/rest.png',import.meta.url).href,
 pop:new URL('../assets/maps/memories/pop.png',import.meta.url).href,
 bathroom:new URL('../assets/maps/memories/bathroom.png',import.meta.url).href,
 concert:new URL('../assets/maps/memories/concert.png',import.meta.url).href,
 arcade:new URL('../assets/maps/memories/arcade.png',import.meta.url).href,
 noodle:new URL('../assets/maps/memories/noodle.png',import.meta.url).href,
 gym:new URL('../assets/maps/memories/gym.png',import.meta.url).href,
 dance:new URL('../assets/maps/memories/dance.png',import.meta.url).href,
 perler:new URL('../assets/maps/memories/perler.png',import.meta.url).href,
 rehearsal:new URL('../assets/maps/memories/rehearsal.png',import.meta.url).href,
 elevator:new URL('../assets/maps/memories/elevator.png',import.meta.url).href,
 subway:new URL('../assets/maps/memories/subway.png',import.meta.url).href,
};
export function roomArt(key:string){return art[key];}
export function allRoomArt(){return Object.values(art);}
