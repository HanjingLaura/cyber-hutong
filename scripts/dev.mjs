import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

function ensureLocalEnv() {
  const lines = [];
  if (!process.env.PARTY_AUTH_SECRET) {
    const secret = randomBytes(24).toString('base64url');
    process.env.PARTY_AUTH_SECRET = secret;
    lines.push(`PARTY_AUTH_SECRET=${secret}`);
  }
  if (!process.env.VITE_PARTYKIT_HOST) {
    process.env.VITE_PARTYKIT_HOST = '127.0.0.1:1999';
    lines.push('VITE_PARTYKIT_HOST=127.0.0.1:1999');
  }
  if (!process.env.PARTYKIT_HOST) {
    process.env.PARTYKIT_HOST = process.env.VITE_PARTYKIT_HOST;
    lines.push(`PARTYKIT_HOST=${process.env.PARTYKIT_HOST}`);
  }
  if (lines.length) {
    writeFileSync('.env.local', (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '') + (existsSync('.env.local') && !readFileSync('.env.local', 'utf8').endsWith('\n') ? '\n' : '') + lines.join('\n') + '\n', { flag: 'a' });
    console.log('已写入本地 PartyKit 配置到 .env.local');
  }
  writeFileSync('.dev.vars', `PARTY_AUTH_SECRET=${process.env.PARTY_AUTH_SECRET}\n`);
}

ensureLocalEnv();

const env = { ...process.env };
const kids = [];
const start = (args, name) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env });
  kids.push(child);
  child.on('exit', (code) => {
    console.log(`[${name}] exited ${code}`);
    stop();
  });
  return child;
};

const stop = () => {
  for (const child of kids) {
    try { child.kill(); } catch {}
  }
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start(['server/index.mjs'], 'api');
start(['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], 'vite');
start(['node_modules/wrangler/bin/wrangler.js', 'dev', '--port', '1999', '--ip', '127.0.0.1'], 'party');
