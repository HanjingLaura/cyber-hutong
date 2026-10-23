# 八人人设、真实模型与Celine生产发布

后续生产版本已更新为 `2026-10-19-scene-agents`，本页保留首次发布记录；最新验收和发布见 [场景、互动与八人验收](acceptance-2026-10-19.md)。

2026-10-19，发布到现有Vercel生产项目 cyber-hutong。

- 生产入口：https://hanjing-laura.vercel.app/cyber-hutong/
- 项目域名：https://cyber-hutong.vercel.app
- 发布ID：`dpl_DzfxJG4fvqaxNxqrc1hKfbfEUDD1`
- 固定发布地址：https://cyber-hutong-6x71qfhl5-hanjinglauras-projects.vercel.app
- 发布状态：READY，production别名已切换。
- 服务版本：`2026-10-19-agent-budget`；源为本地 d57d36d 基础上的已验收工作区，未提交或推送Git。

## 已发布行为

八位Agent全部从 `server/agent-personas/*.json` 读取已提供的人设、昵称和截图样例，在后台启用。前端不展示人设，也没有资料读写接口。本人在线由真人控制，心跳过期后等待5分钟才允许离线聊天接管；私聊直接触发、公共频道明确 @ 才触发，本人返回取消未发送回复。

真实服务为百炼北京兼容接口、qwen-flash、非思考模式。现有已验证密钥作为Vercel生产Secret配置；环境同时明确模型优先级与预算，没有将密钥打包进前端。Turso、PartyKit等现有配置保留。

Celine继续作为独立彩蛋，不占八人人设名额；原有招呼、权重、随机间隔、走动与座位机制保留。招呼是固定程序规则，不调用模型。

## Token策略

1. **按需调用**：生产环境禁用后台活动选择、离线角色自聊和活动台词的模型请求。没有模型定时心跳、定期总结或离线补跑。真人消息才会触发聊天回复，Agent消息不触发其他Agent。
2. **持久化共用预算**：北京时间每天全服最多200次请求、50,000 token预算。请求前通过现有持久化事务预留输入UTF-8字节数加输出/封装余量，防止并发先消费后发现超额；成功按提供商实际用量结算。失败或缺少用量时保留保守额度，不把未知请求当零成本。沿用llm_usage表，无新表或列迁移。
3. **单次有界**：最多180输出token、16,000输入字节；最多最近6条同频道消息、4个可见对话样例。输入过大先减少历史，再拒绝超限请求。
4. **限制重复和积压**：同消息去重，有界队列、最多2个模型并发、任务10分钟过期，429退避且不无限重试。请求超时、模型错误不伪造分身回复。

模拟无人使用10天的回归覆盖所有后台模型入口：模型网络调用0、用量记录0；随后真人聊天仍可调用模型。规则世界状态与Celine仍能工作，不以LLM维持其存活。这里的token预算是保护额度，不是提供商账单金额；失败预留可能使保护额度先于实际账单额度耗尽。

## 验证

- 全量服务端320/320，地鼠5/5，TypeScript与本地正式构建通过；Vercel生产构建通过。
- 8个隔离本地账号、文件SQLite、真实模型：7条公共回复+1条私聊，全部角色均回复；实际共4,073 token，重复请求无新增调用，第三账号不能读取私聊。报告 `output/eight-live-agents-1792413233055/verification.json`。
- 真实Chrome、真实模型、文件配置：私聊/公共@显示、网络恢复、刷新历史、资料入口不存在、前端无资料请求通过。报告 `output/live-agent-browser-1792413233638/verification.json`。
- 真实Chrome检查Celine气泡可见通过；使用预置持久化气泡夹具，时序/冷却/过期由服务器回归覆盖。报告 `output/celine-speech-1792413264662/verification.json`。
- **线上只读Chrome冒烟**：生产health返回新版本、qwen-flash已配置、backgroundCalls=false、200次/50,000 token/180输出/16,000输入的预算生效；检查时当天调用与已记额度均0。作品集入口登录页面加载、无页面错误、无人设入口，人设JSON公开路径404。报告 `output/production-agent-release-1792413400000/verification.json`。
- 没有用真实账号登录或向生产聊天发送测试消息；真实回复验收来自上述隔离环境，线上验证限于配置和页面的只读检查。

## 配置与维护

人设维护说明：`server/agent-personas/README.md`。修改后 `npm run agents:check`，重新部署生效。

生产环境变量：`LLM_MODEL=qwen-flash`、`BAILIAN_MODEL=qwen-flash`、`LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`、`LLM_DAILY_LIMIT=200`、`LLM_DAILY_TOKEN_LIMIT=50000`，密钥由 `DASHSCOPE_API_KEY` Secret提供。

本机CLI登录曾因Windows EXDEV无法保存凭据，已在独立本地凭据目录处理；兼容脚本位于被排除的output目录，只影响本机CLI配置文件写入，不发布到应用。
