# 娱乐室

从现有场景导航进入“娱乐室 · 电玩城”。WASD / 方向键移动，靠近机柜按 E 开始，Esc 返回。三个本地小游戏不跳转外部网站，无货币系统。原人物素材、持物状态沿用现有实现。

- 扫雷：10×10、15颗雷，首次翻格及周围八格安全；左键翻格、右键插旗，空白连通区域自动展开；翻完85个安全格获胜。
- 蜘蛛纸牌：单花色104张，十列牌与五轮库存；点选连续递减明牌，再点目标列移动；K到A完整序列自动收走，收齐八组获胜。支持发牌、撤销、重开；有空列时不发牌。
- 抓娃娃：方向键 / A、D 或点击柜内定位爪子，Space / E / 抓取按钮下降；对准玩偶才能抓中，随后提升、移到出口。成功抓走的玩偶从柜内移除，累计成功次数保存在当前浏览器。

小游戏关闭、切换场景后保留当前会话中的本局状态；刷新后扫雷、蜘蛛牌局和柜内玩偶重置，只保留抓取成功总数。累计次数是计数，尚不是可摆放或手持的玩偶背包。

房间素材 assets/drafts/arcade-room-v1.png 使用内置 image_gen 生成，已复制到项目。机柜视觉为像素画，含侧面、控制台与底座；游戏界面由 Canvas 原生绘制，关闭平滑采样。像素地雷、蜘蛛扑克牌和娃娃不是外部网页截图。

布局参考：[Round1 arcade](https://www.round1usa.com/activities-list/arcade-games)、[Round1 crane zone](https://www.round1usa.com/mega-crane-zone)。仅用于观察机柜和抓娃娃区的空间布局，没有下载其照片作为游戏素材。

实现：src/arcade.ts、src/arcade-games.ts、src/arcade-rules.ts。规则验证 scripts/verify-arcade.mjs 已通过；浏览器实测翻格、插旗、移牌、撤销、发牌、抓中并移除玩偶、关闭后人物继续移动。

## 完整生成提示词

Generate a production 16:9 pixel-art game entertainment room / small arcade. Orthographic 2.5D front view slightly from above, same chunky pixel density and dark crisp outlines as the supplied approved office game. Real arcade-inspired layout: navy painted walls, purple and cyan thin LED strips, patterned dark carpet, ceiling trusses and small square lights. THREE distinct substantial arcade cabinets along rear wall, each has visible SIDE plane, top face, thick control console and base feet so they read as 3D objects, not paper cutouts. In logical640x360: left cabinet centered x145 foot y200, screen shows ONLY a pixel mine/bomb icon; middle cabinet x310 footy200 screen shows ONLY small playing cards and a cute pixel spider icon; RIGHT claw machine x490 footy200 has a clear glass bay, metal claw and pastel stuffed plush toys, pink frame, physical prize chute at bottom. Cabinets approx80x125, claw machine95x135. Keep front floor y210..345 empty and playable with room to walk between machines. No people, no extra fourth machine, no text, no labels, no logos, no UI, no coins, no casino gambling or slot machines. Restrained arcade light colored pixel blocks, no gradient glow clouds, no photorealism or blur. Visible wall-floor border and cabinet contact shading. Opaque background.
