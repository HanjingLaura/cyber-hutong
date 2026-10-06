// Resolve Playwright without hardcoding a developer machine path.
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.PLAYWRIGHT_PATH,
  'playwright',
  'playwright-core',
  join(here, '../node_modules/playwright'),
  'D:/CodexHome/mcp/node/node_modules/playwright',
].filter(Boolean);

export function loadPlaywright() {
  const errors = [];
  for (const candidate of candidates) {
    try {
      if (candidate.includes('/') || candidate.includes('\\')) {
        if (!existsSync(candidate) && !existsSync(candidate + '.js')) continue;
      }
      return require(candidate);
    } catch (e) {
      errors.push(`${candidate}: ${(e && e.message) || e}`);
    }
  }
  throw new Error('Playwright not found. Install with `npm i -D playwright` or set PLAYWRIGHT_PATH.\n' + errors.join('\n'));
}
