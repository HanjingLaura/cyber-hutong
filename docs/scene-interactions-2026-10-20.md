# 全场景互动、关闭与重连复查

版本 `2026-10-20-scene-interactions`；在原有脏工作区继续修复，未提交 Git。主验收使用桌面 Chrome、隔离文件 SQLite，关闭真实模型及 PartyKit；不写生产测试订单。

## 已复现并修复

- 休息室的冰箱、售卖机、桌面和健身房储物窗关闭时抢走新聊天焦点；小游戏、拼豆、盲盒、KTV、纪念票也统一使用已有焦点恢复规则。
- 抓娃娃旧开局/结算响应进入新机器会话，旧等待锁影响新一轮；关闭时释放本地等待状态，旧轮次和新界面隔离。
- 拼豆熨烫/收藏请求返回后修改后来打开的画板；不同账号加载草稿时遗留撤销历史。现在按会话隔离回调，并在替换权威草稿时清理该座位旧撤销记录。
- 盲盒抽取、扭蛋、补货及本地揭晓定时器在关闭/切场景后影响新菜单；失去连接或控制权后等待窗无法退出。现在失效旧请求并关闭过期忙碌窗口。
- KTV 旧点歌控制和 MV 播放 Promise 在关窗、切歌、暂停或重新进场后覆盖新状态。旧 UI/媒体请求不能再释放新请求的锁或阻塞新播放。
- 纪念票、骑乘加入/离开、轮询与驾驶的迟到响应在切场景、换账号、断线或失去控制权后打开旧弹窗、移动角色或恢复骑乘。现在仅对应的有效操作能更新状态。

服务器权威状态、版本校验、食品/奖励幂等与既有租约释放链路保留；不添加模型调用、后台任务、自主物件操作或视觉改版。

## 隔离浏览器与回归证据

- 21 场景、两轮实际步行到出口、E 打开地图、选地点、进入并完成代表性交互：初轮 `output/scene-interactions-1792501416785/verification.json`，42/42。包含座椅、洗手、物件菜单、设备、小游戏、共享门及载具；优盛和 MANNER 此脚本只记录步行，不虚称具备新玩法。
- 通用聊天/人员/设置/背包/收藏/相册的关闭按钮与 Esc、21 场景面板、SSE 重连、多窗口接管、切场景拒绝及丢失已提交响应：`output/scene-recovery-1792501416785/verification.json`。断网恢复 80ms，SSE 恢复 1633ms。
- 修复前 7 个场景弹窗关闭抢焦点记录：`output/scene-recovery-1792501582101/verification.json`。修复后 8 个专属弹窗关闭不抢新聊天焦点，21 场景逐个断网后恢复移动及 E 地图：`output/scene-recovery-1792501780028/verification.json`，最大 193ms，全部不超过 10 秒。直接 showModal 仅为关闭事件竞争夹具，不冒充实际游戏互动。
- 实际 HTTP 延迟故障：拼豆旧保存后继续熨烫/收藏、抓娃娃旧开局后打开扫雷及新轮领奖、KTV 迟到点歌跨场景与新点歌、扭蛋处理中多窗口接管后恢复：`output/activity-async-1792502170781/verification.json`。仅位置使用预置；交互用真实 E、点击、Esc、地图和服务器操作。
- 真实票券和骑乘 HTTP 迟到故障及新操作恢复：`output/place-async-recovery-1792502251048/verification.json`。骑乘服务器先已提交，普通切场景会正确拒绝，因此夹具明确调用服务端离开以模拟旧 ACK 延迟；生产未添加补偿写操作。
- 冰箱失败后再次取放、设备重复 E 只发一个占用请求、旧占用 ACK 不驱动后来访问、新访问设备可用：`output/interaction-recovery-1792502325000/verification.json`。
- 新增 52 项服务端回归，最终完整测试 411/411：`output/scenes-server-tests-release.log`。旧载具测试夹具改为与生产一致的稳定 world 单例及真实连接/控制标记。
- 素材引用审计 0 丢失、0 重复组：`output/scenes-art-audit.log`。
- 整合修复后全场景两轮实际出口再次通过 42/42：`output/scene-interactions-1792502073769/verification.json`；最终类型检查/构建通过：`output/scenes-build-release.log`。独立只读代码复核未发现阻断发布的问题。

本地耗时用于本次隔离环境，不表示生产延迟；没有验证真实 PartyKit 网络或八位本人本轮试玩，结果不混用。生产发布与只读检查完成后记录如下。

## 生产发布

- 已部署并提升到正式域名 `https://hanjing-laura.vercel.app/cyber-hutong/`。部署 ID `dpl_7C82MhxgeXXq35UTjFKyaQ2sTSGa`，不可变地址 `https://cyber-hutong-tzhu8t4hv-hanjinglauras-projects.vercel.app`。
- 正式版本、登录页、后台资料不可公开及模型配置检查通过：`output/production-scene-interactions-1792502737199/verification.json`。
- 素材只读检查通过：`output/production-pixel-art-assets-1792502878165/verification.json`，46 个外部素材哈希匹配、19 个内联素材存在于实际部署脚本。
- 验证脚本修复了关闭浏览器时未使用图片请求 Promise 的未处理拒绝；首次大量并发素材检查有一次单图超时，改为每批 8 张后完整通过，未改变产品资源或客户端加载逻辑。
- 生产检查不登录、不发聊天、不写测试物品/订单、不调用模型。真实多人线上试玩尚未验证。
