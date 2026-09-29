import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { bailianComplete } from './bailian.mjs';
import { createApp } from './app.mjs';
import { loadEnv } from './env.mjs';
import { openStore } from './store.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
loadEnv(join(root, '.env'));

const model = process.env.BAILIAN_MODEL?.trim() || 'qwen-turbo';
const store = openStore(join(root, 'data', 'cyber-hutong.sqlite'));
const codes = store.ensureRoster(join(root, 'data', 'claim-codes.txt'));
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
  complete: (prompt) => bailianComplete(prompt, {
    apiKey: process.env.DASHSCOPE_API_KEY ?? '',
    baseUrl: process.env.BAILIAN_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model,
    enableThinking: process.env.BAILIAN_ENABLE_THINKING === '1',
    maxTokens: Number(process.env.BAILIAN_MAX_TOKENS || 120),
  }),
});

const port = Number(process.env.PORT || 8787);
server.listen(port, '127.0.0.1', () => {
  console.log(`赛博胡同私聊  http://127.0.0.1:${port}`);
  console.log(`模型  ${model}  非思考模式`);
  if (!process.env.DASHSCOPE_API_KEY?.trim()) console.log('DASHSCOPE_API_KEY 还是空的。填进 .env 后重启，真人私聊现在就能用。');
  if (codes.written) console.log(`八人领取码已写到 ${codes.file}`);
});

function clampTurns(value) {
  const turns = Number(value || 4);
  if (!Number.isFinite(turns)) return 4;
  return Math.max(1, Math.min(6, turns));
}
