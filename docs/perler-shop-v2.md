# 拼豆店桌椅重做

2026-10-03，使用内置 imagegen 重新生成两张像素素材：

- `assets/drafts/perler-shop-v2.png`：墙面、彩豆架、熨烫台、储物柜、作品架与空木地板。中央不包含任何桌椅和桌椅阴影。
- `assets/drafts/perler-furniture-v2.png`：透明背景的独立长桌与圆凳，按两块区域注册帧；没有修改生成文件的像素或透明度。

两张长桌和八把凳子由场景分别摆放。凳子有独立点击区域、脚底碰撞、座位编号、坐姿锚点和绘制深度。坐姿正面朝向玩家，人物在凳子上层，避免座面遮住整个身体；游客与已领取角色都采用 54 单位坐姿高度。上下两排之间保留通道，起身返回原来的靠近位置。

靠近按 E 或点击凳子坐下，F 打开拼豆面板，E / Esc 起身。点击远处凳子不会瞬移。拼豆底板、彩豆盘单独绘制，原有作品与熨烫功能保留。

验证：构建通过；八个座位逐个 E 坐下和 Esc 起身；凳子点击坐下；F 打开操作面板；桌子、凳子阻挡与通道可走检查；普通人物与 Sid 素材坐姿截图；无浏览器 JavaScript 异常。测试通过适配器安排靠近位置，再触发真实按键与鼠标操作，没有将测试站位安排当作寻路验收。

最终提示词：

**背景（编辑旧版背景）**

Edit target: attached existing pixel art perler bead shop game background. Regenerate this room as a clean production environment layer in the exact same crisp pixel-art palette, frontal slightly top-down 2.5D orthographic camera, wide 16:9 layout. REMOVE BOTH large central work tables AND ALL EIGHT stools AND ALL their shadows, pegboards and trays from the center. Reconstruct an uninterrupted empty warm timber plank floor in their entire area. Keep the back wall shelves of colorful bead jars, pixel bead artwork, small center drawer cabinet, right ironing station, left plants and storage chest, right easel, room boundaries and perspective the same. Central floor is deliberately empty because work tables and chairs will be separate game sprites. No people, no chairs anywhere, no tables in the central floor, no UI or writing, no logo. Sharp stepped pixel edges, low resolution game appearance, opaque background. Preserve room proportions and usable clear floor at x 15%-82%, y 38%-92%.

**独立桌椅（新生成，透明背景）**

Production pixel art game furniture sprites on TRUE TRANSPARENT BACKGROUND. One sprite sheet, two horizontally separated objects with very large transparent gutters. Left object occupies x5%-72% y25%-80%: ONE long rectangular pale honey wood perler crafting table, clear thick tabletop with top surface seen in frontal slightly overhead 2.5D orthographic projection, dark 1 pixel outlines, light gray metal four legs and horizontal underframe visible. Bare tabletop, no trays no pegboards no chairs no people. Table width to total height ratio 6:1, straight horizontal front edge, subtle narrow right side for thickness, not isometric. Right object occupies x82%-95% y30%-80%: ONE small round honey wood stool with oval seat, four pale metal legs, visible seat thickness, same front orthographic slightly overhead projection. Stool approximately 1/10 the width of table. Crisp deliberate low-res pixel art, nearest-neighbor blocky edges, subdued beige wood grey metal dark outlines, 1990s pixel RPG art matching warm wooden perler bead shop. No background, no floor, no gradients, no labels, no other objects, no cast shadows outside furniture silhouettes. Both whole objects uncut, exactly one table and one stool.

本轮未增加页面外壳、虚构品牌或装饰性导航。
