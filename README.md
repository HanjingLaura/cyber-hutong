# 赛博胡同 Cyber Hutong

Soul Knight 风格的 **2.5D 斜俯视** 像素探索小品。  
当前：**Phase 1.5 — 日常公司素材 + 平行宇宙可感预览**（无 Agent 后端 / 无登录 / 无数据库）。

> 北京胡同 × 赛博霓虹公司。远期：问答蒸馏出「公司版的你」，在平行宇宙房间里做你平时会做的事。

## 明早验收（上海）怎么打开

```bash
# 已生成的 PNG 在 public/ 里，直接预览即可
npx --yes serve public -p 4173
```

浏览器打开：

| 页 | URL | 看什么 |
|----|-----|--------|
| 画廊 | http://localhost:4173/ | 6 间新房 + 道具分类 + cast 10 帧 + 3 NPC |
| 一天故事板 | http://localhost:4173/#day | 进门→工位→拆盒→茶水间→开会→天台 |
| 房间漫游 | http://localhost:4173/#walk | 点房间切换，角色走一个往返 |
| 放大截图 | http://localhost:4173/preview/zoomed/ | 各房 3× PNG，方便直接截 |

也可双击 `public/index.html`（file://）。设计文档在 `design/`，用编辑器打开即可。

重新生成全部像素（需 Python3 + Pillow）：

```bash
python3 scripts/generate_assets.py
# 分步：
python3 scripts/generate_cast.py
python3 scripts/generate_scene_variants.py
python3 scripts/generate_daily_life.py
```

## 本阶段范围

| 做 | 不做 |
|----|------|
| 新日常房间 ≥6 + 缩略 + 3× 放大 | 假大空 LLM agent 后端 |
| 分类道具（电脑/杯/快递/白板/打印机…） | 登录 / 鉴权 / 数据库 |
| cast 方向与走动帧 + 3 个小 NPC | 真人照片进仓 |
| 平行宇宙三份设计（卡 / 蒸馏 / 一天） | 真日历、真聊天同步 |
| 静态画廊 + 故事板 + canvas 漫游 | 完整游戏循环 |

平行宇宙怎么走：先读 [`design/parallel-universe.md`](design/parallel-universe.md)。  
题库 + JSON：[`design/distill-spec.md`](design/distill-spec.md)。  
故事板：[`design/day-in-life.md`](design/day-in-life.md)。

## 房间总表

| ID | 中文 | 地板 / 光 | 路径 |
|----|------|-----------|------|
| `hawaii` | 夏威夷 | 暖木 + 窗缝日光 | `public/assets/scenes/hawaii/` |
| `popmart` | 泡泡玛特店 | 粉×薄荷糖果格 | `public/assets/scenes/popmart/` |
| `restroom` | 厕所 | pastel 瓷 | `public/assets/scenes/restroom/` |
| `office` | 工位 | 暗青绿 | `public/assets/rooms/room_office.png` |
| `meeting` | 会议室 | 深紫霓虹 | `public/assets/rooms/room_meeting.png` |
| `gate` | 胡同口 | 夜石板 | `public/assets/rooms/room_hutong_gate.png` |
| **`pantry`** | **茶水间** | 陶土暖砖 + 蒸汽黄灯 | `public/assets/rooms/room_pantry.png` |
| **`print`** | **打印区** | 冷灰油地胶 | `public/assets/rooms/room_print.png` |
| **`hallway`** | **楼梯/过道** | 夜砖 + 青霓虹 | `public/assets/rooms/room_hallway.png` |
| **`rooftop`** | **天台** | 水泥 + 月光/城市窗 | `public/assets/rooms/room_rooftop.png` |
| **`boss`** | **老板办公室** | 人字纹木 + 金线酒红 | `public/assets/rooms/room_boss.png` |
| **`delivery`** | **快递门口** | 户外水泥 + 黄昏 | `public/assets/rooms/room_delivery.png` |

命名场景仍各有 A/B/C。主图 `scene_*.png` = **变体 B**。Laura 可改选 A/C（见 [`design/scenes/variants.md`](design/scenes/variants.md)）。

## 目录结构

```
cyber-hutong/
├── design/
│   ├── art-brief.md
│   ├── cast.md
│   ├── parallel-universe.md      # 蒸馏 → 卡 → 房间微行为
│   ├── distill-spec.md           # 12 题 + PersonaCard JSON
│   ├── day-in-life.md            # 一天故事板
│   └── scenes/                   # 各房简报（含 6 间新房）
├── scripts/
│   ├── generate_assets.py        # 总入口（含 cast / 变体 / 日常）
│   ├── generate_cast.py          # 8 cast + 3 NPC + 方向帧
│   ├── generate_scene_variants.py
│   └── generate_daily_life.py    # 新房 / 分类道具 / 放大图
└── public/
    ├── index.html                # 画廊 · #day · #walk
    ├── preview/zoomed/           # 3× 截图
    └── assets/
        ├── characters/cast_XX/   # 10 帧
        ├── characters/npc_*      # 快递 / 咖啡师 / 路人
        ├── tiles/
        ├── props/                # 根目录别名 + devices/drinks/parcels/…
        ├── rooms/ + rooms/thumbs/
        ├── scenes/{hawaii,popmart,restroom,pantry,print,hallway,rooftop,boss,delivery}/
        └── ui/
```

## 风格锁

- 32×32 瓦片，chunky 轮廓，斜俯视 2.5D
- **禁止**所有房间共用同一套深蓝网格再换道具
- 预览 `image-rendering: pixelated`，整数倍放大
- **不要提交真人照片 refs**

## 许可证

私有仓库。资产与代码归项目所有者。
