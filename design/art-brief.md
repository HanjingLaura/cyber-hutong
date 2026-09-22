# 「赛博胡同」美术与设计简报（Phase-1）

> 阶段目标：仅像素资源与预览画廊。无 Agent / LLM / 鉴权 / 数据库。

## 游戏定位

- **类型**：Soul Knight（元气骑士）式 **2.5D 斜俯视** 动作探索
- **题材**：北京胡同 × 赛博朋克 —— 窄巷、四合院、霓虹招牌、全息屏、外卖无人机
- **当前范围**：角色 idle、地砖条带、道具、三间房间 mock、对话框 UI

## 视角与透视（2.5D）

| 要点 | 约定 |
|------|------|
| 相机 | 斜俯视约 30°–40°，类似元气骑士 / Enter the Gungeon |
| 地面 | 正交菱形感弱化为「矩形瓦片 + 侧墙竖条」，便于 32×32 对齐 |
| 角色 | 略带立体：头顶、肩线、脚底阴影；不画完全正面 |
| 深度 | 靠阴影、墙高、遮挡排序表达；不依赖真 3D |
| 缩放 | 预览时 `image-rendering: pixelated`，整数倍放大（2× / 3× / 4×） |

## 瓦片规格

- **基础格子**：**32×32 px**
- **角色帧**：32×32（idle 四帧）
- **道具**：16×16 或 32×32
- **房间合成**：约 320×240（10×7.5 格），便于截图预览
- **UI 对话框**：256×64（九宫可拉伸边框，本阶段为整图）

## 调色板（有限、近邻友好）

命名 `cyber-hutong-16`，共约 16 色，禁止半透明（UI 例外可用透明底）：

| 索引 | Hex | 用途 |
|------|-----|------|
| 0 | `#0B0E1A` | 深空背景 / 夜巷阴影 |
| 1 | `#1A2744` | 巷道地面暗青 |
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

导出 PNG 时尽量索引调色或严格贴合上述色值，保证最近邻放大不糊边。

## 资源清单（Phase-1）

```
public/assets/
  characters/  hero_idle_0.png … hero_idle_3.png
  tiles/       tileset_32.png          # 横条：地面/墙/霓虹砖等
  props/       desk.png, chair.png, neon_sign.png, lantern.png,
               plant.png, server_rack.png, hologram.png
  rooms/       room_office.png, room_meeting.png, room_hutong_gate.png
  ui/          dialog_frame.png
```

## 风格关键词

霓虹雨夜、青砖胡同、外卖灯牌、老槐树 + LED、工位显示器蓝光、会议室全息桌、胡同口牌楼 + 扫描线门禁。

## 非目标（本阶段不做）

动画状态机、碰撞、战斗、存档、登录、LLM NPC、真实地图编辑器。

## 预览约定

静态 HTML / 极简 Next 页：`image-rendering: pixelated`，灰底网格，分组展示角色帧 / 瓦片 / 道具 / 房间 / UI。

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
