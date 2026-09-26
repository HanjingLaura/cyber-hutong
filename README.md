# 赛博胡同 Cyber Hutong

精致像素 · **2.5D 可读** · 小地图高密度。v2 画质轮次见 [`design/iteration-rounds-v2.md`](design/iteration-rounds-v2.md)。当前仓库为素材 + 静态预览，无 Agent / 登录 / 数据库。

Laura 当前范围：**11 个场景**（原 7 + concert / cafe / gym / mixian），八人 cast 按证件照 + 胡同合影重画并出 A/B/C，桌椅留出放杯子 / 笔记本 / 盲盒的空位。

## 产品主循环（高于画风）

Laura 刚定，写入 [`design/parallel-universe.md`](design/parallel-universe.md)，不要只画画。

1. **Online-control · 本人在线** — 玩家直接操控自己的小人（移动 / 进房 / 放桌上物品 / 对话）。
2. **Offline-agent · 本人离线** — 该角色的 agent 驱动**同一个**小人在胡同里活动。
3. **Behavior-learning · 学习** — agent 必须学习真人在线时的操作（常去房间、停留时长、桌面摆物、社交对象、摸鱼偏好）。蒸馏 Q&A / PersonaCard **只做冷启动**；在线操作日志才是持续训练 / 更新信号。

MVP 先「录操作事件 → 规则 / 事件牌回放」，本周不必接大模型。卡如何合并见 [`design/distill-spec.md`](design/distill-spec.md)。场景与八人精致像素继续，不冲突。

## 本地预览

```bash
# 重新生成像素图（需 Python3 + Pillow）
python3 -m pip install Pillow
python3 scripts/generate_assets.py

# 分步
python3 scripts/generate_cast.py
python3 scripts/generate_rooms.py

# 本地打开画廊
npx --yes serve public -p 4173
```

浏览器：

| 页 | URL | 看什么 |
|----|-----|--------|
| 画廊 | http://localhost:4173/ | 八人 sheet + A/B/C + 照片对照 + 11 房 |
| 一天故事板 | http://localhost:4173/#day | 只链保留房 |
| 房间漫游 | http://localhost:4173/#walk | 点房间切换，cast_01 走一个往返 |
| 放大图 | `public/preview/zoomed/` | 各房 3× nearest |
| 对照 | `public/preview/cast_photo_map.png` | 左栏像素 cue（不是真人照片）/ 右栏 A B C |
| 多版 | `public/preview/cast_variants_sheet.png` | 八人 × A/B/C |

也可直接打开 `public/index.html`。

## 保留场景

| ID | 中文 | 要点 | 路径 |
|----|------|------|------|
| `hutong` | 胡同工位区 | 就两排平行工位；远墙只留 ttc / 镜框 | `public/assets/scenes/hutong/` |
| `elevator` | 电梯间 | 米黄石材、开门、雕塑台座、屏与按钮 | `public/assets/scenes/elevator/` |
| `hawaii` | 夏威夷 | 开窗见蓝天高楼 · 左竖桌 3 椅 · 右竖桌 3 椅 · 约六座 | `public/assets/scenes/hawaii/` |
| `popmart` | 泡泡玛特店 | 细格盲盒墙，柜台留空 | `public/assets/scenes/popmart/` |
| `restroom` | 厕所 | 四隔间 + 两水池 | `public/assets/scenes/restroom/` |
| `office` | 普通工位 | 岛式桌，空垫 | `public/assets/scenes/office/` |
| `meeting` | 会议室 | 长桌中央留空 | `public/assets/scenes/meeting/` |
| `concert` | 演唱会内场 | 舞台 + 中央过道观众席 | `public/assets/scenes/concert/` |
| `cafe` | 咖啡店 | 街窗、柜台空 pad、四张小桌 | `public/assets/scenes/cafe/` |
| `gym` | 健身房 | 镜墙、深蹲架、跑步机 | `public/assets/scenes/gym/` |
| `mixian` | 米线店 | 红墙灯笼、蒸汽锅、四桌双空 pad | `public/assets/scenes/mixian/` |

已下架（画廊 / 一天 / 漫游均不链）：茶水间、打印区、楼梯过道、天台、老板办公室、快递门口、旧胡同口牌楼。

画布统一 **256×192**。角色 32×32。

## 八人 cast

见 [`design/cast.md`](design/cast.md)。预览 `public/assets/characters/cast_sheet.png`。

真人参考照片 **不入库**。

## 目录

```
cyber-hutong/
├── design/                 # 美术简报、cast、一天、各场景
├── scripts/
│   ├── pxlib.py            # 1px 描边 / 2.5D 盒
│   ├── generate_cast.py
│   ├── generate_rooms.py   # 11 房
│   └── generate_assets.py  # 总入口
└── public/
    ├── index.html
    ├── assets/{characters,rooms,scenes,props,tiles,ui}/
    └── preview/{zoomed,cast_sheet,cast_variants_sheet,cast_photo_map,room_sheet}
```

## 技术约定

- 瓦片 32×32，场景 256×192，最近邻放大
- 干净 1px 描边，统一调色，比过夜粗块更细
- 预览 `image-rendering: pixelated`

## 许可证

私有仓库。资产与代码归项目所有者。
