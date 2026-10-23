# Laura 偏好补充与上线记录

用户在本次对话提供：喜欢发“啊哈哈哈哈哈哈”、单独发“？”、问“为啥”、说“我不行了”“我绷不住了”；喜欢参加黑客松、吹萨克斯与长号、滑滑板和吃好吃的。

`server/laura-profile-candidate.mjs` 保存候选资料及来源。只在 Laura 没有保存新分身资料时返回，不覆盖本人已保存资料；revision 0、confirmed false、enabled false。没有编造真实对话样例、参赛结果或乐器水平。回复边界要求按语境使用表达习惯，避免机械重复。

测试：完整 184 项通过；浏览器三账号检查通过；TypeScript 与正式构建通过。完整测试初次并行复跑中相册超大请求出现 fetch 连接失败，专项 7/7 与最终完整低并发复跑均通过。

生产部署使用现有 `.vercel/project.json` 对应的 `cyber-hutong` 项目，用户明确授权更新现有线上链接。Vercel CLI 返回成功，target `production`、readyState `READY`；部署编号 `dpl_EUbiCdTi2sgh4EnNRstauDcNMLLV`，已绑定 `https://cyber-hutong.vercel.app`。生产构建通过，用时约 1 分 13 秒。游戏入口 `https://cyber-hutong.vercel.app/cyber-hutong/`。部署成功不等于真人口吻与线上 PartyKit 全流程已验收，后续由用户测试。

测试步骤：登录 Laura → 更多 → 设置 → Laura 分身 → 核对资料与公开范围 → 勾选确认与回复开关 → 保存。退出 Laura 的所有窗口，离线满五分钟后用另一成员账号私聊，或在公共频道用成员选择器 @ Laura。本人回到线上时，未发送的分身回复取消。
