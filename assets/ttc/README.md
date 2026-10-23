# 击倒TTC：躲藏场景与人物

当前支持 Cora、Amber、Suki、Sid、Jilly、Laura、Kay、Franco。每局选择一位人物，寻找五个分散的目标，统一读取角色注册表中的正式 idle-front 帧。人物身份不画进场景背景或机器屏幕，后续可继续扩展。

新增 `market.png`（旧物集市）与 `greenhouse.png`（温室花房），均由内置 imagegen 生成，实际尺寸 2172×724；运行场景为 2160×720，视口保持 1280×720，通过横向移动查看。固定正面略俯视、3:1 全景、清晰 16 位像素边缘、深棕木材与橄榄绿、温暖自然光；密集且有层次的物件提供藏点，背景无人物、文字和界面。

旧物集市内容：灰砖胡同、旧收音机、箱子、书籍、衣架、古董与盆栽。温室花房内容：玻璃屋顶、木架、花盆、藤蔓、园艺工具与陶器。两张图均已目视检查。生成来源分别为 `exec-a7b736b8-a5b5-412f-97a8-9a0ac1b5b30b.png`、`exec-ee84abef-6528-474e-84bc-b8e005053cd3.png`，位于本会话的 generated_images 目录。

模块新增：`scenes.ts` 管理场景、藏点与人物列表，`camera.mjs` 管理视野边界和坐标转换。背景、放大镜、命中均使用同一世界坐标。鼠标或手指拖动移动视野，点击与拖动分开判定；也可使用底部滑条、左右按钮、A/D。

场景：胡同旧书摊。固定正面略俯视，16:9，提示规格 1536×864，生成实际尺寸 1672×941，运行视口 1280×720，16 位像素插画；暖灰砖、深棕木架、橄榄绿植物，下午自然光，像素边缘清晰，无界面文字、无人物。全景与放大镜共用同一张图。

人物使用 Cora 正式 manifest 的 idle-front 帧，不重画身份。保持长发、刘海、灰黑外套；用亮度、饱和度和少量棕色环境染色融入藏点。当前五个目标使用独立缩放、左右和底部裁切，命中仅计算实际可见的不透明像素。放大镜与命中读取相同绘制坐标，避免遮挡部分被误判。

柜体：`cabinet.png`，透明背景 702×1337，深棕机身、橄榄绿边框。使用内置 imagegen 生成后编辑屏幕，移除人物，只保留旧书架与准星；sharp 仅裁去外围透明留白，未重绘内容。最终编辑 prompt：Edit this arcade cabinet ONLY inside the rectangular display screen: REMOVE the woman/character entirely and replace screen contents with an empty pixel-art old bookstall scene, shelves of books with a cream crosshair in the center. NO person, NO face, NO human silhouette anywhere. Keep cabinet shape, marquee, color, pixel art, joystick, buttons, coin slot exactly the same. Maintain transparent background and full uncropped isolated cabinet.

样张已目视检查：保留像素场景与正式 Cora 外观；柜体屏幕无人物。入口位于投篮机与球桌之间，靠近按 E 或点击进入；实体底部碰撞在 shared/walkability.mjs 中统一。

模块：rules.mjs 管理计时、命中、重开；game.ts 管理素材、绘制和输入；game.css 管理单窗口界面。游戏厅和 ttc.html 共用同一游戏组件。

场景生成使用内置 imagegen。最终 prompt：A single background plate for a hidden-person game, an intricate Beijing hutong secondhand bookstall courtyard, straight-on slightly elevated view, wide 16:9 1536x864. Crisp 16-bit pixel art matching chibi pixel characters, visibly stepped pixels, warm grey brick, dark brown timber, muted olive foliage, warm natural afternoon light. Shelves packed with worn books, rolled posters, potted plants, bicycles, crates, hanging laundry, windows and a recessed dark shop interior. Dense but coherent observational details with several dark shelf recesses suitable for hiding one small character. No people, no faces, no silhouettes, no readable text, no UI, no lettering, no blur, no smooth vector shapes. Full bleed scene, consistent perspective, no frame.
