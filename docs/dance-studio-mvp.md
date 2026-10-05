# 舞室 MVP

新增入口：舞室。画面与现有 640 × 360 游戏共用像素渲染、人物尺度和移动 / 拿物品系统。

## 参考与美术

参考 [The British Engineerium 舞室照片](https://www.thebritishengineerium.com/dance-studios) 与 [Seaview 学校舞室项目](https://www.sm-f.com.au/projects/seaview-high-school-redevelopment-2/) 的镜墙、木地板和练习空间布置；背景是原创像素场景，并非照片写实贴图。

- 背景：assets/drafts/dance-room-v1.png；镜墙、音响、把杆、长凳、储物格。
- 动作：assets/drafts/owner-dance-v1.png；4 列 × 2 行完整人体姿势，前 / 后各四帧。身体和手臂连在同一帧里，不用拆分肢体拼装。左右伸臂用对应完整帧翻转。
- 日常人物继续使用已经认可的原始素材；新增动作只在跳舞时使用。
- 镜像的方向、脚部位置和物品尺寸随人物同步更新，全部轮廓限制在镜框范围内。
- 家具按实际图片坐标设置地面碰撞范围；坐凳单独标定坐姿脚点，不让行走人物进入凳子占地。

## 玩法

WASD / 方向键移动，E 互动，Esc / E 结束。

- 镜子前 E：自动对镜跳舞；侧栏也可开始。
- 中央空地 E：方向键跟拍。四拍准备，然后八拍输入；每拍 ±160ms 判定，仅判一次，错误方向或过时为错拍。本轮和最好成绩保留到刷新。
- 音响 E / 侧栏：开关原创合成节拍。F / 侧栏：90、120、150 BPM。跟拍过程中锁定速度。切换场景停止声音和动作；返回不会自动播放。
- 长凳 E：坐下休息，E / Esc 起身。
- 右侧储物格 E：存放手中一件物品；空手再按 E 拿回。保留物品类型和米线调料，能跨场景携带。跳舞需要空手，不会替换或消耗手中物品。

状态只在当前页面会话中保存，刷新重置。音响需浏览器允许用户触发的 Web Audio。

## 背景生成提示词

Create a coherent pixel art dance studio interior game BACKGROUND, landscape 16:9, same 2.5D front elevated camera and chunky pixel density as attached office game image. Render at low resolution 640x360 appearance, hard square pixel edges, limited palette, no smoothing, no text, no people. Front wall has a large continuous wall mirror spanning x=100 to 555 and y=30 to 145 in a 640x360 logical canvas. Mirror reflects only empty wooden floor and simple pale walls, NOT any people, furniture, doubled rooms or fantasy outdoor landscape. Mirror has a slim dark gray frame. Warm natural maple plank floor from y=155 to bottom, simple restrained plank joints in perspective. Left and right narrow side walls with correct depth perspective, off-white paint. Ceiling short band at top with three square practical light panels. Wooden ballet barre fixed along the far right side wall. Furnish LEFT front corner with a compact black audio stereo cabinet and two speakers, their base at x=60 y=193. Furnish RIGHT side at x=582 y=210 with a wood cubby locker holding a few shoes and folded bags. A simple wood waiting bench near lower left x=100 y=290, front-facing seat top at y=277, feet at 304. Keep central dance floor entirely EMPTY and spacious. Subtle material shading, dark pixel outlines and physically connected furniture, genuine three dimensional volume, restrained warm atmosphere. Use office attachment as pixel style reference only, don't replicate office furniture.

## 动作生成提示词

Pixel art dance animation sprite sheet of the attached approved female game character: short dark brown bob, black round glasses, dark charcoal collared shirt, black trousers and black shoes. Preserve her cute face and sprite style. TRANSPARENT BACKGROUND. Exactly 4 columns and 2 rows, eight complete whole-body connected character poses, equally spaced cells, no labels no objects no detached limbs. Top row FRONT facing camera; bottom row BACK facing away, same corresponding poses. Column 1 neutral dance stance arms relaxed feet slightly apart. Column 2 left step, left arm extending softly sideways at shoulder height and right arm bent low. Column 3 feet together elbows bent hands at shoulder height. Column 4 right step right arm extending softly sideways at shoulder height left arm bent low. Each body is complete naturally connected shoulders arms torso and legs, never separate floating limbs, hands round simple pixels. Keep all heads approximately same size and foot baseline same across cells. Visible square pixels, crisp low resolution game sprite about 40 pixels wide x 64 pixels tall, limited colors no antialiasing. Reference is identity AND pixel art style. Avoid overly broad arm gestures or giant hands. No items held.

## 验证

TypeScript + Vite 构建；真实浏览器执行八拍正确输入得 8/8、错误方向和超时判定、调速、结束动作、离开舞室停音、返回位置和最好成绩保留、长凳坐下起身、健身房取水后跨场景存取、持物跳舞拦截。截图保存在 output/playwright/dance-*.png。界面沿用现有功能导航，无新增品牌、渐变卡片或装饰 SaaS 外壳。

