# 米线店窗口融合与坐姿修正

2026-10-03。使用内置 imagegen 编辑旧场景，并参考用户提供的当前截图，生成 `assets/drafts/noodle-room-v2.png`。米线窗口、鸡柳大人、碗筷台、饮料柜和招牌都直接画入背景，不再叠加独立店铺盒子或运行时招牌文字。厨房、排烟罩、热食灯、台面与瓷砖墙共用透视和灯光。

桌子和四把绿色凳子继续独立绘制。坐下朝向餐桌（背向镜头），坐姿高度调整为 54 单位，人物脚点比凳脚高 3 单位，人物位于凳子上层，避免座面盖住躯干。四把凳子可以靠近按 E 或点击坐下，E / Esc 起身，F 使用桌面物品与调料。普通人物与多人角色使用相同朝向、尺寸与层级规则。

根据新画面重新对齐四个交互位置：饮料柜 (104,181)、碗筷台 (156,181)、米线 (280,181)、鸡柳大人 (476,181)。行走区域从 y=174 开始，不能进入柜体或穿过桌凳。

检查四个座位逐个坐下与起身，确认 facing=2；通过真实 E/F 和菜单点击走通拿碗筷、取米线、放到桌上、领取鸡柳。测试使用适配器安排靠近位置，不作为完整寻路验收。截图在 `output/playwright/noodle-v2-seated.png` 与 `noodle-v2-room.png`。构建通过，无浏览器 JavaScript 异常。未增加页面外壳、虚构标识或装饰性导航。

最终生成提示词：

Use case precise-object-edit. Image1 edit target empty room. Image2 layout reference ONLY; its separate chunky floating shop boxes look fake and must be improved. Generate a complete integrated PIXEL ART Chinese rice noodle restaurant interior game background. Same frontal slightly overhead 2.5D orthographic game camera and wide16:9 proportions as image1. Keep beige tiled walls, scenic green landscape mural, tiled floor, ceiling lights, side walls. Build back wall food service fixtures naturally INTO the back wall, with coherent shared lighting, contact shadows, depth and unified counter line; NOT two standalone box vending machines pasted on floor. Left to right: tall narrow glass drinks fridge at x8%-16%, shelves of red cola and amber iced tea bottles, base at y52%; separate low bowls/chopsticks steel station at x17%-27% base y52%, stacks of lime green bowls and chopstick cylinder; wide recessed rice-noodle kitchen service hatch spanning x29%-56% base y52%, pale ceramic tile lower counter and stainless counter lip, steam pot, bowls and extractor in visible kitchen, dark green fascia reading EXACT Chinese 米线; at x62%-89% base y52% a believable fried chicken shop food-service hatch, brick red fascia reading EXACT Chinese 鸡柳大人, warm task lamps, tray of golden fried chicken and strips, stainless counter, fryer behind, red/timber base with proper highlights and side thickness. Fixtures extend up to y17%-23%; no freestanding top boxes. Labels integrated in the art rather than UI. Mid and lower tiled floor from y55% downward entirely EMPTY: no tables, no stools, no chairs, no people, no foreground props, no text overlays. Tables and seats added separately in game. Deliberate clean PIXEL ART, hard stepped edges, small limited-palette clusters, no photorealism, no painterly smoothing, no UI no watermark. Keep exact layout ready for existing interaction anchors x66/140/280/485,y204 in640x360 game coordinates.

生成后以实际画面校准交互坐标，而非直接采用提示词中的旧锚点。
