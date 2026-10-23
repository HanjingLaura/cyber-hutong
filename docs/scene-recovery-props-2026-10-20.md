# 场景恢复与物件补充更新

发布标记：`2026-10-20-scene-recovery-props`。基线为 `d57d36d1f384bef689de56dd688392e345de992a` 加既有工作区，本轮保留其他未提交工作。

本轮修复两种真实浏览器复现的问题：聊天/人物面板及设置、背包、收藏、回看按 Esc 关闭后游戏焦点不恢复；就座或跑步时聊天 Esc 同时结束活动。统一关闭焦点恢复，并仅消费属于侧面板的当前 Esc，保留新聊天输入、原生 dialog 和控制权门控。详见 `docs/scene-recovery-acceptance-2026-10-20.md`。

## 隔离验证

- 全部20场景，32次按钮/Esc关闭；移动与E不依赖手动focus。报告 `output/scene-recovery-1792463743648/verification.json`；Esc补修后完整复跑 `output/scene-recovery-1792464919958/verification.json` 同样通过。
- offline/online恢复140ms，真实SSE流结束后自动重连1738ms；多窗口接管、拒绝切场景及已提交响应丢失均可恢复，故障各仅提交一次。
- 就座与跑步第一次Esc仅关聊天，第二次退出活动，红绿证据分别为 `output/scene-recovery-1792464487511` / `output/scene-recovery-1792464538478`。
- 快捷物品成功、503失败、迟到响应及聊天输入保护：`output/playwright/shop-interactions-1792464687912/verification.json`。
- 模型key为空，使用本地文件SQLite；本轮故障与美术fixture走快捷地图，不替代既有真实出口路径40次导航验收。没有消耗真人聊天LLM预算。

## 素材审查

全量检索197项资源引用并实际审看54张非人物图、20场景合成图。四项新图已独立审查：电动车100×50、滑板48×16覆盖原路径，新增琴凳34×21和纪念票台55×22。正式资源位于 `assets/props/`，生成原稿与审核仅在output；记录 `output/prop-followup/generation-final.json`、`review.json`。

实机证据 `output/prop-followup/browser-1792464496261/verification.json`（9项）、`browser-1792464569944/verification.json`（10项补拍）。真实E覆盖司机/后座/前篮上下车、滑板站/坐F及Escape下板、钢琴进入/退出、纪念票领取/关闭/再打开；390px票面无整页横溢。三乘员遮挡和琴凳通过，回看场景沿用相同琴凳资源，仅重新拍摄rehearsal合成预览。生日画面属于电视简图，冰箱开门状态协调，保留；投篮和气垫球内部存在占位感，单独补生成。

三件此前被图像工具拦截的玩具仍按用户要求暂缓。八位真人线上试玩由用户自行安排，本次不声称已经完成。

## 发布结果

运动素材已接入：4次生成，导入7张独立正式资源（机舱、篮架、球桌、篮球、蓝/粉球拍、冰球），避免atlas跨格裁切。计分、轨迹和碰撞代码保持。`output/prop-followup/sports/independent-review.json`含原图与实机独立审核；`output/prop-followup/sports/browser-1792465059230/verification.json`六项真实按键检查通过，覆盖出手/飞行结束、移动球拍、Esc关闭后无需手动焦点恢复移动、两种390px容器。`src/arcade-sport-art.ts`下载失败后重试，等待期间保持可玩；3项有意义的loader失败恢复测试已加入。

最终完整服务端测试332/332通过，日志 `output/scene-recovery-props-server-tests.log`。全量资源清单206项、164图、59项生成审核通过；缺失引用0、重复内容组0、旁路背景候选0，3件玩具暂缓。没有增加通用SaaS外框、装饰品牌、整页长滚动或前端人设编辑器。

最终构建通过（2分12秒），日志 output/scene-recovery-props-build.log。Vercel部署 dpl_2AMdDu4W7z9YtazKLSL7Lmv2oGcY READY并已promote；正式地址 https://hanjing-laura.vercel.app/cyber-hutong/ 。不可变地址 https://cyber-hutong-74ft62ixh-hanjinglauras-projects.vercel.app 。

生产浏览器只读检查通过：output/production-scene-recovery-props-1792465563075/verification.json 验证新release、登录页面、私有人设404、无前端人设编辑器及既有qwen-flash预算配置；output/production-pixel-art-assets-1792465563165/verification.json 验证全部59项审核资源（43项外部图片逐字节SHA、16项内联图确认来自实际部署JS）。线上检查未登录、未发送消息、未发起模型请求；生产功能真人试玩仍待用户安排。

发布工具初始受本机代理影响fetch failed，直连API读取鉴权正常；仅本次CLI子进程去除代理后上传及promote成功，游戏网络配置未改。
