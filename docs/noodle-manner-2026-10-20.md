# 米线店八座与 MANNER 独立门店

发布标记：2026-10-20-noodle-manner。现有20场景保留，新增manner为第21场景。用户已明确要求开搞、米线店更新素材、咖啡独立做MANNER门店；会议室画图猜词不在本次实现范围。

## 米线店

两桌八座，旧座位0..3不变，新4..7在远侧，最终y230/surface215/approach202。共享几何供客户端、服务器和回看使用，避免只加凳子图。实机初稿远侧像站立，经根与独立审图确认后仅调整一次坐姿深度；最终八人桌面遮挡通过。

桌面先选具体槽，再加醋/麻油、拿取、放下或吃这份；手持食品另有独立动作。客户端随选中槽携带object版本；过期目标409时立即读取权威桌面/订单状态，不重发消费动作。并发拿走又放回同名食物不会误吃新碗。

每人一张有效点餐单：米线，可加一份鸡柳/炸鸡、一杯可乐/冰红茶。朋友能帮取和上桌，主食仍需先拿碗筷，其他食品空手取。订单、手持物、餐桌修改在原事务中提交。撤单/放弃帮取不吞手中食物，不自动再发。24h过期只在读取时投影，实际修改只在写事务内执行。

新增payload签名收据、account稳定head和全局列表revision；同ID不同动作被拒，历史收据不把撤单或上桌回退。内部world操作用服务端随机UUID，外层收据负责幂等，持久化失败整笔回滚。

重生成正式店铺背景，补碗筷托盘、调料托盘和点餐纸，饮料/米线/鸡柳招牌使用清晰文字层。保留已批准桌椅。新素材经独立原图及640场景审核，正式路径覆盖旧图；原稿/审查在output，不增加生产旁路候选。

## MANNER

独立场景manner，加入地图、普通出口/E导航、角色同步、碰撞、预加载、地图缩略图和回看。新640×360像素背景，真实可读MANNER COFFEE招牌。点单[260,216]，取杯[440,216]，柜台外可走区y≥204，出口[580,330]。

点一杯→到右台取杯→携杯跨场景→沿原赠送面板发邀请→朋友主动确认。沿用原咖啡item/背包/物品来源，不新增货币、口味或强制等待。订单账号隔离，重复点击和提交后丢响应不会多发杯；失去控制权、断网或离场会收起面板，旧回包不重开、不抢新聊天焦点。来源标签新增“MANNER 咖啡”。

两项都没有模型生成或周期模型任务，离线Agent不自动点餐/取杯。

## 隔离验证

- 最终米线真实Chrome：output/playwright/noodle-social-1792483060707/verification.json，passed=true、11项、errors=[]。8隔离账号/文件SQLite/空模型key/随机端口/HMR关闭。初始位置为标明的fixture，E/F/菜单/点餐/上桌是实际输入与服务端修改，不伪造库存或坐姿。
- 米线覆盖八座同步、前后起身、两个碗独立调料、GUI点单/朋友取餐/上桌、竞争单份食品、原生Esc后无需手动refocus移动、390px、迟到响应保护聊天、重连、双窗口显式接管。对应eight-seats.png、mobile-orders.png、noodle-scenery.png。
- MANNER：output/coffee-window/verification.json，所有布尔验收为true、errors=[]、实际llm_usage调用0。双方从胡同实际走到普通出口，经E地图前往门店/休息室，绕开Celine正常碰撞；丢失已提交取杯响应后POST→GET同步恢复且只取到1杯。咖啡送达后原gift UI确认；重复E、手满、夺控旧client409、390px及断网恢复均通过，重连21ms。
- 全21场景恢复：output/scene-recovery-1792482916206/verification.json，全部场景关闭/移动/E、模态保护、offline/online、真实SSE终止后重连、多窗口、切换503及已提交丢响应后权威恢复通过。该轮故障准备使用快捷地图，不替代MANNER普通出口的真实导航证据。
- 三项关键新增红绿：收据输入签名、列表版本拒旧、过期选碗409读权威状态不重复消费；HTTP收据版本不被当前meta错误覆盖。测试文件server/noodle-client.test.mjs、noodle-orders.test.mjs、noodle-orders-http.test.mjs、coffee-orders.test.mjs等。
- 最终完整服务端353/353通过：output/social-scenes/server-final-tests.log。单独TypeScript检查通过。生成审计63张审核通过，缺失引用/重复内容组/旁路背景候选均0；3件玩具按用户要求仍暂缓。

## 发布

本地构建55.24秒通过：output/social-scenes/build-final.log。生产部署dpl_7P7BpyVd1ujEFe555SQy99KQUCXH READY并已promote至正式地址 https://hanjing-laura.vercel.app/cyber-hutong/ 。不可变地址 https://cyber-hutong-e043vmdce-hanjinglauras-projects.vercel.app 。线上只读浏览器检查通过：output/production-noodle-manner-1792483810340/verification.json验证release、MANNER入口、登录、私有人设404、无前端人设编辑器和现有qwen-flash预算；output/production-pixel-art-assets-1792483810451/verification.json验证63项已审核素材（44项外部图片逐字节SHA、19项内联图来自实际部署JS）。未登录真人账号、未发送聊天、未发起模型请求。八位本人线上试玩仍由用户安排；本次隔离8账号通过不能代替八位真人已通过。
