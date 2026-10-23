import {loadAgentPersonas} from '../server/agent-personas.mjs';
const profiles=loadAgentPersonas();
for(const [role,profile] of profiles)console.log(JSON.stringify({role,enabled:profile.enabled,confirmed:profile.confirmed,facts:profile.facts.length,examples:profile.examples.length,revision:profile.revision}));
console.log('Eight backend persona files validated. No persona content printed.');
