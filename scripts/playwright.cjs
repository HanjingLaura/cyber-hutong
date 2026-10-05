// Resolve Playwright without hardcoding a developer machine path.
const {existsSync} = require('node:fs');
const {join} = require('node:path');
const candidates = [
  process.env.PLAYWRIGHT_PATH,
  'playwright',
  'playwright-core',
  join(__dirname, '../node_modules/playwright'),
  'D:/CodexHome/mcp/node/node_modules/playwright',
].filter(Boolean);
function loadPlaywright() {
  const errors = [];
  for (const candidate of candidates) {
    try {
      if (candidate.includes('/') || candidate.includes('\\')) {
        if (!existsSync(candidate) && !existsSync(candidate + '.js')) continue;
      }
      return require(candidate);
    } catch (e) {
      errors.push(candidate + ': ' + ((e && e.message) || e));
    }
  }
  throw new Error('Playwright not found. Install with `npm i -D playwright` or set PLAYWRIGHT_PATH.\n' + errors.join('\n'));
}
module.exports = {loadPlaywright};
