# 米线店八人共桌与素材更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 此处建议当前会话直接执行；执行方式待用户确认。

**Goal:** 八人同时吃饭，明确选碗，能共同点单和帮取，并更新米线店正式素材。
**Architecture:** 保留object动作和原物品，座位与桌面几何提取为共享配置；订单用独立SQLite模块，所有取餐/上桌在原持久化事务中执行。客户端场景只编排独立桌面/订单面板和素材，不扩写全局聊天。
**Tech Stack:** Vite、TypeScript、Phaser、Node node:sqlite、现有PartyKit/SSE/Turso、Chrome。
**Spec:** ../specs/2026-10-20-noodle-social-design.md；用户新增要求“米线店的素材记得更新一下”，本计划将正式背景重生成加入必做范围。

## Global Constraints

- 固定640×360、WASD/E、单窗口；触屏390px，面板内滚动；不改角色素材、不做通用SaaS外壳。
- 保留旧座位0..3、原object入口和六槽餐桌；四个新座位4..7为对侧；无新货币/空碗物品/洗碗任务。
- 模型调用0，离线Agent不自主点餐/用物；保留三件暂缓玩具及所有既有工作区改动，不自动提交无关文件。
- 接入现有控制权、durableRequests、幂等operations和WorldClient失效epoch；结果不明先同步，不能无ID重试。
- 源图在output归档；正式资源审核通过后覆盖canonical，不保留生产旁路final版本。

## Review Focus

- 同槽食物被拿走又换回同名食物：新客户端带expectedObjectVersion，409刷新，不能误吃新碗（任务2）。
- 新增后侧座位操作餐桌：共享几何定义可达边界，既不能因原65像素校验失败，也不能远程全房间拿物（任务1/2）。
- 帮取后取消/离开/手中物改变：订单状态不自动再发食物、不吞现有食物；可显式放弃该帮取项（任务3）。
- 关闭面板同时切场景/开聊天：旧回包不重开、不抢焦点，实例重建后订单可恢复（任务4/5）。
- 改背景后柜台/文字/双侧人物失配：先样张，再看640逻辑画布、桌面和390px；视觉失败再重生成（任务4/5）。

## Task 1: 八座共享几何和角色遮挡

**Files:** 新增shared/noodle.mjs及声明；修改shared/interactions.json、shared/walkability.mjs、src/noodle-shop.ts、src/multiplayer/bridge.ts、src/multiplayer/memory-view.ts。函数`noodleTableReachable(table:number,x:number,y:number):boolean`由共享几何导出；旧0..3锚点不变，新4..7坐在桌后朝前。新增座位具体坐标在现有背景布局样张中冻结，再统一填写共享配置。

- [ ] 添加server/noodle-seating.test.mjs：8个唯一ID，原0..3锚点不变，所有approach可行走、起身点可达，双人争一个座只成功1次；先跑出红测。
- [ ] 从shared配置派生前端seat/table列表、facing与surfaceY，更新同步与回看遮挡；不用额外前端常量表。
- [ ] 跑该测试和既有位置/碰撞测试；隔离Chrome通过真实WASD/E就座/起身，再看对侧桌面遮挡。

## Task 2: 选碗和过期目标防护

**Files:** 新增src/noodle-table.ts，修改src/noodle-shop.ts、server/world.mjs、src/multiplayer/world-client.ts及既有life UI样式。`setupNoodleTable(scene,getState,onAction)`管理本地selectedSlot；object新可选参数`expectedObjectVersion:number`，旧请求缺省仍按原规则处理。

- [ ] 在server/noodle-table.test.mjs写红测：只改选中槽，过期版本409且账户/餐桌不变，同ID不重复消耗，后侧合法距离成功/远处失败，手上吃与桌上吃分开。
- [ ] server/world.mjs在事务内校验expectedObjectVersion，再按既有slot动作执行；餐桌距离改用Task1的noodleTableReachable。
- [ ] 桌面面板先选0..5槽，才显示该食品加料/拿取/吃；空槽显示放下；“吃手里的…”独立。世界物品点击与面板选择共用同一selectedSlot。
- [ ] 跑上述测试；Chrome两碗分别加醋/麻油，模拟一碗被换，确认不会作用到另一份；Esc后直接移动/E。

