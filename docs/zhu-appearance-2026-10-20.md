# 朱志鑫双造型与 MANNER 出口文字

版本：`2026-10-20-zhu-looks`。沿用工作区现有改动，未提交 Git。

- MANNER 仅移除地面的“出口”字样；出口位置、E 键、地图切换保持可用。
- 朱志鑫进入演唱会时各以 50% 概率显示原造型或帽子眼镜造型。同次停留固定，返回时重新选择。外观为本地装饰，不跨客户端同步；交互 ID、Jilly 所属关系、位置和碰撞保持原样。
- 用户提供的新原图完整保存于 `assets/npcs/zhu-zhixin-winter-green.png`，SHA256：`1c794e67196f0850b37a35676f3c87e1975dd9e6ccb57a3554086d5bb0f97c6b`。只在运行时裁取正面、复用既有绿幕处理；旧造型保留用于随机出现，无重复候选目录。
- 无新增模型请求、后台任务或 token 消耗。

## 隔离验证

- `node --test --test-concurrency=4 server/*.test.mjs`：355/355 通过，`output/zhu-server-tests.log`。
- `npm run build`：类型检查及构建通过，`output/zhu-build.log`。
- `node scripts/verify-zhu-appearance.mjs`：真实 Chrome、隔离 SQLite、关闭模型和 PartyKit，`output/zhu-appearance-1792497967236/verification.json`。覆盖实际地图往返、两种造型、停留稳定、透明背景、同一互动 ID；MANNER 原出口按 E 正常打开地图。
- 已检查实机截图；未引入页面滚动、通用 SaaS 容器、装饰品牌或新 UI 风格。
- 素材引用审计：0 丢失、0 重复组，`output/zhu-art-audit.log`。

## 线上验证

- 已部署并提升到正式域名：`https://hanjing-laura.vercel.app/cyber-hutong/`。部署 ID：`dpl_2nuSbGihZswFLihkx8h9epMwZxhe`，不可变地址：`https://cyber-hutong-l99h3ibds-hanjinglauras-projects.vercel.app`。
- 只读 Chrome 冒烟通过：`output/production-zhu-looks-1792498162462/verification.json`。版本号正确、登录页加载、资料文件不可公开读取，百炼配置就绪且无后台模型调用。
- 全量 63 个既有批准素材及两张朱志鑫原图对应构建素材验证通过：`output/production-pixel-art-assets-1792498191600/verification.json`。46 个外部素材哈希匹配，19 个内联素材存在于实际部署 JS。
- 生产检查不登录、不发聊天、不调用模型；线上真人互动尚未验证，不以隔离浏览器结果替代。

## 所有场景出口文字复查

用户补充要求仅移除场景中的“出口”文字。全量检索后，上一版 MANNER 标签是唯一独立“出口”文字；其余场景无须修改。已对当前同版代码的 21 个场景逐个在隔离 Chrome 中实测：场景 DOM / Phaser 无独立“出口”标签，截图未发现背景中烧录的出口字样，每个场景在实际出生出口按 E 均可打开地图。结果：`output/zhu-appearance-1792498914586/verification.json`，21/21 通过；总览：`output/exit-text/all-scenes.png`。本次仅补充验收脚本，没有新增产品改动或再次部署。界面中的操作提示、地图出口方向、服务端错误提示保留。
