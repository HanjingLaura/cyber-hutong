# 全场景切换与恢复检查

版本：`2026-10-21-all-scene-switches`。全部自动负载、故障注入、小游戏与聊天检查都在隔离账号、SQLite和Chrome进行，模型密钥关闭，模型调用为0。生产仅做发布后的只读检查。

## 本轮修复

- 补齐POP MART独立包装、扭蛋机、巴斯；米线店桌椅、点餐/调料/餐具和食品图集；校园路锥；厕所、演唱会、健身房、舞室彩蛋的预加载依赖。缓存、进度与场景创建使用相同纹理键；已预载的彩蛋不再由Phaser重复请求。未重画素材。
- 修复另一个取消失效窗口：素材已缓存、位置确认还在等待时，原取消只中断已完成的素材Promise，仍须等HTTP确认。现在取消会同时退出预提交等待、释放地图和控制锁，旧位置确认迟到也不提交切换。服务器切换提交后的不确定结果继续查询权威位置，避免重复提交或位置错乱。
- 两处问题分别有原代码失败证据：`output/all-scenes-preload-red.log`、`output/all-scenes-checkpoint-cancel-red.log`。对应修复后相关16项测试通过；全量440/440通过：`output/all-scenes-switch-tests.log`。

## 隔离浏览器证据

- 修改前的完整正常路径预检：`output/scene-interactions-1792582600563/verification.json`，21场景各进入两次，42/42完成。角色实际按键走到出口、E开地图再切场景；覆盖出生碰撞、另一玩家可见性、互动结束、输入框焦点、弹窗关闭、坐下起身、载具和小游戏。只有初始站位与观察者为夹具。
- 修复后全部21场景地图/面板/重连复核：`output/scene-recovery-1792582953838/verification.json`。关闭按钮与Esc、新面板和聊天焦点、断网恢复、SSE真正断开重连、多窗口控制权交换、拒绝切换以及提交成功但响应丢失均通过；恢复后无需刷新。该脚本使用地图快捷切换作为故障与重复检查手段，不替代上述正常出口预检。断网恢复82ms，SSE恢复1607ms，仅为本次隔离测量。
- 同一最终场景/重连全链路以真实WebGL渲染（断言renderer=2）复跑通过：`output/scene-recovery-1792583004759/verification.json`；此前检查为Canvas回退，两者均通过。
- 最终五款内置小游戏及慢确认取消：`output/scene-checkpoint-cancel-1792582920266/verification.json`。扫雷、蜘蛛纸牌（含发牌）、抓娃娃、投篮、曲棍球关闭后离开/返回成功；缓存场景等待位置确认时28ms取消，迟到确认没有额外切换请求。首次该浏览器脚本先因拦截器解除顺序失败，修正夹具后通过，未把夹具错误当成产品修复。
- 抓娃娃/拼豆/KTV/扭蛋的迟到响应、关闭与控制权恢复：`output/activity-async-1792582826814/verification.json`，4项通过。
- 票券/载具迟到响应、跨场景返回及重新互动：`output/place-async-recovery-1792582826828/verification.json`，5项通过。
- 失败互动再试、连续E仅一个请求、设备旧响应失效：`output/interaction-recovery-1792582600562/verification.json`，4项通过。

以上没有新增真实LLM请求，不使用生产账号压力测试；本轮未复跑真实PartyKit多人网络与八位本人设备试玩，隔离HTTP/SSE结果不代替那些验收。

## 发布

云端类型检查与构建通过：`output/all-scenes-switch-deploy.log`。部署 `dpl_HKhd1XvsXqPTKwTbgn8iGAdny2mP` 已 promote 到正式域名，日志 `output/all-scenes-switch-promote.log`；不可变地址 `https://cyber-hutong-ixw8czrru-hanjinglauras-projects.vercel.app`。构建后的部署状态查询曾有一次连接失败，随后返回READY，未重复创建业务请求或写生产账号。

正式域名Chrome只读检查通过：`output/production-eight-agents-1792584495431/verification.json`。版本匹配、页面正常、无浏览器错误，模型后台调用关闭，没有生产聊天或测试物品写入。入口 `https://hanjing-laura.vercel.app/cyber-hutong/`。
