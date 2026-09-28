// Run locally after verifying the member's identity. Never expose as a public endpoint.
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
const name=process.argv[2];
if(!name){console.error('Usage: node src/server/reset-password.mjs NAME');process.exit(1);}
const store=openStore(fileURLToPath(new URL('../../data/cyber-hutong.sqlite',import.meta.url)));
try { console.log(store.issueReset(name)); } finally { store.close(); }
