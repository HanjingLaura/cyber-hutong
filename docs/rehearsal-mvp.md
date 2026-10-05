# 排练厅

参考用户提供的排练厅照片：木质吸音墙、横梁、矩形顶灯与木地板；用现有办公室图片约束像素风格。新增 assets/drafts/rehearsal-room-v1.png、rehearsal-kit-v1.png。人物及十把椅子继续使用已认可素材。

前排 A1–A4 共 4 组、后排 B1–B6 共 6 组，每组一把独立椅子和一个独立谱台，横向排列。前方中央指挥台、右侧三角钢琴和琴凳；各物件依脚点排序。椅背沿用同一椅子图的前景裁片，坐下时遮挡人物下背部。谱台碰撞仅按三脚底座占地，保留两排之间通道。琴凳、键盘与已有背面坐姿抬手帧单独校准，不拆拼人体。

WASD / 方向键移动；E 坐下 / 起身 / 上指挥台，Esc 起身。琴凳附近 E 弹琴：A W S E D F T G Y H U J K 对应 C4 至 C5 的十三个半音，亦可点击 / 触摸琴键，支持同时发声的和弦。弹琴时 E 是 D♯ 音，Esc 或按钮起身。声音是 Web Audio 原创谐波合成的类钢琴音色，并非采样钢琴。起身、失焦和切场景释放全部声音；切场景关闭琴键栏并起身。计数保留当前页面会话，刷新重置。

持物可在普通座位坐下，弹琴需要空手，手中物品不会被覆盖或消耗。可以先去既有餐桌或储物格放好物品。

验证：TypeScript / Vite 构建通过；实际走到十个座位逐一坐下 / 起身，以及上 / 下指挥台；琴凳坐姿截图检查；键盘 C-E-G 三音和弦、键 E 单音、鼠标点击、松键、切场景清音和返回重新进入。浏览器无错误或警告。没有新增品牌、装饰导航、浮动白色应用外壳或圆角渐变卡片。

## 背景生成提示词

Create a pixel art orchestra rehearsal hall background for a 640x360 game, landscape 16:9. Reference 1 is the real rehearsal hall for architecture and atmosphere only, reference 2 is the existing pixel office game style. Same front elevated 2.5D room camera, crisp blocky low resolution square pixel edges, limited warm palette, dark fine outlines, no smooth realism. Warm maple parquet floor, back wall of wood acoustic panels, ceiling light rectangular strips with exposed cream beams like the photograph, understated rehearsal room. Empty flat clear floor from logical y=125 through bottom with no chairs or music stands, NO piano, NO people, no conductor platform: these will be separate runtime props. Back middle wall has a dark acoustic panel and simple analog clock, wood lower wall, side wall depth perspectives consistent with floor. Far back left a plain storage door and a couple stacked music instrument cases. Leave right side floor clear for a grand piano. No text, no invented branding, no stages or concert audience, no giant decorative designs. Match pixel density and furniture shading of existing office reference, show real depth in walls and beams.

## 独立道具生成提示词

Transparent pixel art prop atlas, 3 columns one row with very large clear gutters, each independent object centered. Consistent front elevated 2.5D camera and pixel art style of attached office game. Left cell: black grand piano with keyboard facing directly toward camera along its front lower edge, music rest with white sheet on top, rear curved body extending away, upright open lid seen from above, THREE legs grounded below, no bench included, logically 95 pixels wide 90 high. Center cell: one simple black metal orchestra music stand with white open sheet music and tripod foot, seen from rear (toward player) since audience faces the far wall, logical 28 wide 46 high. Right cell: low rectangular wood conductor podium with one step in front, logical 65 wide 18 tall. No people or text. Pixel squares about 2-3 logical pixels, hard crisp edges limited palette, physically solid shading, do not draw piano keys separated/floating, no extra objects. Layout evenly separated left/middle/right 3 cells, transparent background. Match attached game's style and camera.

另修复首次加载时快速切换场景的竞争问题：加载较晚完成的场景在 create 时检查当前选中场景并休眠，避免同时响应操作或覆盖提示。实际验证排练厅 → 尚未载入的舞室 → 立即返回排练厅，最终只有排练厅处于运行状态。

截图：output/playwright/rehearsal-room-final.png、rehearsal-final.png。

