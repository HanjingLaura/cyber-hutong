# 场景与输入恢复验收

修复聊天、人物面板按 Esc 后焦点留在 body/按钮，以及设置、背包、收藏、回看原生 Esc 关闭后键盘仍被门控的问题。新增 `world-focus.ts`，关闭事件只在原界面持有焦点时恢复世界焦点；已有新弹窗或聊天输入时保留新焦点。保留物品快捷操作 finally 的上一版恢复逻辑。

真实 Chrome 红测：`output/scene-recovery-1792463481655/verification.json`。六种 Esc 关闭均复现 `keyboardEnabled:false`，焦点停在 BODY 或打开按钮。该轮的按钮移动误报来自测试连续向左撞墙/按 E 坐下，后续测试改为尝试实际可走方向并结束互动。

最终命令：`node scripts/verify-scene-recovery.mjs`，退出码 0。证据：`output/scene-recovery-1792463743648/verification.json`、同目录 `desktop.png`。

- Node v22.17.0、Chrome 155.0.8059.85；基线 revision `d57d36d1f384bef689de56dd688392e345de992a` 加当前工作区改动。
- 独立随机 Vite 7021 / API 7020；文件 SQLite；模型 key、PartyKit host 为空；watch null、HMR false；模型调用断言为 0。
- 六种面板 × 按钮/原生 Esc 12 路径，加全部 20 场景轮换关闭，共 32 次关闭后无需手动 focus 即方向键移动和 E。19 个切换后出口的 E 实际打开地图，其余初始办公室 E 使用真实本地互动。
- 真实 offline/online 后 140 ms 内恢复移动；结束真实 SSE HTTP 响应后 EventSource 自动重连，1738 ms 恢复移动。
- 同账号第二窗口无控制权时不能移动；第二窗口接管、原窗口接回通过。
- transition 503 和服务器已提交但 HTTP 响应丢失，两种故障均恢复到 `app.players` 权威场景，各仅提交一次，随后可再次正常切换。
- 延迟 close 事件不会抢走新弹窗或聊天输入焦点；无浏览器 pageerror。

本次压力/故障准备使用真实地图快捷切换；普通出口寻路仍由原有 `verify-scene-interactions.mjs` 的 20 场景 × 2 验证。本轮不修改场景碰撞、美术、版本标记或部署。构建与完整服务端测试由主任务统一执行。

## Esc 传播补测

命令：`node scripts/verify-scene-recovery.mjs --escape-activity-only`。只测试真实键盘 E 就座、快捷地图准备健身房、方向键走到跑步机后 E 开始跑步，不重复全部场景。

红测 `output/scene-recovery-1792464487511/verification.json`：办公室 L1 / working 和跑步机 run 状态下打开聊天再 Esc，均同时变为 walk。原因是 capture handler 关闭聊天后同步恢复世界焦点，同一个 Esc 继续到场景 bubble handler。

修复只在确实关闭侧面板且无原生 dialog 打开时消费这次 Esc；原生 dialog 的默认 cancel 保留。绿测 `output/scene-recovery-1792464538478/verification.json`，退出码 0：第一次 Esc 只关闭聊天并保持 L1 / working 或 run；第二次 Esc 才结束活动；随后无需手动 focus 即恢复方向键移动。零模型调用、独立随机端口、文件 SQLite，浏览器与本地服务均已清理。
