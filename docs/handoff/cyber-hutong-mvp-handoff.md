# 赛博胡同 MVP 架构与实施 prompt

最新补充（2026-09-29）：必须同时读取同目录 `cyber-hutong-character-events.md`。用户已明确八人座位、个人偏好、四个剧情角色及结伴/送咖啡事件；这些内容覆盖下文「喜好待提供」的早期说明。实施时采用配置驱动的规则系统。

## 上下文边界

本方案依据本任务明确需求。引用任务 `01a0e88f-9fa5-78e1-b1ba-b7abb366f2c7` 的正文未读取：当前工具未提供 Codex read_thread。不得宣称已合并其需求。实施 agent 有权限时必须先读取；若仍不可读，请用户粘贴原 prompt，保留本设计作为可继续使用的草案。

预算：用户希望本次设计不超过账户额度的 2%；无法获取额度计量，因此采用单份精简交接，不执行完整开发、图片生成或部署。

## 产品边界与架构

八个固定成员各拥有一个专属像素角色。登录后进入场景，移动、入座、切换地点；其他成员在线时显示真人操作，离线时显示其可配置的规则行为。具体一期玩法以引用任务的原始 prompt 为准，以下为建议基础范围。

优先沿用已有应用技术栈。若目标仓库只有图片：建议 TypeScript 单体应用，React/Vite 负责登录和面板，Canvas 2D 负责场景与精灵，Node 服务提供认证、世界状态与 WebSocket，SQLite 存账户和角色状态。一个持续运行的服务实例＋持久磁盘足够八人原型；多实例部署前改用共享数据库和世界状态协调。暂不引入微服务、向量库或 AI agent 框架。

数据流：登录页 → 服务端认证/领取事务 → 会话 → 玩家指令 → 世界模拟器 → 状态快照 → Canvas 渲染。

客户端只发送行动意图，服务端校验身份、速度、碰撞、座位占用与场景出口；禁止客户端直接写角色归属或世界坐标。逻辑更新建议每秒 10 次，客户端插值绘制；这一数值可配置，不与显示帧率绑定。重连获取完整快照。

## 名字与图片的固定对应

严格按用户本次上传顺序，不能按发型猜名字：

|序号/角色 ID|名字|附件文件名|
|---|---|---|
|f01|Suki|ddfdf9e009a4117e2c8fd9e1f5e7880f.png|
|f02|Franco|5e6fe6b3be81d4384ed47ac3b28af383.png|
|f03|Sid|faf1abfa10a661c1126ff697e9792849.png|
|f04|Jilly|07be6378d9c36009ca2cc5215d495cf5.png|
|f05|Laura|7264f2ef7d773e107f28faaaae8e3b53.png|
|f06|Kay|08f1e87cc775c9725d73e646e89407cb.png|
|f07|Cora|c8330cf3696eb5ad6510439237534d5d.png|
|f08|Amber|c532a1bdd37c1d5780d9283436baaa8d.png|

附件根目录：`D:/wechat_file/xwechat_files/wxid_z40ttmse7gwb32_ef9a/temp/RWTemp/2026-09/13f040de4c7d7db4c99d4e90503a1dbe/`。

## 登录与一次领取

登录页仅两个输入：真实英文名、密码。名字去除两端空白并转小写后查白名单，展示仍用上表拼写；不接受相近拼写或新增名字。

管理员预置八个成员名额和固定角色，分别生成一次性领取码，私下交给本人。用户在「注册」页面填写英文名、领取码、自设密码、确认密码。服务端校验白名单和对应领取码，原子创建账号并领取角色。领取码只存哈希，使用后失效；密码只存加盐哈希。前端不能包含领取码或真实密码。登录页填写英文名和自设密码。后台写死的是名字与角色对应关系，密码由本人设置。

注册事务同时设置密码哈希、消耗领取码、插入角色绑定和初始状态；`claims.member_id` 与 `claims.character_id` 分别 UNIQUE。并发注册只能一份成功，其余不覆盖密码，提示前往登录。登录只读取已有绑定。忘记密码页面提供英文名和「申请重置」，服务端统一返回申请已提交；管理员核对本人身份后私下发短时有效一次性重置码，用户通过「已有重置码」填写英文名、重置码、新密码并确认。重置成功撤销旧会话，保留角色与存档。没有真实邮件服务时不展示虚假的邮件发送成功。

