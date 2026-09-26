# 场景：胡同工位区（`hutong`）

> 精致像素 · 256×192 · 2.5D · 桌面留物位

正打：素墙 + 上 4 桌下 4 桌 · 中间 8 椅

摄像机朝北墙。素墙一条（无 ttc / 镜框）。上排椅朝北墙看后脑勺，下排椅朝下看正脸。只要地板、8 桌、8 椅、坐着的人；桌面空着。

- `public/assets/scenes/hutong/scene_hutong.png`
- `public/preview/zoomed/hutong.png`
- View 1 `hutong`：素墙，n* `sit_back`，s* `sit_front`，`walk_y=108`。
- View 2 `hutong_reverse`：无墙，座位 180° 对调，n* 改 `sit_front`，s* 改 `sit_back`，`walk_y=96`。

不描摹真人，不提交 refs。
