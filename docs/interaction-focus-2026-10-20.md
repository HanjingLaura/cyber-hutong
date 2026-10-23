# 快捷物品操作后恢复输入

## 已复现根因

点击快捷栏“喝掉”等操作后，物品被服务端成功消耗。快捷栏随空手状态隐藏，当前按钮失去焦点，document.activeElement变成BODY；社交输入门控将当前场景keyboard.enabled置false。此时没有打开的dialog，却无法直接继续移动或按E，需要额外点击画面。

真实Chrome中连续两次复现，记录output/playwright/shop-interactions-1792460999079和1792461134674。后者明确记录activeTag=BODY、openDialogs=[]、keyboardEnabled=false，服务端hand=null/revision已更新。没有页面异常或图片404。这是操作状态问题，不是模型或素材生成失败。

## 最小修复

src/multiplayer/life-ui.ts：物品请求开始前记录是否来自快捷栏；请求结束并更新界面后，仅在没有modal且焦点仍属于原按钮/快捷栏或落到BODY时把焦点还给游戏。成功和失败走同一收尾分支。请求期间用户转向聊天输入框或其他控件时保留新焦点。背包/收藏面板里的按钮保持面板操作。

## 回归

- scripts/verify-shop-interactions.mjs：隔离账号、file SQLite、真实HTTP、真实按键与点击；快速地图仅做场景准备，不替代此前正常出口40次检查。
- 首次修复后11条操作链路通过，记录output/playwright/shop-interactions-1792461499064/verification.json：米线碗筷/取面/放下/调料/拿回/坐下食用、饮料与鸡柳、冰箱取放、贩卖机、失败恢复、迟到响应保护聊天焦点、盲盒、扭蛋、娃娃机真实发奖和收藏、电脑Esc、刷新后收藏图片。
- 重点焦点回归另直接按方向键检测真实位移，不在检测前重新focus，分别覆盖成功及503失败；已通过：output/playwright/shop-interactions-1792461641063/verification.json。成功和503失败后方向键均产生真实位移，迟到响应仍保留聊天焦点。
- 测试扭蛋机路径最初遇到巴斯NPC，测试寻路已改用当前场景实际canWalk约束；没有修改NPC或生产碰撞以迁就测试。

完整命令：npm run test:acceptance:shops；只跑焦点与迟到响应：npm run test:acceptance:focus。

模型关闭，不增加真实模型预检次数；三个被拦截玩具按用户最新要求暂缓，另行保留待办。

本轮完整服务端329/329通过：output/interaction-focus-server-tests.log。构建通过（1m34s），并已部署和promote。

## 发布与交付

- 正式版本2026-10-20-interaction-focus，deployment dpl_HQk6K53K94WmNocGpj8ZBBZ1ae2J；入口https://hanjing-laura.vercel.app/cyber-hutong/。
- 线上只读检查output/production-interaction-focus-1792462122070/verification.json通过：新版本、登录页、模型配置ready、后台模型调用关闭、无前端人设入口、人设文件404。
- 本版48项素材线上核对仍全部通过：output/production-pixel-art-assets-1792462122178/verification.json。
- 独立代码审查review_quick_focus未发现阻断问题；输入门控仍检查控制权、连接和modal，没有直接强行启用键盘。
- 额外补上不重新focus、直接按E重开贩卖机的回归：output/playwright/shop-interactions-1792462397354/verification.json通过。先前已验证成功/503后真实位移及迟到响应保留聊天焦点。
- 用户当前安排为先不处理三款玩具；三项保留后续待办，不宣称已经替换。本人八人试玩也未被自动化结果替代。
