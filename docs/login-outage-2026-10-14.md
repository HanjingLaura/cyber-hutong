# 登录请求失败：事件重复导致冷启动崩溃

2026-10-14 用户登录页显示“请求失败”。通过线上 `/api/me/` 和 `/api/health/` 实际浏览器访问复现 `500 FUNCTION_INVOCATION_FAILED`。Vercel 运行日志确认：`UNIQUE constraint failed: experiences.account, experiences.event_id`，在 `prepareReplica` 启动载入中触发；因此没有进入密码校验流程。原始日志 `output/login-failure-runtime.log`。

## 根因与修复

两个实例在拉取前均记录相同共享事件，实例各自生成不同 AUTOINCREMENT 序号，远端复制行按物理序号存储，因此都能提交。下一次冷启动按序号 UPSERT 时，与本地 `(account,event_id)` 唯一索引冲突。

`server/replica.mjs` 对共享经历新增狭窄的逻辑键合并：只针对 experiences 的非空事件编号与账号组合，选择最新远端版本。兼容冷启动、普通拉取、权威同步和待提交变更协调；避免旧物理序号的删除标记删除新的逻辑记录。保留本地唯一约束，其他账号、消息、邀约约束保持原检查。没有清空或直接修改生产数据库的原始复制行。

`src/multiplayer/api.ts` 将平台返回的非 JSON 500 错误明确显示为“服务器暂时不可用，请稍后重试”，避免登录页只显示模糊“请求失败”。

## 验证

新测试复现“两实例同时写同一事件，第三实例冷启动”的实际竞争，修复前失败、修复后通过。共享事件专项 3/3、复制专项 15/15；独立复核复制、权限、回滚、会话撤销相关 26/26 通过。客户端错误提示回归先失败后通过。最终完整测试 266 项通过、0 失败，日志 `output/login-replica-suite.log`。

生产部署 `dpl_Cs1Bxd85zKFDn1byETYbquJLgrDd` 已 READY，正式构建通过，原域名已更新。实际浏览器确认健康检查 `ok:true`、`release:2026-10-14-login-replica`；`/api/me/` 返回 200；使用明确不存在的诊断账号验证 `/api/login/` 返回正常 JSON 401“用户名或密码不正确”，不再是平台 HTML 500。没有读取或使用用户真实密码，也没有创建生产诊断账号。部署日志 `output/login-replica-deploy.log`。

此前测试没有覆盖同一共享事件跨实例竞争后再冷启动的组合，本次增加对应回归。线上验证确认实际云端重复数据可正常加载；用户真实账号成功登录仍由其原密码重试确认。
