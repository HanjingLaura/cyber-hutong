# 八人并发修复与验证

基于 GitHub main `3bfb6c3`，目标为八个真人同时玩，兼顾每人最多四个窗口。

## 修复

- PartyKit 保持约 10 Hz 实时移动；健康时普通 HTTP 位置存档降到约 1 Hz。互动前仍强制确认最新位置，同一客户端的位置请求不会重叠。
- Party 连接合并，旧 socket 回调无法影响新连接；收到认证快照后才允许移动；健康连接不因 ticket 到期定期重建。观看窗口能在主窗口关闭后接管。
- SSE 普通移动发紧凑 `pose`，完整 `world` 约每秒一次；玩法变更仍即时发完整状态。多个窗口共享同一账号的状态构建，每个窗口单独判定控制权。紧凑包不含背包、收藏、经历等个人状态。
- 云端拉取合并并发请求；HTTP presence 复用 250 ms 内的拉取结果。写入按捕获的 generation 确认，保留写入期间产生的新改动。
- 连续写入的后续批次重新排队，让等候的读取先执行；共同 flush promise 仍等待后续写入完成。某条待写本地记录不再阻塞无关消息和账号同步。
- HTTP 请求和响应体都有超时，presence 为 8 秒，其他请求为 15 秒；失败不再无限阻塞后续互动。SSE 暂断时健康 Party 连接继续同步；HTTP 偶发失败不重建健康 SSE。
- 存档缓存按进度版本失效，其他实例写入后能刷新。

## 可重复验证

```powershell
npm run test:concurrency
node --test --test-timeout=120000 server/*.test.mjs
npm run build
$env:HUTONG_SOAK_SECONDS='60'
npm run test:soak
npm run test:benchmark
```

压测是真正的八路并发请求，每 100 ms 一轮，每个账号四条持续读取的 SSE 流。检查八个控制窗口、32 条流持续收取更新，以及个人状态隔离。默认 soak 持续 30 分钟，输出 `output/next-mvp-soak.json`。

2026-10-08，Windows / Node 22.17，本地 60 秒测试：4808 次请求，零错误，八个玩家、32 条连接和八个控制窗口始终保留。请求 P95 **13.1 ms**、P99 **22.6 ms**；更新间隔 P95 **119.8 ms**。此轮期间同时运行过其他验证任务。

单独 8 秒前后对比，每轮均 648 次请求、32 条连接：

| 指标 | 原 server/app.mjs | 修复后 |
| --- | ---: | ---: |
| 请求 P95 | 34.8 ms | 14.9 ms |
| 请求 P99 | 50.9 ms | 38.9 ms |
| 完整 world 事件 | 2400 | 224 |
| 紧凑 pose 事件 | 0 | 2208 |
| 动态 prepare 调用 | 69461 | 4385 |
| SSE 字节/秒 | 856813 | 601131 |

比较仅替换 `server/app.mjs` 为原提交版本，保持辅助模块、依赖和测试条件相同；动态 prepare 数量不是所有已预编译语句的执行总量。结果文件为 `output/concurrency-comparison.json`。

浏览器通过实际构建产物验证：登录、观看窗口禁止操作、主窗口离开后接管、断网后恢复。未引入 UI 样式或页面结构变更。

## 独立审查与部署边界

code-reviewer 结论 APPROVE；architect 结论 WATCH；综合结论 COMMENT。两个审查通道确认本次性能修复的阻断问题已解决。

这些测量覆盖本机 HTTP/SSE，以及模拟传输的 Party 客户端行为，未测量线上 Vercel/Turso 延迟。上线后仍需八台设备同时移动、换房、互动及重连验收。

## 生产部署

实际生产实时域名为 `cyber-hutong-party.hanjinglaura.workers.dev`。Vercel 的 `VITE_PARTYKIT_HOST` 指向这个域名；Vercel API 与 Worker 使用相同的 `PARTY_AUTH_SECRET`，密钥保存在平台，不能提交到 Git。合并到 main 会触发 Vercel 前端/API 部署；实时后端需另行部署：

```powershell
npx --yes wrangler@4.148.0 whoami
npm run deploy:cloudflare
```

`wrangler.jsonc` 保留生产 Worker 名称、账号与 `Hutong` Durable Object 类及绑定，声明现有 SQLite namespace 为 live，不进行删除或重命名；`keep_vars` 保留平台变量。`party/cloudflare.mjs` 将 Cloudflare 生命周期转接给 `party/hutong.ts`，复用同一套认证、移动和接管逻辑。它同时支持客户端默认的 `/parties/main/:room` 和原有 `/parties/hutong/:room`，两种路径进入同一房间。

本地真实 Wrangler / Chrome WebSocket 验证：8 个玩家、32 条连接，10 秒内发送 800 次移动，收到全部 24,800 条广播，两个路由均通过认证，8 个主控窗口关闭后全部完成接管。

Vercel API 排除 `dist` 和 `assets` 静态文件，避免把约 138 MiB 的浏览器资源复制进函数。资源仍由 CDN 提供；函数保留 `server`、`shared` 和运行依赖。函数体积与生产 API、资源必须在平台部署后核验，不能把包大小改善直接当作冷启动耗时的测量。

保留的 WATCH：独立 serverless 实例之间仍是行级后写覆盖，不能保证共享物品、座位和设备跨实例的全局互斥。本次修复不改变这一架构边界。
