# 场景：胡同 · 反打（`hutong_reverse`）

> 精致像素 · 512×480 · 2.5D · 桌面留物位

反打 180° 512×480：无墙 · 同一通长桌 8 座换朝向

同一房间摄像机转 180°。无墙、无装饰。原先看后脑勺的一排现在看正脸，原先看正脸的一排现在看后脑勺。左右对调。还是两张通长空桌、8 椅、同一些人。

- `public/assets/scenes/hutong_reverse/scene_hutong_reverse.png`
- `public/preview/zoomed/hutong_reverse.png`
- View 1 `hutong`：白墙 ttc + 少而大的灰框，每排一张通长空桌，n* `sit_back`，s* `sit_front`，`walk_y=220`。
- View 2 `hutong_reverse`：无墙（所以无牌无框），座位 180° 对调，n* 改 `sit_front`，s* 改 `sit_back`，`walk_y=200`。

不描摹真人，不提交 refs。
