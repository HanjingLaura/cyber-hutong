# 赛博胡同 Cyber Hutong

精致像素 · **2.5D 可读** · 小地图高密度。当前仓库为素材 + 静态预览，无 Agent / 登录 / 数据库。

Laura 过夜纠正后的范围：**只做她点名的 7 个场景**，八人 cast 按照片线索重画，桌椅留出放杯子 / 笔记本 / 盲盒的空位。

产品主循环（见 [`design/parallel-universe.md`](design/parallel-universe.md)）：**本人在线操控** → 离线由 agent 驱动同一小人 → agent **学习在线操作轨迹**。蒸馏 Q&A 只做冷启动。

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
| 画廊 | http://localhost:4173/ | 八人 sheet + 7 个保留场景 |
| 一天故事板 | http://localhost:4173/#day | 只链保留房 |
| 房间漫游 | http://localhost:4173/#walk | 点房间切换，cast_01 走一个往返 |
| 放大图 | `public/preview/zoomed/` | 各房 3× nearest |

也可直接打开 `public/index.html`。

## 保留场景

| ID | 中文 | 要点 | 路径 |
|----|------|------|------|
| `hutong` | 胡同工位区 | **朝里拍**，一边四座，里侧朝墙，桌面留空 | `public/assets/scenes/hutong/` |
| `elevator` | 电梯间 | 米黄石材、开门、雕塑台座、屏与按钮 | `public/assets/scenes/elevator/` |
| `hawaii` | 夏威夷 | 窗边，座位留物位 | `public/assets/scenes/hawaii/` |
| `popmart` | 泡泡玛特店 | 细格盲盒墙，柜台留空 | `public/assets/scenes/popmart/` |
| `restroom` | 厕所 | 四隔间 + 两水池 | `public/assets/scenes/restroom/` |
| `office` | 普通工位 | 岛式桌，空垫 | `public/assets/scenes/office/` |
| `meeting` | 会议室 | 长桌中央留空 | `public/assets/scenes/meeting/` |

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
│   ├── generate_rooms.py   # 仅 7 房
│   └── generate_assets.py  # 总入口
└── public/
    ├── index.html
    ├── assets/{characters,rooms,scenes,props,tiles,ui}/
    └── preview/{zoomed,cast_sheet.png,room_sheet.png}
```

## 技术约定

- 瓦片 32×32，场景 256×192，最近邻放大
- 干净 1px 描边，统一调色，比过夜粗块更细
- 预览 `image-rendering: pixelated`

## 许可证

私有仓库。资产与代码归项目所有者。