会话使用随机不透明令牌，数据库存令牌哈希，浏览器 HttpOnly、SameSite Cookie，生产 HTTPS 下 Secure。状态变更请求验证 Origin/CSRF；登录限速并统一错误提示；密码采用成熟库的 Argon2id。一个角色最多有一个控制租约，新连接接管旧连接，断开释放租约；短暂断网保留约 15 秒再进入离线模式。

建议表：
- `members(id, canonical_name UNIQUE, password_hash nullable, credential_version)`，未注册时密码为空。
- `auth_tokens(id, member_id FK, purpose claim/reset, token_hash, expires_at, consumed_at)`；服务端事务原子消费。
- `reset_requests(id, member_id nullable FK, status, created_at)`；申请接口限速、去重，不向未登录者暴露成员注册状态。
- `characters(id PRIMARY KEY, sprite_manifest)`，仅种子数据中的 f01–f08。
- `claims(member_id UNIQUE FK, character_id UNIQUE FK, claimed_at)`；服务端固定对应，不接受客户端指定 character_id。
- `sessions(token_hash UNIQUE, member_id FK, credential_version, expires_at)`；改密/重置使旧会话失效。
- `character_state(character_id PK FK, scene_id, x, y, action, target_id, updated_at)`。
- `profiles(character_id PK FK, version, config_json)`；喜好与日程待用户提供。

## 角色驱动：一期规则，二期 AI

运行优先级：本人在线手动控制 > 本人明确开启自动模式 > 离线规则驱动。自动角色仍是同一个人物，不生成分身。多人看到同一服务端状态。

规则依据时间、精力/休息需要、用户提供的偏好和当前地点选择可执行活动，例如工作、喝咖啡、休息、散步。一期先用中性默认配置，不给真人编造兴趣。每 30–60 秒或动作完成时评估一次，冷却时间避免来回切换。移动由寻路模块执行，座位和交互点由服务端占用锁管理。无人在线时暂停高频模拟，下次进入按经过时间计算状态，避免循环补算整晚。

后续 AI 只参与按需对话和低频行动建议；模型返回受限 ActionIntent，经服务端验证后执行。碰撞、坐标、身份、资源占用始终由确定性规则控制。超时、无效响应、额度用完立即退回规则。AI 开关默认关闭，每日调用上限、输入长度上限和超时可配置，密钥仅放服务端。涉及真实成员的自动发言标注“角色自动回应”，不能冒充本人当前意图；长期记忆后续显式设计。

## 素材与场景

角色图片每张六个姿势，依次 front、back、side_right、walk_right、sit_front、sit_back。去绿底、按实际边界裁切并记录 frame rect、脚底锚点；不能直接把含空白的整张图当角色，也不能假定六格精确等宽。左向可由右向镜像，只有一帧走路时用站姿/行走交替作为临时动画，注明限制。

场景采用 1280×720 逻辑坐标系，画布等比缩放、留边，不拉伸。角色显示高度配置起点建议 72–96 逻辑像素，必须拿实际站姿和坐姿放到桌椅旁验证后确定；原角色图约 300 像素高不代表运行时尺寸。现有场景带透视，需要每场景配置按脚底 y 插值的缩放曲线和前后遮挡层；不能只按 1280×720 相同就宣称比例匹配。

每张 SceneConfig 包含背景、可行走区域、碰撞区、出口、交互点、座位坐姿/朝向/缩放/锚点与前景遮挡。背景已绘制椅子的场景避免重复放椅子；入座时正确显示人物在桌沿后。厕所四个厕位、右侧两池；胡同八工位左右各四；休息区保留咖啡机、冰箱、贩卖机、桌椅。

本机现有输出目录：`C:/Users/hj120/Documents/Codex/2026-09-28/wo-z/outputs/`。跨机器交接必须拷贝素材或提交到资产目录，不能引用此绝对路径作为线上 URL。优先使用三个 `v2-1280x720.png`：`office-restroom-4-stalls-2-sinks-v2-1280x720.png`、`rest-area-v2-1280x720.png`、`cyber-hutong-8-seats-with-chairs-v2-1280x720.png`。

## 可直接交给实施 agent 的 prompt

你负责实现赛博胡同一期 MVP。先读取被引用 Codex 任务 `01a0e88f-9fa5-78e1-b1ba-b7abb366f2c7` 的原始 prompt 与现有工程；若工具不支持，明确索取正文，不根据标题推测。将原始玩法与本文件约束合并；最新用户要求优先。检查 AGENTS.md 与现有栈，复用已有代码，保留用户修改。仓库为 https://github.com/HanjingLaura/cyber-hutong；本文件附有角色和场景素材路径。不要重新生成美术。

