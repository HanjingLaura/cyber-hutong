# 优盛咖啡窗口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 建议当前会话直接执行；执行方式待用户确认。

**Goal:** 优盛大厦可点单取咖啡，携杯跨场景，并通过现有邀请确认送给朋友。
**Architecture:** 独立coffee订单表和HTTP操作，用现有SQLite/durableRequests原子修改订单与手持物；MemoryPlaceScene只集成窗口模块。礼物仍交给现有life.send/respond，不新增赠送协议。
**Tech Stack:** 现有Vite/Phaser/TypeScript、Node SQLite/Turso、PartyKit/SSE、Chrome。
**Spec:** ../specs/2026-10-20-yousheng-coffee-design.md。

## Global Constraints

- 固定640×360、单窗口、WASD/E、390px可操作，保留原建筑标识/出生点/出口。
- 只用既有“咖啡”item，不加货币、口味、自动索要咖啡、Agent送杯或周期模型调用。
- 接收方主动确认；已有gift的拒绝/取消/过期/手满规则保持。
- SQLite持久化、控制权/同场景距离/账号隔离、requestId幂等和保存后推送必需。
- 素材先样张审查再覆盖canonical，output记录原稿/hash；不触碰三件暂缓玩具或其他脏文件。

## Review Focus

- 同一订单已取后丢响应，新窗口重试不能复制咖啡（任务1）。
- 点单后手上换成别的物品或账号切换，旧响应不能覆盖物品或新账号UI（任务1/2）。
- 从另一场景伪造取杯请求，服务端拒绝且不泄露他人订单（任务1）。
- 保存失败时不能先给杯/推送成功；实例切换后仍能恢复待取单（任务1/3）。
- 杯子外观与现有休息室咖啡不一致、窗口挡出口、Esc抢新聊天焦点（任务2/3）。

## Task 1: 订单、原子取杯和接口

**Files:** 新增shared/coffee.mjs及声明、server/coffee-orders.mjs和server/coffee-orders.test.mjs；修改server/app.mjs。`createCoffeeOrders(store,life)`暴露`self(account)`和`interact(user,player,input)`；共享配置`coffeeWindow={scene:'yousheng',at:[x,y],radius:36}`的xy在Task2门面样张验证后冻结。

- [ ] 红测：POST action=`order|take|cancel`；只读GET只返回本人订单；每账号最多1张待取单，点单需空手且近窗口；取杯需本人的pending订单、当前空手及account revision匹配；错场景/远距离/失控拒绝。
- [ ] SQLite表id/account/status/revision/createdAt/requestId；取杯在同事务更新pending→taken、hand咖啡、account.revision、hand_origins并记录幂等receipt。重复ID返回同一次结果，已取单的新take不发杯，取消单不能take。
- [ ] 接`/api/coffee-orders/`进现有durableRequests与控制权/限流；GET资格和响应归属按账号过滤。结果只返回本人的order/self，绝不在公共玩家快照加入个人订单。
- [ ] 跑8账号并发、双窗口、重复order/take、手满、已提交响应丢失、Turso提交失败回滚、store重开及origin跨场景测试，0新增模型调用。

## Task 2: 美术与窗口交互

**Files:** 新增src/coffee-window.ts、coffee-window.css、assets/props/yousheng-coffee-window.png；修改src/memory-places.ts、src/asset-warmup.ts、必要的咖啡图引用/metadata。`CoffeeWindow(scene)`提供`near(x,y)`、`interact()`、`dispose()`，窗口状态与单次请求意图封装在模块内，不把pending写进整个MemoryPlaceScene。

- [ ] imagegen透明样张：小型外带窗/招牌底板/托盘，像素密度和夜景左上光匹配，放建筑一侧不覆盖现有标志，文字层写“咖啡”“取杯”。先看640×360合成冻结xy，检查出生/出口/过道可走后才写共享配置。
- [ ] 审核通过导入canonical；纸杯若替换现有咖啡外观，同步休息室/手持/菜单/背包全部咖啡引用，不能一个item两套身份。保留其他rest图集帧，禁止用等分裁切破坏旧帧。
- [ ] E开面板：无单“点一杯”，pending“取咖啡/取消”，taken“已取杯”；手满给明确提示。使用现有world-focus及scene绑定，关闭/睡眠/切场景清理请求UI，旧epoch/账号回包不重开或抢焦点。
- [ ] 网络不明先同步self order；同一意图复用requestId。成功后交onlineWorld.receive更新hand，礼物入口仍使用原有gift面板，不新增远程强制送杯。
- [ ] generation-final记录source/hash/独立判断与实机图；审核失败重生成，正式assets不放候选。

## Task 3: 浏览器完整链与发布

- [ ] 新增scripts/verify-coffee-window.mjs：隔离文件SQLite/随机端口/禁用模型。真实走近E点单/取杯→正常出口切场景→原礼物控件发送→接收方确认；同时测拒绝、过期、手满，不吞物/复制物。
- [ ] 覆盖8人各取1杯、重复E、接管、取杯期间断线、重连<10秒、已提交丢响应、保存失败、账号切换/离场迟到回包、Esc后移动与聊天输入保护；服务器重建GET订单一致。
- [ ] 桌面与390px检查窗口、菜单、杯子、出口；复跑原休息室咖啡和gift用例，确认既有玩法未回归。
- [ ] 运行完整服务端测试、`npm run build`、资源审计；通过后按现有授权生产部署/promote，做只读新release/预算/素材hash检查。独立记录隔离通过与线上只读通过，真人试玩保持未验证。

## Self-review

覆盖spec点单/取杯/跨场景/gift复用、幂等、持久化、隐私、手满、素材和可恢复状态。没有向米线订单模块新增依赖，能独立发布。建议当前会话直接执行，最后做一次独立复核；用户确认计划前不写产品代码。
