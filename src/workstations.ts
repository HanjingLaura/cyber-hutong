import assigned from '../shared/workstations.json';
export function canWorkAt(role:string,room:string,seat:string|null){
 return !!seat&&(assigned as Record<string,Record<string,string>>)[room]?.[role]===seat;
}
