# 娱乐室新增设备

2026-10-03。保留原来的扫雷、蜘蛛纸牌、抓娃娃机，加入左前方投篮机、右前方空气曲棍球桌、右下方休息长椅。中间留出连续通道。三件新物件使用独立透明像素素材 `assets/drafts/arcade-props-v2.png`，由内置 imagegen 生成，并按三列注册，不修改生成文件的像素或透明度。

投篮：鼠标或左右键瞄准，Space / 按钮出手，移动篮筐，十次机会，命中得三分。空气曲棍球：鼠标或 WASD 移动球锤，与电脑对打；包含球锤碰撞、边墙反弹和球门计分，先得五分获胜。关闭面板暂停本局，重新打开继续，重开清零。

靠近新设备按 E 或点击打开游戏。长椅靠近右端按 E 或点击坐下，E / Esc 起身。新增脚底碰撞，不能穿过投篮机、球桌或长椅；注册角色与普通人物使用一致坐姿高度和前后层级。

验证：真实 E 打开游戏；鼠标瞄准、按钮投篮，命中后得分为三；移动球锤；安排测试球位置检查球门得分，重开清零；长椅坐下和起身；两件设备阻挡与中央通道可走；没有浏览器 JavaScript 异常。测试靠近位置及球门边界通过适配器安排，不将其当作完整寻路或长期游戏难度验收。构建通过。

最终生成提示词：

Production PIXEL ART sprite sheet for a 2.5D frontal slightly overhead arcade game room, matching dark navy floors and cyan/magenta neon accents. TRUE transparent background, THREE fully isolated whole furniture sprites in THREE equal-width columns, wide clear transparent gutters, no text labels. LEFT column: a compact orange and dark navy arcade basketball shooting machine, tall rear backboard with hoop/net, mesh cage sides, sloped ball return with two orange basketballs, sturdy rectangular base with cyan edge details. MIDDLE column: a cyan and magenta air hockey table, pale blue playing surface viewed from front slightly above, center dividing line, two colored mallets and a red puck, substantial dark navy cabinet, four short legs, visible front and right side thickness. RIGHT column: a simple dark navy upholstered arcade waiting bench with magenta seat cushions, small low backrest, two sturdy metal legs, frontal game perspective. No players, no UI, no logos or writing, no shared floor, no huge bloom, no gradients. Crisp chunky low-resolution game pixels, dark one-pixel outlines, clear top/front/side planes, limited palette, practical readable shapes. Objects never overlap column boundaries, no extra equipment. Sprite objects centered within each column with transparent margin on all sides. Basketball machine taller than hockey table; bench lowest.

截图：`output/playwright/arcade-v2-room.png`、`arcade-v2-bench.png`。本轮未增加品牌装饰或应用外壳。
