# Franco 工位电话与 Laura 指挥台萨克斯

Franco 在胡同自己的 R4 工位坐下，自动循环打电话动作。保持 `working` 状态和原有电脑点击入口，电脑仍打开 Grok Bot、Codex、Ani、飞书。别人的工位只休息，起身恢复普通动作。电话是动作自带道具，不覆盖或消耗玩家持物；起身后仍显示原持物。前后视角分别使用正面 / 背面两帧，背面头部与举起的手机显示在椅背上方。

Laura 在排练厅按 E 上指挥台，自动循环四帧吹萨克斯动作，同时本地播放原创短旋律。音色采用 Web Audio 的谐波、滤波和轻微颤音合成。其他玩家看得到动作；合成音只在 Laura 的操作页面播放。E / Esc 下台、失焦、切换房间时停止声音；仍在指挥台时重新聚焦恢复。沿用既有 `podium` 状态同步，不增加后台活动类型或改变钢琴控制。人物深度为 191，脚显示在指挥台表面。

两组素材由内置 imagegen 生成，以原有角色图集为身份与像素风参考，保留透明 alpha。使用现有 `pixelArt: true`、`roundPixels: true` 和 `image-rendering: pixelated`，未新增品牌、导航、外壳、渐变或装饰卡片。

## 保存的素材与提示词

- [Franco 完整动作图](../assets/characters/team/v12/franco-office-call.png)，正 / 背面各两帧。
- [Laura 完整动作图](../assets/characters/team/v12/laura-saxophone.png)，正面四帧。
- [最终生成提示词](character-easter-prompts.json)，包括参考图与内置工具模式记录。
- 对应元数据：`assets/metadata/franco-office-call-v1.json`、`assets/metadata/laura-saxophone-v1.json`。
- `node scripts/build-character-easter-poses.cjs` 从透明像素范围重建元数据，保留原始图像。

## 验证

`node scripts/verify-character-easter-actions.mjs` 检查实际 E 坐下 / 上台、前后视角、真实鼠标点击电脑打开四个 App、非本人座位、起身、多人动作同步、萨克斯合成发声、失焦与恢复、切场景停音及人物层级。入口位置由测试夹具安排，操作使用浏览器键盘 / 鼠标。

`node scripts/verify-piano.mjs` 检查原有钢琴键盘 / 鼠标弹奏、和弦、起身和座椅退出。工位权限与 App 启动相关七项服务器测试、TypeScript 检查及 Vite 构建通过。截图保存于 `output/playwright/franco-call-front.png`、`franco-call-back.png`、`laura-saxophone-podium.png`。实际场景截图已检查像素风与道具可读性。
