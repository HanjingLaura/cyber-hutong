import { defineConfig } from 'vite';

// Production is served under https://hanjing-laura.vercel.app/cyber-hutong/ (override with HUTONG_BASE=/).
export default defineConfig(({ command }) => ({
  base: process.env.HUTONG_BASE ?? (command === 'build' ? '/cyber-hutong/' : '/'),
  plugins: [{ name: 'moles-entry', configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.split('?')[0].match(/^\/moles\/?$/)) req.url = req.url.replace(/^\/moles\/?/, '/moles.html');
      next();
    });
  }, configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.split('?')[0].match(/^\/moles\/?$/)) req.url = req.url.replace(/^\/moles\/?/, '/moles.html');
      next();
    });
  } }],
  build: { rollupOptions: { input: { game: 'index.html', moles: 'moles.html', members: 'members.html' } } },
  server: {
    proxy: { '/api': { target:'http://127.0.0.1:8788',changeOrigin:false } },
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/references/private/**', '**/server/album-seeds/**'] },
  },
}));
