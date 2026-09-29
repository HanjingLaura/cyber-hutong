import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bailianComplete } from '../src/server/bailian.mjs';
import { createApp } from '../src/server/app.mjs';
import { loadEnv } from '../src/server/env.mjs';
import { openStore } from '../src/server/store.mjs';

const root = process.cwd();
loadEnv(join(root, '.env'));

const dataDir = process.env.VERCEL ? '/tmp/cyber-hutong' : join(root, 'data');
mkdirSync(dataDir, { recursive: true });

const model = process.env.BAILIAN_MODEL?.trim() || 'qwen-turbo';
const store = openStore(join(dataDir, 'cyber-hutong.sqlite'));
const codes = store.ensureRoster(join(dataDir, 'claim-codes.txt'));
// Claim codes must not be printed into deployment logs.

const basePath = '/cyber-hutong';
const server = createApp({
  store,
  maxTurns: clampTurns(process.env.CHAT_AUTO_TURNS),
  llm: { configured: Boolean(process.env.DASHSCOPE_API_KEY?.trim()), model },
  clientDir: join(root, 'src', 'client'),
  characterDir: join(root, 'characters'),
  loginBackground: join(root, 'examples', 'login', 'login-office-background.png'),
  sceneFile: join(root, 'assets', 'scenes', 'cyber-hutong-empty-view-1-office-faithful-v2-1280x720.png'),
  sceneFiles: {
    '/scenes/hutong.png': join(root, 'assets', 'scenes', 'cyber-hutong-empty-view-1-office-faithful-v2-1280x720.png'),
    '/scenes/hutong-reverse.png': join(root, 'assets', 'scenes', 'cyber-hutong-empty-view-2-office-faithful-v2-1280x720.png'),
    '/scenes/rest-area.png': join(root, 'assets', 'scenes', 'rest-area-v2-1280x720.png'),
    '/scenes/elevator.png': join(root, 'assets', 'scenes', 'elevator-lobby-1280x720.png'),
    '/scenes/restroom.png': join(root, 'assets', 'scenes', 'office-restroom-4-stalls-2-sinks-v2-1280x720.png'),
    '/scenes/popmart.png': join(root, 'assets', 'scenes', 'popmart-store-1280x720.png'),
    '/scenes/concert.png': join(root, 'assets', 'scenes', 'concert-arena-v2-1280x720.png'),
    '/scenes/hawaii.png': join(root, 'assets', 'scenes', 'hawaii-room-empty-v3-1280x720.png'),
    '/scenes/gym.png': join(root, 'assets', 'scenes', 'office-gym-1280x720.png'),
    '/scenes/mixian.png': join(root, 'assets', 'scenes', 'mixian-restaurant-1280x720.png'),
  },
  npcDir: join(root, 'assets', 'npcs'),
  basePath,
  complete: (prompt) => bailianComplete(prompt, {
    apiKey: process.env.DASHSCOPE_API_KEY ?? '',
    baseUrl: process.env.BAILIAN_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model,
    enableThinking: process.env.BAILIAN_ENABLE_THINKING === '1',
    maxTokens: Number(process.env.BAILIAN_MAX_TOKENS || 120),
  }),
});

export default function handler(req, res) {
  const raw = req.url || '/';
  const split = raw.indexOf('?');
  const path = split === -1 ? raw : raw.slice(0, split);
  const query = split === -1 ? '' : raw.slice(split);
  const stripped = path === basePath || path.startsWith(`${basePath}/`) ? (path.slice(basePath.length) || '/') : path;
  req.url = `${stripped}${query}`;
  server.emit('request', req, res);
}

function clampTurns(value) {
  const turns = Number(value || 4);
  if (!Number.isFinite(turns)) return 4;
  return Math.max(1, Math.min(6, turns));
}
