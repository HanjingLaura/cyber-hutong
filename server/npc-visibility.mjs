// Who sees an easter egg. 'always': everyone in the room. 'working': only while the owner works at their own desk there.
export function npcVisible(rule,actors,desks){
 if(rule.condition==='always')return true;
 if(rule.condition==='working')return actors.some(a=>a.role===rule.owner&&a.scene===rule.room&&a.activity==='working'&&!!a.seat&&desks[a.scene]?.[a.role]===a.seat);
 return false;
}
export const visibleNpcs=(rules,actors,desks)=>rules.filter(rule=>npcVisible(rule,actors,desks));
