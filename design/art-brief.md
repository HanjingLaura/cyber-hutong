# 「赛博胡同」美术与设计简报（Phase-1）

> 阶段目标：仅像素资源与预览画廊。无 Agent / LLM / 鉴权 / 数据库。

## 游戏定位

- **类型**：Soul Knight（元气骑士）式 **2.5D 斜俯视** 动作探索
- **题材**：北京胡同 × 赛博朋克 —— 窄巷、四合院、霓虹招牌、全息屏、外卖无人机
- **当前范围**：角色 idle、地砖条带、道具、三间房间 mock、三命名场景、对话框 UI

## 视角与透视（2.5D · Soul Knight）

| 要点 | 约定 |
|------|------|
| 相机 | 斜俯视约 30°–40°，类似元气骑士 / Enter the Gungeon |
| 地面 | 正交菱形感弱化为「矩形瓦片 + 侧墙竖条」，便于 32×32 对齐 |
| 角色 | 略带立体：头顶、肩线、脚底阴影；不画完全正面 |
| 深度 | 靠阴影、墙高、遮挡排序表达；不依赖真 3D |
| 轮廓 | **chunky silhouette**：关键道具外缘 1px 深色描边，保证游戏可读性 |
| 光照 | 每场景独立光色（暖日光 / 糖果霓虹 / 冷荧光）；稀疏硬像素光斑，不用半透明叠层 |
| 缩放 | 预览时 `image-rendering: pixelated`，整数倍放大（2× / 3× / 4×） |

## 场景必须可区分（硬规则）

**禁止**所有房间共用同一套深蓝棋盘/霓虹网格地板再换道具。每个命名场景是独立世界：

| 场景 | 地板 | 墙面 | 光照 | 情绪 |
|------|------|------|------|------|
| 夏威夷 | 暖色木地板 | 奶油灰泥 + 卷帘窗 | 暖日光斜射 | 工位午后 |
| 泡泡玛特店 | 粉×薄荷糖果格 | 紫粉零售面板 | 粉/青霓虹灯带 | 潮玩店 |
| 厕所 | 冷灰瓷砖 + 积水反光 | 冷色地铁砖 | 冷白荧光管 | 实用洗手间 |
| 工位（supporting） | 暗青绿格子 | 青砖 + 霓虹描边 | 屏幕青光 | 夜班工位 |
| 会议室 | 深紫霓虹网格 | 紫绒墙 | 全息青光 | 赛博会议 |
| 胡同口 | 夜间石板/卵石 | 青砖巷壁 + 牌楼 | 灯笼暖光 + 霓虹 | 户外夜巷 |

## 瓦片规格

- **基础格子**：**32×32 px**
- **角色帧**：32×32（idle 四帧）
- **道具**：16×16 或 32×32（货架/柜台可更大）
- **房间合成**：约 320×240（夏威夷 320×288）
- **UI 对话框**：256×64

## 调色板

基础 `cyber-hutong-16` 仍用于共享角色 / UI / 胡同道具。命名场景另有 **扩展色组**（暖木、马卡龙、冷瓷），由 `scripts/generate_assets.py` 中的 `P` 字典维护。导出 PNG 时严格贴合色值，保证最近邻放大不糊边。

| 索引 | Hex | 用途 |
|------|-----|------|
| 0 | `#0B0E1A` | 深空背景 / 夜巷阴影 |
| 1 | `#1A2744` | 巷道地面暗青（supporting 工位） |
| 2 | `#2E3A5C` | 砖缝 / 次暗 |
| 3 | `#8B5A3C` | 胡同青砖暖褐 |
| 4 | `#C4784A` | 砖面高光 |
| 5 | `#E8C36A` | 灯笼 / 暖光 |
| 6 | `#FF6B9D` | 霓虹粉招牌 |
| 7 | `#FF3D7F` | 霓虹粉强 |
| 8 | `#3DFFF0` | 全息青 |
| 9 | `#00C2B8` | 屏幕青 |
| 10 | `#7B61FF` | 紫霓虹 |
| 11 | `#F5F0E6` | 纸白 / 高光 |
| 12 | `#A8B0C0` | 金属灰 |
| 13 | `#4A5568` | 深灰结构 |
| 14 | `#2D6A4F` | 盆栽绿 |
| 15 | `#1B4332` | 深绿阴影 |

## 资源清单（Phase-1）

```
public/assets/
  characters/  hero_idle_0.png … hero_idle_3.png
  tiles/       tileset_32.png   # 含 hawaii_wood / popmart_candy / restroom_tile
  props/       desk, chair, neon_sign, lantern, plant, server_rack, hologram,
               blind_box*, stall, sink, …
  rooms/       room_office.png, room_meeting.png, room_hutong_gate.png
  scenes/
    hawaii/    scene_hawaii.png + props + floor_wood / wall_cream
    popmart/   scene_popmart.png + candy floor / retail wall / box wall
    restroom/  scene_restroom.png + subway tile / wall_subway
  ui/          dialog_frame.png
```

## 风格关键词

Soul Knight 可读性、chunky 轮廓、独立场景光色、霓虹雨夜胡同、潮玩糖果店、暖日光工位、冷瓷洗手间。

## 非目标（本阶段不做）

动画状态机、碰撞、战斗、存档、登录、LLM NPC、真实地图编辑器。

## 命名场景（Phase-1）

| 场景 ID | 中文名 | 说明 |
|---------|--------|------|
| `hawaii` | 夏威夷 | 靠窗长桌 + **三座位纵向排列**；详见 `design/scenes/hawaii.md` |
| `popmart` | 泡泡玛特店 | 室内店 · **拆盲盒**；详见 `design/scenes/popmart.md` |
| `restroom` | 厕所 | **四隔间** + 隔间外 **两个水池**；详见 `design/scenes/restroom.md` |

合成图路径：
- `public/assets/scenes/hawaii/scene_hawaii.png`
- `public/assets/scenes/popmart/scene_popmart.png`
- `public/assets/scenes/restroom/scene_restroom.png`
