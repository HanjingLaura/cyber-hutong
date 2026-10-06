#!/usr/bin/env node
/**
 * After `npm run deploy:party`, wire the printed host into Vercel and rebuild.
 *
 * Usage:
 *   node scripts/wire-partykit.mjs cyber-hutong.<account>.partykit.dev
 *
 * Requires: vercel CLI logged in, or Vercel MCP / dashboard to set:
 *   VITE_PARTYKIT_HOST, PARTYKIT_HOST
 * then redeploy production (VITE_* is build-time).
 */
const host = (process.argv[2] || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
if (!host || !host.includes('.')) {
  console.error('Usage: node scripts/wire-partykit.mjs <partykit-host>');
  console.error('Example: node scripts/wire-partykit.mjs cyber-hutong.you.partykit.dev');
  process.exit(1);
}
console.log(`PartyKit host: ${host}`);
console.log(`
Next (Vercel dashboard or CLI):
  vercel env add VITE_PARTYKIT_HOST production   # value: ${host}
  vercel env add PARTYKIT_HOST production        # value: ${host}
  vercel --prod                                  # rebuild so the client embeds VITE_PARTYKIT_HOST

Or tell the Cloud Agent the host string and it will set env + redeploy.
`);
