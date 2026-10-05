# 米线店

从导航“米线店”进入。照片用于环境参考，保留田园墙画、瓷砖地面、浅色桌子、绿色碗和凳子，视角改为游戏统一的正面2.5D视角。原人物及四向步行、持物和坐姿素材不重新生成。

后方设备从左到右：饮料冰柜、碗筷台、米线出餐窗口、鸡柳大人。两张独立餐桌，每桌两张绿色无靠背凳；共四席。每桌醋瓶和麻油瓶独立摆放，桌面最多放六件物品。

## 操作

- WASD / 方向键移动，靠近物件按 E。
- 碗筷台拿“碗筷”，带着碗筷去米线窗口，碗筷变成装好米线的一碗食物。
- 鸡柳大人可以选择鸡柳、炸鸡；饮料柜可以选择可乐、冰红茶。暂不收费，不接货币系统。手中已有物品时不能覆盖领取，先放到桌上。
- 凳子前 E 坐下，E / Esc 起身。
- 靠近餐桌或坐着按 F，可放下物品、拿回指定物品、给桌上一碗米线加醋或麻油。同种调料不重复叠加；调料状态在拿回、跨场景持有和重新放下后保留。
- 坐着打开餐桌交互，可吃手中或桌上的米线、鸡柳、炸鸡，吃完移除对应食物。

当前单手持有一件物品。持物沿用共享playerInventory，可带回胡同或休息室。桌上物品、位置和座位在场景切换时保留，刷新页面重置本场景。不存在服务员、点单队列或多人同步，当前为单人试玩。

## 分层与比例

逻辑世界640×360。背景仅墙、地面、天花和固定墙画；冰柜、碗筷台、两种出餐口、桌子、凳子、调料和食物分别渲染。图集按实际物件的透明边界注册纹理，没有把整张图片硬切为等宽六格。

服务设备底线183，人物步行脚点不越过199；两个餐桌中心213、439，底线264，显示136×50；凳子中心为各桌左右34，底线289、大小24×23。坐姿人物使用已认可的62.4高度，凳面与人物臀部相接，凳腿在身体之后。碰撞基于家具在地面的占地，遮挡按脚点与家具底线排序，餐桌的食物和调料另设桌面前层。

食物是原生像素纹理，所有菜单图标、手持物和桌面物品共用同一纹理定义。米线14×12、碗筷13×11、鸡柳11×12、炸鸡12×11、冰红茶7×13；手和物品的连接使用现有共享grip接口，没有为每件物品重生一套人物动作。

## 文件

- assets/drafts/noodle-room-v1.png：内置image_gen生成的独立环境背景。
- assets/drafts/noodle-furniture-v1.png：内置image_gen生成的透明六物件图集；有顶面、侧面和柜体厚度。
- src/noodle-shop.ts：场景、碰撞、凳子、取餐、桌面和调料交互。
- src/product-textures.ts：原生像素食物、饮料与调料图标。
- src/player-inventory.ts：新增物品与米线调料状态。

UI沿用现有游戏导航与侧栏；取物界面只保留商品名称和功能按钮，没有新增装饰品牌、圆角卡片页壳或AI文案。

## 验证

实机走完整条路线：拿碗筷→取米线→坐下→放下→加醋和麻油→拿回→带到胡同→回店放下→吃完。鸡柳、炸鸡、可乐、冰红茶逐一选取；一张桌上同时放鸡柳、炸鸡、可乐；满手时饮料领取按钮禁用。冰红茶带到休息室后返回仍保留，桌面三件物品也保留。TypeScript / Vite构建通过，浏览器无错误或警告。

## 完整生成提示词

### 环境背景

Generate a production pixel-art 16:9 game restaurant BACKGROUND ONLY, orthographic 2.5D view slightly above, straight towards back service wall. Reference photo is a small Chinese rice noodle restaurant: warm white tiled walls with waist-high pale green countryside mural, beige-grey tiled floor, ceiling square fluorescent lights, cozy everyday food shop. Reference pixel office image is pixel density and rendering style: chunky crisp pixel grid, dark outlines, flat limited shading, same game camera, no photorealism, no blur. Logical640x360. Rear wall meets floor at logical y155. Reserve EMPTY floor x40..600 y155..350 for separately placed service equipment, dining tables and stools. Plain back wall with tiled upper part, a modest countryside mural strip, no drawn countertop, no serving window, no fridges, no dining furniture, no people, no products, no menu boards, NO TEXT. Subtle narrow side walls with consistent perspective, no foreground objects blocking walkable floor. Opaque background.

### 独立家具图集

Create ONE transparent production pixel game furniture atlas, exactly3 columns by2 rows equal cells with wide transparent gutters and no contact between cells, each item complete, orthographic 2.5D front view slightly from above. Match attached approved pixel game: chunky crisp consistent pixel grid, dark outline, flat limited shading, no antialiasing. Row1 col1: tall glass-front drinks refrigerator, metallic white frame, visible RIGHT side depth, shelves dense with red cola cans and amber iced tea bottles, opaque bottles inside transparent glass, door closed. Row1 col2: low stainless self-service bowl and chopstick station, stacked lime-green bowls on top, upright chopstick holders and metal counter below. Row1 col3: substantial rice-noodle restaurant service window unit, rectangular tiled wall surround and open serving aperture with visible recessed kitchen behind, thick stainless service countertop below, blank slim green fascia on top for game text, no actual text. Row2 col1: fried chicken service kiosk, dark red fascia blank for text, recessed open service aperture, warm amber interior and small fryer tray with golden chicken, thick service countertop and solid cabinet base, visible right side. Row2 col2: ONE rectangular dining table with cream speckled topcloth, clear visible top surface, thick front tabletop edge, four sturdy square metal legs, logical110x58 footprint aspect; EMPTY TABLETOP no bottles bowls or people. Row2 col3: ONE small lime-green square-top backless dining stool with cream metal legs, clear top surface and front/right side thickness, logical24x23 aspect. All6 objects standalone cutouts, no ground outside objects, no shadows outside, no extra props, no text, no labels, no people or character silhouettes. TRUE transparent alpha background.
