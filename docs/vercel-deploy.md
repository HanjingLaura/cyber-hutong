# Vercel 部署（/cyber-hutong/）

Vercel 项目 `cyber-hutong`，作品集 `hanjing-laura.vercel.app` 把 `/cyber-hutong/*` 转发到
`https://cyber-hutong.vercel.app/cyber-hutong/*`。

## 结构

- `npm run build` 生成 `dist/`，Vite `base` 为 `/cyber-hutong/`（本地 dev 为 `/`，可用 `HUTONG_BASE=/` 覆盖）。
- 静态资源由 Vercel CDN 提供；`vercel.json` 把 `/cyber-hutong/:path*` 改写到 `dist/` 根，
  因此项目自己的域名根路径 `/` 也能打开游戏。`/cyber-hutong/moles` → `moles.html`。
- `/cyber-hutong/api/*`（以及 `/api/*`）进入函数 `api/index.mjs`，在函数内运行完整的 `server/app.mjs`。
  服务端接受带或不带 `/cyber-hutong` 前缀、带或不带结尾 `/` 的路径（作品集代理会 308 加斜杠，客户端直接请求带斜杠的地址）。
- SSE（`/api/events`）在函数 `maxDuration`（300 秒）之前于 240 秒主动结束（`HUTONG_SSE_MAX_MS`），
  浏览器 EventSource 按 `retry: 1500` 自动重连。

## 持久化（Turso）

游戏服务端仍使用同步的 `node:sqlite`（`/tmp/hutong-online/mvp.sqlite`）。配置了 `TURSO_DATABASE_URL` 时，
`server/replica.mjs`：

1. 冷启动时从 Turso 拉取全部行重建本地库；
2. 通过 TEMP 触发器记录每一行改动，请求结束后（`waitUntil`）及每 1.5 秒推送到 Turso；
3. 每个 API 请求前（登录 / 注册 / me / events 强制，其他最多每 2 秒）拉取其他实例写入的行。

远端只新增两张表：`hutong_online_rows`、`hutong_online_schema`（前缀可用 `HUTONG_TURSO_PREFIX` 改），
不会改动旧的 `hutong_auth_*` / `hutong_places` 表。旧赛博胡同账号不会自动迁移，成员需要用邀请码重新注册。
未配置 Turso 时（本地、PR 预览）使用本地 SQLite；在 Vercel 上它是临时的，实例回收后数据消失。

云端自检（随机隔离表，结束后删除）：
`HUTONG_CLOUD_TEST=1 node --env-file=.env.production.local scripts/verify-turso-replica.mjs`

## 环境变量

| 名称 | 用途 |
|---|---|
| `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN` | 账号与存档持久化（仅 Production） |
| `HUTONG_INVITE` | 内测邀请码；未设置时注册不需要邀请码 |
| `HUTONG_ALLOWED_HOSTS` | 允许的跨站 Origin（作品集域名），用于 POST 来源检查 |
| `DASHSCOPE_API_KEY`（可选 `LLM_MODEL`/`BAILIAN_MODEL`、`LLM_DAILY_LIMIT`） | 百炼大模型；未设置时使用内置回复 |

## 已知限制

- 世界状态（位置、在线、租用设备、Celine、活动导演）仍在每个函数实例的内存里。Fluid compute 下低流量时
  通常同一实例处理所有请求，但不保证；不同实例的玩家可能互相看不到，POST 落到没有 SSE 的实例会提示
  “角色在另一个窗口操作”。真正的八人权威世界仍需要单个常驻 Node 进程（见 `Dockerfile`、`compose.yaml`）。
- Turso 复制是行级“后写覆盖”。并发修改同一行（例如两个实例同时领取同一角色）可能互相覆盖。
- 自增编号（消息、经历）按实例时间偏移以避免冲突，编号会很大但仍是安全整数。
