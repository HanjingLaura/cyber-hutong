# PartyKit 多人同步

PartyKit 房间负责**可见性**：在线状态与角色位置/朝向/场景。物品领取、聊天持久化、注册登录、座位与设备租用的权威校验仍走 Vercel/Node 上的 `/api` + SQLite/Turso。

| 通道 | 权威内容 |
|---|---|
| PartyKit WebSocket | 其他玩家位置、在线列表（房间 `hutong-main`） |
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

## 本地两窗口验收

1. `npm install` && `npm run dev`（会写 `.env.local` / `.dev.vars` 里的 `PARTY_AUTH_SECRET`，并起 API + Vite + PartyKit）。
2. 打开两个浏览器窗口（或普通 + 无痕）访问 <http://127.0.0.1:5173/>。
3. 用邀请码注册两个不同角色并登录。
4. 在同一场景走动：应能看到对方角色移动；顶部状态含 `PartyKit`。
5. 同账号开第二窗：一窗可操作，另一窗「在另一个窗口操作」，点接管后控制权切换。

## 部署 PartyKit

```powershell
# 登录一次（本机）
npx partykit login

# 把与 Vercel 相同的密钥推到 PartyKit
npx partykit env add PARTY_AUTH_SECRET
# 粘贴与 Vercel Production 相同的值

npm run deploy:party
# 记下输出主机名，形如 cyber-hutong.<account>.partykit.dev
```

### Vercel 环境变量

| 名称 | 用途 |
|---|---|
| `PARTY_AUTH_SECRET` | 与 PartyKit 共享的 HMAC 密钥（必填才能签发 ticket） |
| `VITE_PARTYKIT_HOST` | **构建时**写入前端，如 `cyber-hutong.<account>.partykit.dev`（无 `https://`） |
| `PARTYKIT_HOST` | 可选，写入 `/api/party-ticket` 响应便于排查 |
| `PARTY_ROOM` | 可选，默认 `hutong-main` |

改 `VITE_*` 后需重新 `vercel build` / 重新部署前端。

### PartyKit 环境变量

| 名称 | 用途 |
|---|---|
| `PARTY_AUTH_SECRET` | 与 API 相同，用于校验 join ticket |

## 已知限制

- 断线后 PartySocket 会自动重连并重新 `hello`；长时间断线可能丢短暂 pose，以重连快照为准。
- 跨 scene：PartyKit 接受客户端 scene 字段；真正切房副作用（出口校验）仍靠 `/api/transition`。
- 离线 agent / Celine 导演驱动仍在 API 内存里，暂未写入 PartyKit；双通道并存时 **PartyKit 覆盖真人位置**，SSE `offline` agent 仍可显示。
- 座位互斥与设备租用仍以 HTTP 为准；PartyKit 只做表现同步。
- 未部署 PartyKit 或未设 `VITE_PARTYKIT_HOST` 时，多人可见性仍受 Vercel 多实例内存隔离限制（见 vercel-deploy.md）。