实现顺序：1. 素材导入与透明精灵 atlas、角色对应表；2. 数据库迁移/八人名额/领取码脚本/注册登录与重置/事务领取；3. 一张胡同地图跑通移动、八座位、遮挡；4. 场景切换及服务端多人同步；5. 配置式离线行为与自动模式；6. 最小设置页、README 和验证。引用任务中额外一期玩法也须实现，超出基础方案时先在计划里说明。

严格执行本文件的身份机制：仅八个名字，注册时验证领取码并自设密码，固定角色；后续英文名和密码登录。同一角色不得多客户端同时控制。所有校验在服务端，不能用 localStorage 模拟真实登录与唯一领取。

以下为可改进的最小类型骨架，不是完整实现：

```ts
export const roster = [
  ['suki', 'Suki', 'f01'], ['franco', 'Franco', 'f02'],
  ['sid', 'Sid', 'f03'], ['jilly', 'Jilly', 'f04'],
  ['laura', 'Laura', 'f05'], ['kay', 'Kay', 'f06'],
  ['cora', 'Cora', 'f07'], ['amber', 'Amber', 'f08'],
] as const;

export type Activity = 'work' | 'coffee' | 'rest' | 'walk';
export type ActionIntent =
  | { type: 'move'; x: number; y: number }
  | { type: 'interact'; targetId: string }
  | { type: 'idle'; durationMs: number };
export interface CharacterProfile {
  version: number;
  timezone: string;
  preferences: Partial<Record<Activity, number>>;
  schedule: Array<{ start: string; end: string; activity: Activity }>;
}
export interface BrainContext {
  now: number;
  characterId: string;
  profile: CharacterProfile;
  availableTargets: Array<{ id: string; activity: Activity }>;
}
export interface CharacterBrain {
  decide(ctx: BrainContext): Promise<ActionIntent>;
}
// 一期 RuleBrain；以后 AIBrain。两者输出均经过 validateAndApplyIntent。
// 注册：validateNameAndClaimCode -> transaction(setPassword + consumeCode + claimOnce + initStateOnce)
// 登录：verifyPassword -> createSession -> returnOwnedCharacter；归属不接受客户端指定。
```

最小接口：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/forgot-password`、`POST /api/auth/reset-password`、`POST /api/auth/logout`、`POST /api/auth/password`、`GET /api/me`、带 Cookie 会话验证的 `/ws`。WebSocket 指令包含序列号，服务端拒绝过期租约和不合法指令，广播有版本的状态。状态定期落库并在入座、切场景、退出等重要事件保存。

喜好通过 profiles 配置注入，暂不启用 AI API；不要把任何人的个人习惯写死在渲染组件。

## 登录页最新设计要求

用户指定背景是 `login-office-background.png`，对应本次上传的八工位办公室。参考同目录 `cyber-hutong-login-preview.html` 的可切换静态界面。使用图片本身的中央白墙放置标题「赛博胡同」和注册/登录/忘记密码表单；中文界面标签、英文名输入，无邮箱要求。减少天花板和地板占比，通过等比放大、裁切让白墙成为焦点。标题和交互使用真实 HTML 元素，不能烘焙进图片。无整页圆角外壳、无浮动白卡片，不增加八人头像选择器。窄屏维持中央白墙锚点，表单允许滚动。此裁切仅用于登录页，不改变游戏地图比例或角色坐标。

预览是本地视觉稿，按钮展示流程说明，不连接后端、不保存密码。实施时替换为真实接口，处理 loading、错误、成功、键盘操作及会话恢复。注册并发、领取码复用、重置码过期和重复消费须有测试。

完成验证：错误名字/密码不能领取；八个名字分别对应正确图片；并发首次登录只产生一份绑定和状态；已领取用户刷新/重登/换设备仍是本人角色；重置密码使旧会话失效；两浏览器观察一致；接管和断线不会出现分身；角色不能穿墙或抢占同一座位；手动输入优先于自动驱动；无 AI 密钥仍能完整运行；人物与桌椅比例和遮挡正确，素材无绿边。交付运行命令、配置说明、测试结果与具体剩余限制。部署需按用户后续授权执行。
