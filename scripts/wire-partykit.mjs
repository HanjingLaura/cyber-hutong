#!/usr/bin/env node
/**
 * After `npm run deploy:party`, wire the printed host into Vercel and rebuild.
 *
 * Usage:
 *   node scripts/wire-partykit.mjs cyber-hutong-party.<account>.workers.dev
 */
const host = (process.argv[2] || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
if (!host || !host.includes('.')) {
  console.error('Usage: node scripts/wire-partykit.mjs <workers-dev-host>');
  console.error('Example: node scripts/wire-partykit.mjs cyber-hutong-party.you.workers.dev');
  process.exit(1);
}
console.log(`Party host: ${host}`);
console.log(`
Set on Vercel (production + preview), then redeploy:
  VITE_PARTYKIT_HOST=${host}
  PARTYKIT_HOST=${host}

Or reply to the Cloud Agent with that host string.
`);
