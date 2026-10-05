import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Export native browser modules for the portfolio's /dishu route; no office backend required.
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = join(root, 'output/dishu-static');
await mkdir(join(destination, 'characters'), { recursive: true });
const metadata = JSON.parse(await readFile(join(root, 'assets/metadata/team-v2.json'), 'utf8'));
const names = ['suki', 'sid', 'jilly', 'laura', 'kay', 'franco', 'cora', 'amber'];
const members = Object.fromEntries(names.map(name => [name, {
  frames: metadata.members[name].frames.filter(frame => frame.name === 'idle-front'),
}]));
await writeFile(join(destination, 'characters.mjs'), `export default ${JSON.stringify({ members })};\n`);
for (const name of names) await copyFile(join(root, `assets/characters/team/v2/${name}.png`), join(destination, `characters/${name}.png`));
for (const file of ['engine.mjs', 'serial.mjs', 'style.css']) await copyFile(join(root, 'src/moles', file), join(destination, file));
let app = await readFile(join(root, 'src/moles/app.js'), 'utf8');
app = app.replace("'../../assets/metadata/team-v2.json'", "'./characters.mjs'")
  .replaceAll('../../assets/characters/team/v2/', './characters/')
  .replace('if (import.meta.env.DEV) window.__moles = { game, uno, frames };', '');
await writeFile(join(destination, 'app.js'), app);
const html = (await readFile(join(root, 'moles.html'), 'utf8'))
  .replace('/src/moles/style.css', '/dishu/style.css').replace('/src/moles/app.js', '/dishu/app.js');
await writeFile(join(destination, 'index.html'), html);
console.log(`Exported ${destination}`);
