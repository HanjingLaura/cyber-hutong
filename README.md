# 赛博胡同 · cyber-hutong

公司八个人的像素平行办公室（原 hutong-online）。Vite + Phaser 4 前端，Node 后端（node:http + SSE），
账号、角色领取、玩家同步、聊天、私聊、物品与小游戏；附带独立小游戏「胡同地鼠」。

- 线上：<https://hanjing-laura.vercel.app/cyber-hutong/>（地鼠：`/cyber-hutong/moles`）
- 场景与玩法：[多人 MVP 与边界](docs/playable-mvp.md)、[场景衔接设计](docs/scene-navigation-design.md)
- Vercel 部署、Turso 持久化与限制：[docs/vercel-deploy.md](docs/vercel-deploy.md)
- 胡同地鼠与 Arduino Uno 接线：[docs/hutong-moles.md](docs/hutong-moles.md)

## 本地运行

需要 Node 22.17+（使用 `node:sqlite`）。

```powershell
npm install
npm run dev        # 前端 http://127.0.0.1:5173/ ，后端 8788
```

生产方式：`npm run build` 后 `npm start`，访问 <http://127.0.0.1:8788/cyber-hutong/>。
首次启动会在 `.env.local` 生成内测邀请码 `HUTONG_INVITE`（注册时填写），数据在 `data/mvp.sqlite`。
WASD / 方向键移动，E 互动，Esc 退出，V 切换视角。

## 验证

```powershell
npm test            # 服务端测试（含 Turso 复制层，使用本地 libSQL 文件模拟）
npm run test:moles  # 地鼠模拟验收
npm run build       # tsc + vite build
```

不要提交 `.env*`、`data/`、`*.sqlite`、`references/private/`。仓库只包含游戏运行时实际加载的素材，
生成草稿与旧版素材保存在本地原项目中。
