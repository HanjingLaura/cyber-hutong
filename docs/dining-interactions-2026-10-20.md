# 米线店与 MANNER 互动复查

版本：`2026-10-20-dining-interactions`，本地现有功能分支与未提交工作区。隔离 Chrome + 文件 SQLite，真实模型关闭，PartyKit 关闭；不对生产写入测试订单。

## 复现与修复

米线店桌面和饮料柜复用 `#noodle-menu`。放下米线后延迟返回响应，此时关闭桌面菜单、打开饮料柜，旧 Promise 的 `finally` 会无条件重新渲染桌面，覆盖饮料选项；原 `current` 判断也未因原生关窗失效。

`src/noodle-table.ts` 在原生关闭和场景 sleep 时使旧视图失效，清理本地选择和忙碌状态；旧请求仅能更新对应视图，不会覆盖新柜台或释放新请求的锁。服务器操作继续由已有幂等收据、版本检查和权威状态同步处理，没有重复执行食品操作。

## 验证

- 原问题真实浏览器复现失败记录：`output/noodle-lifecycle-red.log`、`output/playwright/noodle-social-1792499103861/verification.json`。
- 修复后实际领取米线、放置、关闭、开饮料柜可继续取饮料；通过实际出口切到 MANNER 再返回，迟到响应不覆盖新菜单：`output/playwright/noodle-social-1792499373019/verification.json`。
- 四项回归覆盖原生关闭、场景休眠、重新开桌、新请求锁不被旧响应解除：`server/noodle-panel-lifecycle.test.mjs`。
- 八个隔离账号使用 E 占据八个唯一座位，前后排 E 起身/再坐与 Esc 起身；明确选碗和独立调料，共同保存点餐、帮取餐及指定空位上桌，争抢同一份食物只有一人成功；原生关窗恢复焦点、迟到点单不抢聊天焦点、短时断网和多窗口接管均通过：`output/playwright/noodle-social-1792499208536/verification.json`。点位预置用于省去走路时间，不冒充全程自然游玩。
- MANNER 正常出口行走、点单/取杯、丢失已提交响应后恢复、取消订单、携杯去休息室赠送、重复 E、满手阻止领取、断网恢复 22ms、旁观页不能操作通过。追加关闭点单窗后通过实际出口切到米线店、返回恢复唯一待取订单后取消通过：`output/coffee-window/verification.json`，模型调用 0。MANNER 现有门店无座位，不声称测试了不存在的坐下功能。
- 沿用像素布局与公共接口，无新增模型请求、后台任务或新素材。

## 发布与检查

- 完整测试 359/359 通过：`output/dining-server-tests-final.log`；类型检查与构建通过：`output/dining-build.log`。
- 素材审计无缺失引用、无重复组：`output/dining-art-audit.log`。
- 已发布并提升到正式域名 `https://hanjing-laura.vercel.app/cyber-hutong/`。部署 `dpl_7Qgkb8iJSqbSes5oZokoeTWEpoqK`，不可变地址 `https://cyber-hutong-pou0wyeg9-hanjinglauras-projects.vercel.app`。
- 正式版本、登录页、后台资料不公开及模型配置只读冒烟通过：`output/production-dining-interactions-1792499697229/verification.json`。
- 全量 63 个既有批准素材与两张朱志鑫构建素材检查通过，46 个外部资源哈希匹配、19 个内联资源存在于部署脚本：`output/production-pixel-art-assets-1792499697319/verification.json`。
- 线上只读检查不登录、不写订单、不调用模型。线上八位本人试玩仍由用户自行安排，不以隔离结果替代。
