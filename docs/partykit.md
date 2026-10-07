# PartyKit / PartyServer 多人同步

房间负责**可见性**：在线状态与角色位置/朝向/场景。物品领取、聊天持久化、注册登录、座位与设备租用的权威校验仍走 Vercel/Node 上的 `/api` + SQLite/Turso。

> 托管平台 `*.partykit.dev` 已触及 Cloudflare 自定义域名上限（10k），**新项目请部署到自己的 Cloudflare 账号**（PartyServer + Wrangler → `*.workers.dev`）。

| 通道 | 权威内容 |
|---|---|
| PartyServer WebSocket | 其他玩家位置、在线列表（房间 `hutong-main`） |
| HTTP `/api/presence` | 座位/速度校验、位置落库、活动记录（仍保留） |
| SSE `/api/events` | 聊天、物品、物件、背包、roster、离线 agent 快照 |

未配置 `VITE_PARTYKIT_HOST` 时客户端自动退回仅 SSE（单实例仍可玩）。

## 协议（尽量小）

- `hello`：带 `/api/party-ticket` 签发的短时 ticket + 可选初始 pose
- `state`：房间快照（players / online / you.controller）
- `move`：`x,y,scene,facing,moving,seat,hand,activity`
- `presence`：join / leave / update
- `ping` / `pong`
- `reject` / `control`：拒绝或控制权变更

连接时校验 ticket（HMAC，`PARTY_AUTH_SECRET`）。未登录/无效会话不能进权威房间。同账号多窗口：与现有一致——一控多看；`controller:true` 的 hello 会接管。

客户端连接参数：`party: "hutong"`（对应 Durable Object 绑定名）、`room: "hutong-main"`。

## 本地两窗口验收

1. `npm install`
2. 复制 `.env.example` → `.env.local`，填 `PARTY_AUTH_SECRET`（与生产一致更佳）
3. `npx wrangler secret put PARTY_AUTH_SECRET`（本地可用 `.dev.vars`：`PARTY_AUTH_SECRET=...`）
4. `npm run dev`（API + Vite + `wrangler dev` 在 1999）
5. 两个浏览器窗口登录不同角色，同一场景走动应能看到对方；状态含 `PartyKit`

## 部署到自己的 Cloudflare

```powershell
# 1. 登录 Cloudflare（一次）
npx wrangler login

# 2. 写入与 Vercel Production 相同的 HMAC 密钥
npm run party:secret
# 粘贴 PARTY_AUTH_SECRET

# 3. 部署
npm run deploy:party
# 输出形如：https://cyber-hutong-party.<account>.workers.dev
```

记下主机名（**不要**带 `https://`），例如：

`cyber-hutong-party.<account>.workers.dev`

### Vercel 环境变量

| 名称 | 用途 |
|---|---|
| `PARTY_AUTH_SECRET` | 与 Worker 共享的 HMAC 密钥 |
| `VITE_PARTYKIT_HOST` | **构建时**写入前端，如 `cyber-hutong-party.<account>.workers.dev` |
| `PARTYKIT_HOST` | 可选，写入 `/api/party-ticket` 响应便于排查 |
| `PARTY_ROOM` | 可选，默认 `hutong-main` |

改 `VITE_*` 后需重新部署前端。

### Worker 密钥 / 变量

| 名称 | 用途 |
|---|---|
| `PARTY_AUTH_SECRET`（secret） | 校验 join ticket |
| `PARTY_CORS_ORIGINS`（var） | 允许的浏览器 Origin，逗号分隔 |

## 已知限制

- 断线后 PartySocket 会自动重连并重新 `hello`；长时间断线可能丢短暂 pose，以重连快照为准。
- 跨 scene：房间接受客户端 scene 字段；真正切房副作用仍靠 `/api/transition`。
- 离线 agent / Celine 仍在 API 内存；**房间覆盖真人位置**，SSE `offline` agent 仍可显示。
- 座位互斥与设备租用仍以 HTTP 为准；房间只做表现同步。
- 未配置 `VITE_PARTYKIT_HOST` 时，多人可见性仍受 Vercel 多实例内存隔离限制。
