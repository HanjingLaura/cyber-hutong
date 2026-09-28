# Cursor 接续入口

shared/contracts.ts 定义认证、场景、客户端指令、持久化契约。
server/world-runtime.mjs 将已有行为引擎连接到存储层：串行更新，先提交状态和 outbox，成功才替换内存状态，失败保留原状态。

下一步按 docs/handoff 实现 SQLite repository、认证路由、场景寻路和 Canvas。src 是架构骨架，不是已完成后端；未引入依赖。WorldRepository 必须原子检查版本并提交；多实例需世界所有权锁。命令消费者按 outbox ID 幂等执行，成功后 acknowledge，失败重试。不要从 update 返回值直接执行副作用。

HTTP/WS 层必须验证会话、控制租约和 sequence，并验证坐标、速度、交互距离。只有服务端可信代码能调用 runtime.update。示例：runtime.update(engine => engine.tick(Date.now()))。

角色/场景素材、登录预览、行为代码与交接文档均已在本仓库。私聊服务在 `src/server/index.mjs`，百炼配置在根目录 `.env`。
