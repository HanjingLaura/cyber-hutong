# 场景变体 A / B / C（Soul Knight 选型）

> Laura 选型用。每场景至少三套；**不删 cast**。主场景 `scene_*.png` 暂用 **B（dense + warmer）**，可随时换成 A/C。

生成：`python3 scripts/generate_scene_variants.py`  
输出：`public/assets/scenes/{restroom,popmart,hawaii}/variants/{a,b,c}/scene.png`  
4× 对照：`/workspace/cyber-hutong-shots/variants/`

## 共同风格锁

- Soul Knight / 元气骑士：cute chunky 2.5D、干净描边、可爱可读
- **禁止**泥灰脏厕写实、大片空地、muddy greys
- 厕所 = 游戏风 pastel dungeon-shop toilet（干净瓷砖 + 可爱道具）

## Trait 矩阵

| 变体 | 调色板 palette | 道具密度 props | 光照 light |
|------|----------------|----------------|------------|
| **A** | 更干净 pastel / cooler | 中等（仍填空，不留大片空地） | 柔和偏冷-舒适 |
| **B** | 更暖（peach / amber / candy warm） | **最密**（地毯、柜、植、挂饰、桌面杂物） | **更暖** 光斑 |
| **C** | 交替强调色（lilac·sky / cream-olive） | 中偏密 + 气球/海报等点缀 | 更冲的 rim / accent 光点 |

## 厕所 restroom（仍：4 stalls + 2 sinks outside）

| | A mint pastel | B peach warm dense | C lilac arcade |
|--|---------------|--------------------|----------------|
| 地板 | 薄荷绿×白瓷 | 蜜桃粉瓷 | 丁香紫瓷 |
| 隔间 | 薄荷绿门 | 暖杏门 | lilac 门 |
| 道具 | 灯、垫、植、标牌、柜、长凳 | + 皂架、地贴、更多植 | +  dispensers / 强调色点缀 |
| 情绪 | 干净 dungeon-shop | 暖萌公厕游戏风 | 街机紫可爱风 |

## 泡泡玛特 popmart

| | A classic candy | B peach warm dense | C lilac×sky |
|--|-----------------|--------------------|-------------|
| 地板 | 粉×薄荷格 | 桃×粉格 | lilac×天蓝格 |
| 霓虹 | 粉/青 | 橙粉/黄 | 紫/天蓝 |
| 道具 | 货架墙 + 柜台盲盒 + 拆盒手办 | + 中层货架、气球、价签、更多落地盒 | + 气球、路径霓虹点 |

## 夏威夷 hawaii（仍：窗边长桌 + 三座位纵向）

| | A honey soft | B amber dense | C cream-olive |
|--|--------------|---------------|---------------|
| 木地板 | 蜂蜜暖木 | 琥珀更深暖 | 橄榄奶油木 |
| 日光 | 柔暖斜射 | 更强琥珀光柱 | 偏冷绿 rim 点缀 |
| 道具 | 三椅 + 本/杯/植/夹 | + 地毯、边几、海报、便签、更多植与杯 | + 海报/边几/植 denser |

## 选型后

把选定变体拷到主路径即可，例如：

```bash
cp public/assets/scenes/restroom/variants/a/scene.png \
   public/assets/scenes/restroom/scene_restroom.png
```

或改 `scripts/generate_scene_variants.py` 末尾 promote 逻辑。
