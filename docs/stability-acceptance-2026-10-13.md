# 输入、切换与座位稳定性验收

日期：2026-10-13。保留当前人物清单、Boss/脉脉、聊天频道和 Laura 试点；延续已补回的主分支基线。本次按复现、失败回归、修复、真实浏览器验证推进。

## 根因与修改

- 输入：旧门禁查不到 active scene 就直接返回，导致游戏全局 WASD 捕获可能仍开启。现在无场景时也控制全局捕获；绘制前同步门禁，删除 SSE 与退出流程中绕开门禁的键盘 enabled 写入。冷加载、注册/登录、场景暂停和退出后的表单输入已验证。
- 重访：paused scene 的 `run()` 是恢复，不会再次发 create；旧准备流程却等待 create，直到超时。现在只为未创建的场景等待创建。`bridge.apply` 同步碰撞历史与移动计时，避免进入旧房间后被上次访问坐标回拉。
- 坐姿：旧座位校验只看服务器上次坐标的 38px 邻域，未考虑两次上报之间的正常移动。现在结合已有 180px/s 的时间预算检查 approach；瞬间远距离坐下、错误座位、占用和隔间门锁仍被拒绝。服务器时钟回拨时，elapsed 不再出现负数。
- 在线状态：心跳清理曾按旧位置时间直接清空座位，与浏览器在线状态脱节。在线浏览器保留座位，过期浏览器仍正常退休与释放。
- 后端效率：删除控制检查中的重复 startPlayer/位置读取。普通 presence 仍拉取最新提交，但省去额外的全量 positions 权威扫描；明确 checkpoint 与 transition 保留该扫描。
- 请求健壮性：超长请求发送 413 后立刻关闭连接，会在客户端仍上传时重置 TCP，导致旧相册测试反复出现 fetch failed。现在在 writer queue 外丢弃剩余 body，10 秒内结束，响应可正常读取；重复完成受 settled 保护，迟到上传错误不会击穿进程。
- 对齐：手机聊天、人物和邀请面板保持左右对称，移动端覆盖规则移到对应基础规则之后；场景标记和换视角顶边一致。保持既有像素主题。
- 清理：删除废弃 v2 人物元数据和构建器；素材迁移工具改读正式地鼠清单，更新地鼠文档。人物图片没有重绘。

## 浏览器验证

`scripts/verify-stability.mjs` 使用隔离内存后端、实际 Phaser 和 Chrome，不操作真实账号。

已验证：登录/注册输入 asdwASDW；无 active scene 时输入；60 次连续往返；paused 场景重访；强制素材失败后无刷新重试；真实走动坐下；短 SSE 重连保持座位；双窗口接管及关闭后的控制恢复；退出后继续输入。未出现页面错误或 presence/transition 失败响应。

1280px、390px、320px 布局检查：聊天输入和按钮同顶边、同底边，手机聊天左右边距 15px，场景标记/换视角顶部均为 58px，无横向溢出。截图与报告：`output/stability-2026-10-13/`。

最终完整测试（服务端与地鼠）231 项通过、0 失败，正式构建通过；独立复核未发现重要回归，相关专项 15/15 通过。日志为 `output/stability-suite-final.log`、`output/stability-build-final.log`。单机故障验证不等于真人手机与生产多实例长时间试玩全部验收。

## 生产发布

Vercel 生产部署 `dpl_2H5KxWNAvsFEipxeFSBuzemwJkXP` 已 READY，原链接为 https://cyber-hutong.vercel.app/cyber-hutong/ 。通过实际浏览器访问线上 `/cyber-hutong/api/health/`，确认 `ok: true`、`release: 2026-10-13-stability`、`party: true`、模型状态 `ready`。本次前端及 API 均已发布；独立 Party 服务代码没有变更，未另行部署。部署日志：`output/vercel-stability-2026-10-13.log`。
