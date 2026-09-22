# 赛博胡同 Cyber Hutong

Soul Knight 风格的 **2.5D 斜俯视** 像素探索小品。当前仓库为 **Phase-1：像素资源 only**。

> 北京胡同 × 赛博霓虹 —— 先把地砖、角色 idle、道具和房间 / 命名场景 mock 画出来。

## 本阶段范围

| 做 | 不做 |
|----|------|
| 32×32 像素资产（PNG） | Agent / LLM |
| 中文设计简报 | 登录 / 鉴权 |
| 命名场景「夏威夷」 | 数据库 / 存档 |
| 静态预览画廊 | 完整游戏循环 |

详见 [`design/art-brief.md`](design/art-brief.md)。

## 命名场景

| ID | 中文 | 说明 | 路径 |
|----|------|------|------|
| `hawaii` | 夏威夷 | 靠窗长桌 + **三座位纵向排列**；卷帘、笔记本、保温杯、绿植、文件夹 | [`design/scenes/hawaii.md`](design/scenes/hawaii.md) → `public/assets/scenes/hawaii/` |

## 快速预览

```bash
# 重新生成像素图（需 Python3 + Pillow）
python3 scripts/generate_assets.py

# 本地打开画廊
npx --yes serve public -p 4173
# 或直接用浏览器打开 public/index.html
```

浏览器访问：`http://localhost:4173/`  
资源目录：`public/assets/`

## 目录结构

```
cyber-hutong/
├── README.md
├── design/
│   ├── art-brief.md              # 调色板、2.5D、瓦片规格
│   └── scenes/
│       └── hawaii.md             # 夏威夷场景简报
├── scripts/
│   └── generate_assets.py        # Pillow 生成全部 PNG
└── public/
    ├── index.html                # 像素预览画廊
    └── assets/
        ├── characters/           # 角色 idle 四帧
        ├── tiles/                # 32×32 地砖条带
        ├── props/                # 桌椅、霓虹牌、灯笼等
        ├── rooms/                # 工位 / 会议室 / 胡同口
        ├── scenes/hawaii/        # 夏威夷合成 + 局部道具
        └── ui/                   # 对话框边框
```

## 技术约定

- **瓦片**：32×32，有限调色板，最近邻友好
- **视角**：斜俯视 2.5D（侧墙 + 顶面暗示体积）
- **预览**：CSS `image-rendering: pixelated`，整数倍放大

## 许可证

私有仓库。资产与代码归项目所有者。
