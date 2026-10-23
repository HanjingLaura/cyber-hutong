# 五个新场景与界面优化

用户已确认五道口优盛大厦、Google 总结会、会议室、成府路夜街、北京科技大学校园夜路，及电脑放大界面和米线店家具优化。沿用正式人物素材与像素主题。

## 实现与结构

- `src/memory-places.ts` 统一五个场景的生命周期、移动、座椅和互动；地图、预加载、服务端及 Party 地点均从正式房间清单接入。按生成画面校准雕塑、桌子和八把椅子的碰撞与坐姿位置。
- `src/ride-physics.mjs` 共用有速度、加速、惯性、转向、刹车和碰撞的运动积分。电动车最多驾驶员、前乘客、后乘客；校园滑板支持站姿与 F 坐姿，路线标记可循环挑战。W/↑/Space 加速、S/↓刹车、A/D或左右转向，停稳后 E 下车/下板。
- `server/rides.mjs` 共享车辆一行持久化，独占座位、驾驶权限、速度校验、在线租约和断线释放。持久化场景优先于旧实例的内存场景，防止跨实例误清座。普通 presence 保持服务器骑乘坐标。
- Google 签到台靠近按 E 领取当前角色纪念票，重复领取幂等。票存入收藏，可从背包专用入口和收藏查看。票券文本视图统一于 `src/ticket-view.ts`，不把票当作普通消耗物。
- 电脑显示器改为按比例的六应用网格，保留 Boss、脉脉和原链接，检查桌面、手机及横屏。米线店桌凳改为整数像素绘制的木质纹理，保留原互动坐标；回看同步使用新家具，移除旧透明图集加载及文件。

## 素材来源与生成提示

使用内置 imagegen 制作五个背景和粉色电动车；正式素材存于 `assets/maps/places/` 和 `assets/props/pink-scooter.png`。通过 `scripts/materialize-memory-art.mjs` 规范尺寸。原人物图没有重绘。用户照片作为场景参考；优盛大厦另参考 https://architizer.com/projects/pageone/ 与 https://hk.trip.com/moments/poi-u-center-18175627/ 。

提示集：所有背景均为横向 16:9、640×360 游戏构图、清晰 16-bit 像素风、无人物和界面、前景留足可行走地面。优盛大厦：PAGEONE 暖光玻璃门面、折角穿孔金属外墙、左侧红雕塑及银色底座、夜景树木与铺装广场。Google：双投影屏、讲台、长条顶灯、窗帘、浅灰地板、四把黑椅。会议室：长木桌、四把黑椅、移动电视与白板、右侧落地窗与城市夕阳。街道：成府路夜间路口、公交站、斑马线、信号灯、自行车道与人行道。校园：北京科技大学校园建筑、路灯、树木草地、宽阔平整夜间步道。电动车提示：以用户粉色车照片为参考，右向侧面、浅粉奶油车壳、长黑座垫、黑把手、银轮黑胎、前灯、尾灯、篮筐、透明背景、无人物和车牌文字，适用于小尺寸像素精灵。

## 验证和发布

最终完整测试 247 项通过、0 失败，日志 `output/memory-suite-final.log`；正式构建通过，日志 `output/memory-build-final.log`，最终生产版本 TypeScript/Vite 构建亦通过（`output/vercel-memory-deploy-final.log`）。真实浏览器 15 次新地点切换、票券幂等及背包查看、会议椅稳定、电动车和滑板加速刹车退出通过（`output/memory-browser-final.log`）。三独立浏览器注册 Sid/Laura/Cora 后上车，乘客不能驾驶、随车移动、断线释放、驾驶员离开保留乘客、独立下车并退出地图通过，详见 `output/riders/verification.json` 和 `scripts/verify-riders.mjs`。姓名间距、侧向朝向及车身遮挡已调整并复测。最后新增从服务器位置初始化恢复驾驶、忽略离开/休眠前旧轮询响应的保护，实际 TypeScript 回归 2/2，独立复核通过。

独立复核发现并复现暖实例旧场景导致有效车座被清空的问题，已修复，回归及相关专项 14/14 通过，复核未发现新的重要问题。场景截图 `output/memory-places/`；电脑家具截图与布局验证 `output/ui-polish/`。

Cloudflare 实时服务版本 `7cd83ea1-a638-452b-ae3d-95b1af620f49` 已部署，浏览器访问 `https://cyber-hutong-party.hanjinglaura.workers.dev/health` 得到 `ok:true`。Vercel 最终生产部署 `cyber-hutong-58wpgcrgd-hanjinglauras-projects.vercel.app` 已成功并绑定原域名 https://cyber-hutong.vercel.app/cyber-hutong/ 。线上 API 浏览器核对 `ok:true`、`release:2026-10-13-memory-places`、`party:true`、模型 `ready`；实际生产页面确认五个新场景均存在。Vercel 凭证自动刷新后以 IPv4 成功上传，部署/检查日志 `output/vercel-memory-deploy-final.log`、`output/vercel-memory-inspect.log`。真实浏览器自动化不等于所有真人移动设备与长时间生产多人游玩已验收。
