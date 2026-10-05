# 夏威夷场景

固定使用胡同文化墙同向视角：白色墙面，左侧窗户，两排各三个工位；连续桌排宽 448 世界像素，相比胡同的 384 增加约 17%。六把椅子、六台电脑、人物与绿植复用已认可的胡同素材。桌架由原图的三个工位模块拼接，抽屉在椅子旁侧，膝部空间与座位对齐；没有将四工位桌架整体拉长冒充三工位。

按 WASD / 方向键移动，靠近工位按 E 坐下，E / Esc 起身。靠近左侧窗边按 E 拉下 / 卷起灰色卷帘，也可点击侧栏卷帘按钮。450 ms 收放，帘子下缘跟随左侧窗户的斜向透视，窗框、拉绳与背景独立。座位、位置、窗帘状态保留到刷新前；切换其他场景不重置。手中物品沿用共享状态。

当前背景：assets/drafts/hawaii-wall-v2.png。移除背景内旧窗后，在 src/office-window.ts 独立绘制窗户。窗框、玻璃、卷帘、底轨的横向边线均朝墙顶与墙脚边线的共同消失点（61,12）收敛，不再使用独立斜率。左右立边垂直，所有部件共用同一墙面投影。玩法提示右移以露出窗户。其他家具与角色未重新生成；胡同原来的八席与双视角维持。

实机验证：HR2 / HL2 正反排坐下与电脑亮屏；六席数量、桌宽 448；窗帘收放及跨场景保留；胡同仍八席、桌宽 384，另一侧视角仍能切换。无新通用 SaaS 页面外壳、装饰品牌或浮动白色页面容器。

## 完整生成提示词

v2 背景编辑：

Edit only the narrow left side wall of this pixel-art office background: remove the small window, its frame, glass, roller blind and pull cord completely. Fill that same area with uninterrupted warm white wall matching its surrounding shading. The game will draw a larger interactive window independently. Preserve every other pixel/composition invariant: exact room camera, all room corners, wall-floor border, empty rear white wall, grey carpet pattern, foreground edge, image dimensions and crisp pixel-art style. No new objects, no text, no people, no furnishings. Opaque background.

v1 原始背景：

Edit the supplied approved pixel game room background to a new office area named Hawaii. Preserve EXACT camera, room geometry, floor shape, wall-floor line, foreground low edge, left side wall width, dark grey office carpet pattern, pixel-grid size and 16:9 aspect ratio. Only change wall decoration: remove ALL green company logos, words, placards and red Chinese knot, leave clean warm white walls. Add a tall narrow plain office window on the LEFT SIDE WALL in its existing narrow perspective plane, with pale grey frame and light blue daylight glass. Window confined to left side wall, never on the wide rear wall, never intrudes into walkable carpet. The grey roller blind is rolled UP at the top of the window, with a little pull cord. Keep rear white wall empty. No desks, no chairs, no computers, no people, no UI, no new signs or text. Those furniture objects are independent game sprites. Crisp cohesive pixel art matching the supplied background, black/dark single-pixel outlines and flat pixel shading, no blur. Preserve floor and camera completely.