## Task 3: 共享点餐与帮取

**Files:** 新增server/noodle-orders.mjs及test、src/noodle-orders.ts；修改server/app.mjs、server/world.mjs、src/multiplayer/world-client.ts。接口`createNoodleOrders(store,life,world)`提供`list(scene,now)`、`interact(user,player,input)`；新增`POST /api/noodle-orders/`，action=`save|cancel|pickup|serve|release|dismiss`，均有requestId及订单revision；场景状态加noodleOrders，仅在米线店返回公共角色/订单信息。

- [ ] 红测：每账号最多1张有效单；每单米线1份，可选鸡柳/炸鸡二选一、可乐/冰红茶二选一；跨账号改/撤单403；24h过期按访问处理；8人提交、重建实例读回。
- [ ] SQLite订单行包含id/account/role/table/revision/status/items/createdAt；每项pending→picked→served，记录帮取人；取消与dismiss不删除玩家已有食物。pickup主食仍要求手持碗筷，其他食品要求空手，供餐坐标沿用原柜台。
- [ ] pickup在同一事务发放实际物品并改该订单项；serve校验帮取者和当前手持品类、合法桌位，在同一事务占槽/清手/改served。普通自由取餐及放桌不受订单阻挡；每项只能完成一次。
- [ ] release仅允许该帮取者显式放弃并恢复待取，不自动重发；已完成项不可release。本人取消/改单只涉及尚未完成部分，已有食物照常保留。
- [ ] 添加竞争、双击、已提交丢响应、保存失败回滚、帮取时手中物变动测试。结果不明先GET权威订单，必要时复用原requestId，不发第二个取餐请求。

## Task 4: 米线店美术与点单面板

**Files:** 覆盖assets/drafts/noodle-room-v3.png；新props/noodle-counter-details.png和明确的alpha帧metadata；必要时覆盖products对应食品帧；修改src/noodle-furniture.ts、src/noodle-shop.ts、src/asset-warmup.ts和相关CSS。复用sceneLabels写真实“米线/鸡柳/饮料”文字，复用world-focus关闭恢复。

- [ ] 用imagegen生成店铺背景样张：640×360固定投影，上方柜台/饮料柜位置不变，暖米色墙地、绿/红招牌底板、左上光；不含人物/桌椅/地面假影/伪字，保留两桌八座区域和出口。另生成碗筷托盘、调料托盘、点餐单的小型透明图集，帧按实际alpha识别，禁止等分裁掉细节。
- [ ] 实际看样张和原尺寸帧，经独立判断通过再覆盖；失败保留正式图并重生。食品按14×12等真实目标尺寸审看，仅对不清楚者定向替换，保持握点和类别。
- [ ] 接入两桌共享点单、个人修改/取消、帮取/放弃和明确成功/失败状态；不把诊断/设计文档放产品页面。用同一公共图标按钮和方角面板，非整页长滚动。
- [ ] 保存生成prompt、source/hash、审核证据到output/art-refresh/noodle-social-generation-final.json；更新assets/README.md，刷新米线店合成回看图，不覆写其他场景。

## Task 5: 验收和发布

- [ ] 新增scripts/verify-noodle-social.mjs：8隔离账号、文件SQLite、模型key空、随机端口、hmr:false；实走取餐/就座和前后排离座，验证点单/选碗、抢单、抢物、原生Esc、聊天焦点、离场迟到响应、offline重连<10秒、双窗口接管；记录环境/版本，不记录聊天正文。
- [ ] 检查桌面与390px、地图/回看、旧取餐菜单和旧座位兼容；运行`node --test --test-concurrency=4 server/*.test.mjs`、`npm run build`，新失败必须定位后再发布。
- [ ] 更新真实release与只读smoke期望，跑资源审计；沿用已授权Vercel生产发布并promote，核对线上release、私有人设404、预算未改、全部审核资源hash。保存隔离/生产结果到独立文档；不声称八位本人已试玩。

## Self-review

覆盖spec的八座/选碗/订单/素材/重连与幂等；额外明确主食碗筷要求，修正“每次空手”的概括与既有规则冲突。新增座位不改变旧ID；订单服务不需要咖啡接口。任务4必须完成真实素材更新。建议当前会话直接执行，结束后做一次独立复核；用户确认计划前不写产品代码。
