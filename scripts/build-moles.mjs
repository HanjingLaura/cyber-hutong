import { build } from 'vite';
import { fileURLToPath } from 'node:url';

// Standalone public bundle, so /dishu can be hosted without the office app or its backend.
const root = fileURLToPath(new URL('../', import.meta.url));
await build({ configFile: false, root, base: '/dishu/', build: {
  outDir: 'output/dishu', emptyOutDir: true, rollupOptions: { input: 'moles.html' },
} });
