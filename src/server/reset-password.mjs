// Run locally after verifying the member's identity. Never expose as a public endpoint.
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { openAuthStore } from './auth-store.mjs';
import { loadEnv } from './env.mjs';
loadEnv(fileURLToPath(new URL('../../.env', import.meta.url)));
const name=process.argv[2];
if(!name){console.error('Usage: node src/server/reset-password.mjs NAME');process.exit(1);}
const remote = Boolean(process.env.TURSO_DATABASE_URL);
if (!remote && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
  throw new Error('Production password recovery requires the persistent auth database');
}
const store = remote
  ? await openAuthStore({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : openStore(fileURLToPath(new URL('../../data/cyber-hutong.sqlite',import.meta.url)));
try { console.log(await store.issueReset(name)); } finally { store.close(); }
