# 赛博胡同 · Product

## Audience

公司八人内测用户，以及偶尔进来逛像素办公室的访客。大家熟悉 WASD / E 这类像素游戏操作，中文为主。

## Purpose

在浏览器里进入一间共享的像素平行办公室：走路、坐下、聊天、领角色、逛盲盒店 / 地鼠小游戏，把「在胡同一起上班」变成可玩的日常场景。

## Operating context

- 主界面是全屏 Phaser 世界；DOM 只负责登录、HUD、聊天、地图、设置与机台弹层。
- 默认从登录墙进入，随后立刻沉浸进游戏画布。
- 同时服务桌面与手机触控；游戏投影固定 16:9。
- 品牌名「赛博胡同 / cyber-hutong」是第一视觉信号，不能被通用 SaaS 文案盖过。

## Constraints

- 保留像素渲染（`image-rendering: pixelated`）与直角机壳观感。
- 不引入重型 UI 框架；CSS + 现有 dialog / panel 结构即可。
- 中英混排：中文可读优先，英文作副信号（机台标签、坐标感）。
- 避开紫渐变、Inter/系统默认字体、纯灰黑、层层卡片套娃等 AI 默认审美。

## Voice

短、具体、像机台提示音：告诉玩家「现在能做什么」，少用空泛营销句。

## Evidence

本地 `npm run dev` 打开登录墙与 HUD；线上 `https://hanjing-laura.vercel.app/cyber-hutong/`。
