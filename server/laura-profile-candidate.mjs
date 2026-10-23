import profile from './agent-personas/laura.json' with {type:'json'};

// Legacy isolated-store fixtures keep their unconfirmed candidate semantics.
// Live servers use the authoritative backend directory instead.
export function lauraProfileCandidate(){
 const candidate=structuredClone(profile);return {...candidate,revision:0,confirmed:false,enabled:false,updatedAt:0};
}
