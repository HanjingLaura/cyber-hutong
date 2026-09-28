# MVP 行为模块（第一部分代码）

零第三方依赖，ES modules。建议在项目当前 Node LTS 环境运行：

```sh
node --test engine.test.mjs
```

`config.mjs` 包含八人对应、座位、偏好、相遇规则与送咖啡窗口；`engine.mjs` 输出游戏命令，供服务端接入，不是完整游戏。

接法：创建一个共享 BehaviorEngine；连接角色时 setMode(manual)，离线/托管切换 auto；实际跨场景成功后 enter；定时调用 tick(Date.now())。manualOverride 必须在本人主动移动前调用，返回的 cancel_event 要停止排队移动并释放资源。寻路器完成合法交互后调用 coffeeReached / invitationReached，不能信任客户端上报“已到达”。

消费返回的命令：spawn/despawn/say 为表现；move 接服务端寻路；invite 展示接受/拒绝；acquire_coffee/deliver_coffee 接道具系统；cancel_event 清理关联道具与移动；request_group_transfer 验证地图出口后转场。咖啡统一放到 Sid 桌面，notifyNow 表示是否当场提示。地图 target ID 需要配置 coffee_machine、gather_point 以及八个座位。目的地未知时 destination_unconfigured 显示待配置提示，保留角色在电梯间。

snapshot() 可 JSON 序列化，构造函数可恢复。**接入时必须在同一数据库事务中保存快照变更与待发命令（outbox），消费者按事件 ID＋命令类型去重**，否则进程在状态改变后、命令发送前退出会丢失动作。当前仅实现内存与快照层，没有数据库/outbox。仅适用单一权威服务实例。

已实现：座位/角色配置、三种专属相遇、Celine 台词条件、偏好选择、早晚咖啡步骤/去重、手动接管、邀请与集合、可选 Laura 拒绝/超时。

待接入：账号登录/注册、Canvas 和素材处理、寻路与碰撞、交互距离校验、数据库事务与 outbox、活动持续时间/结束回调、低频随机调度（Celine 访问、Hawaii 邀请、结伴）、NPC 重入冷却和对白 UI。proposeActivity 只选活动，不自动执行。invite 由低频调度器调用，尚未内置随机频率/冷却。Celine 的访问与返回由调度器安排，enter 负责台词判定。已接受邀请的执行需在消费端再次验证目标 NPC 在场。

此代码是交给其他 agent 接续的模块，不包含 AI 调用。对照 ../../docs/handoff/cyber-hutong-character-events.md 和 ../../docs/handoff/cyber-hutong-mvp-handoff.md 继续完成。
