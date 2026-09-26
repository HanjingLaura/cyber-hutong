# 场景：胡同 · 反打（`hutong_reverse`）

> 精致像素 · 256×192 · 2.5D · 桌面留物位

反打 180°：无墙 · 同一 8 座换朝向

同一房间摄像机转 180°。无墙、无装饰。原先看后脑勺的一排现在看正脸，原先看正脸的一排现在看后脑勺。左右对调。还是那 8 桌 8 椅同一些人。

- `public/assets/scenes/hutong_reverse/scene_hutong_reverse.png`
- `public/preview/zoomed/hutong_reverse.png`
- View 1 `hutong`：素墙，n* `sit_back`，s* `sit_front`，`walk_y=108`。
- View 2 `hutong_reverse`：无墙，座位 180° 对调，n* 改 `sit_front`，s* 改 `sit_back`，`walk_y=96`。

不描摹真人，不提交 refs。
