# 九人侧面动作

九位人物（包括 NPC Celine）的侧面走路和跑步使用完整重绘的透明图集，文件位于 `assets/characters/team/v4/`。每张图集两行两列：第一行是走路的两个交替步态，第二行是跑步的两个交替步态。每个格子都是完整人物，没有拼接手臂或腿。

绘制时同时参考通过遮挡检查的动作和原版站立、坐姿、打字图集，保留服装、眼镜、发型与配色，统一像素描边和紧凑的头身比例。同侧手臂与腿反向摆动：靠近镜头的腿向前时，完整可见的手臂向后；远侧手臂向前时，由身体遮挡上臂，只露出袖口和手。

`assets/metadata/team-motion-v4.json` 记录 36 个完整人物帧。`scripts/build-team-motion-v4.cjs` 从透明图集读取边界和脚点，生成此索引；不改变图片。`src/multiplayer/avatar.ts` 和 `src/office-guests.ts` 分别用于玩家和 Celine。左侧动作采用整个人物镜像。站立、坐下、持物、打字等动作仍使用原有素材；正面工位打字稍向上移动，让双手露出。

生成提示和来源记录在图集目录的 `generation-prompts.json`。浏览器验证脚本为 `scripts/verify-members-auth.mjs`，截图输出至 `output/playwright/`。检查入口为 `/members.html`，含九位人物与逐帧控制。
