# 平行宇宙：如何「最大感觉还原平时会做的事」

> 给明早产品拍板。Phase 仍是素材 + 可感预览；本文把 **蒸馏日常 → 公司版的你 → 在胡同房间里演出来** 的路径写死，避免一上来做假大空 LLM agent。

相关：[`distill-spec.md`](distill-spec.md)（题库 + JSON schema）· [`day-in-life.md`](day-in-life.md)（一条可预览的一天）。

---

## 1. 我们真正要还原的不是「聪明」，是「像」

平行宇宙里的 agent **不必**规划季度战略，也 **不必**实时聊天很会。

它要让人在 30 秒内觉得：

> 「对，我进公司就是先开电脑；摸鱼我会去拆盲盒；开会我不太说话；烦了会上天台。」

「像」来自三层，由浅到深：

| 层 | 人能感觉到的 | 系统里是什么 |
|----|----------------|--------------|
| **地点习惯** | 这个点我会在哪 | `favoriteRooms[]` + 日程表 |
| **微行为** | 到了房间会干什么 | 可枚举动作：续杯 / 拆盒 / 打印 / 看窗外 / 回消息 |
| **语气** | 冒出来的那句话像不像我 | 短气泡模板 + 语气标签（先不靠长对话） |

LLM 只该碰第三层的「换皮」，前两层必须是 **结构化卡 + 脚本**，否则房间会变成随机散步。

---

## 2. 蒸馏输入（日常从哪来）

不要一上来接日历 API / 全量聊天记录。MVP 只收 **人愿意填、且能映射到房间动作** 的碎片。

| 输入 | 形态 | 蒸馏成什么 | 优先级 |
|------|------|------------|--------|
| **Q&A 题库** | 8–12 题选择/短填（见 distill-spec） | 人格卡主体 | **P0 · 明早只做这个** |
| **习惯标签** | 多选 chips：咖啡依赖 / 准点走 / 拆盒 / 天台抽烟… | `traits[]`、`microBehaviors[]` | P0 |
| **聊天语气** | 3 条自贴或「更像哪句」选择题 | `tone`、气泡模板 id | P1 |
| **日历碎片** | 人手贴 3 段：`09:10 进门` `14:00 例会` `18:20 天台` | `schedule[]` | P1（可手填，不接 Google） |
| **工位照片/座位** | 仅风格化参考，不进仓 | 默认出生房间（夏威夷 / 工位） | 已有场景，不阻塞 |

**明确不做（本阶段）**：读 Slack 全历史、邮件摘要、键鼠轨迹、真人照片进模型。那些是「感觉还原」的幻觉，不是 MVP。

蒸馏的产品句：

> 你答 10 题 → 我们吐一张 **公司人格卡** → 卡被塞进 2–3 个房间的 **日程 + 事件卡** → 你看见「公司版的你」按你的习惯走一圈。

---

## 3. 人格卡字段（公司版的你）

卡是唯一真相源。预览、行为树、以后的 LLM 都读同一份 JSON。

| 字段 | 类型 | 说明 | 驱动什么 |
|------|------|------|----------|
| `id` / `displayName` | string | 「胡同里的你」显示名 | UI |
| `castId` | `cast_01`… | 用哪套像素身体 | 漫游预览 |
| `energy` | `lark` / `owl` / `flat` | 早到 / 夜猫 / 平稳 | 进门时刻、天台早晚 |
| `arrivalRitual` | enum | 进门后第一件事 | 胡同口 → 下一房间 |
| `fuel` | `coffee` / `tea` / `none` | 续命方式 | 是否进茶水间、气泡 |
| `focus` | `deep` / `hopper` / `social` | 深工 / 会间跳 / 找人聊 | 工位停留 vs 开会 |
| `slackOff` | `popmart` / `pantry` / `rooftop` / `restroom` / `print` | 默认摸鱼点 | 上午 vignette |
| `meetingRole` | `lead` / `silent` / `notes` / `late` | 开会人格 | 会议室站位 + 气泡 |
| `rooftopHabit` | `smoke` / `wind` / `call` / `avoid` | 天台干什么 | 傍晚 vignette |
| `parcelHabit` | `sprint` / `pile` / `ignore` | 快递到了 | 快递门口事件 |
| `deskStyle` | `neat` / `lived` / `chaos` | 工位整洁（视觉以后用） | 夏威夷道具密度 |
| `tone` | `dry` / `warm` / `chaotic` / `short` | 说话方式 | 气泡模板组 |
| `walkSpeed` | `slow` / `normal` / `rush` | 过道速度 | 漫游循环 |
| `favoriteRooms` | 2–3 个 scene id | MVP 只进这些房间 | 预览白名单 |
| `microBehaviors` | 3–6 个动作 id | 「最像我的三件事」 | 事件卡池 |
| `schedule` | 时间轴 | 可空，空则用默认「一天」 | 故事板 |
| `lines` | 3 句口头禅 | 可选覆盖 | 气泡 |

字段枚举与 JSON 示例见 [`distill-spec.md`](distill-spec.md)。

---

## 4. Agent 驱动循环（感知 → 意图 → 场景动作 → 气泡）

房间是舞台，卡是剧本。循环 **每 2–4 秒一拍**，不要每帧问模型。

```
感知 perceive
  · 当前房间、在场 NPC、墙上的钟（故事时间）
  · 卡：schedule 下一档、microBehaviors、fuel/slackOff
        ↓
意图 intend（纯规则）
  · 若故事时间命中 schedule → 切房间 / 播 vignette
  · 否则从当前房间的「合法动作表」∩ 卡的 microBehaviors 抽 1 个
        ↓
场景内动作 act
  · 走过去（walk 循环）→ 面对道具 → 播 1 个道具动画（蒸汽/纸飞出/拆盒）
  · 不寻路网格也可以：预埋 2–3 个锚点
        ↓
对话气泡 say
  · 动作 id + tone → 模板句（可后接 LLM 换皮）
  · 一句，≤18 字，2.5 秒消失
        ↓
等待 wait
  · idle 两帧呼吸 → 下一拍
```

**合法动作表（按房间，已有素材就能演）**

| 房间 | 可演动作 |
|------|----------|
| 胡同口 / 快递门口 | `badge_in` 刷门 · `sign_parcel` 签收 · `dodge_scooter` 躲车 |
| 夏威夷 / 工位 | `open_laptop` · `sip_thermos` · `stare_window` |
| 泡泡玛特 | `browse_shelf` · `unbox` · `show_figure` |
| 茶水间 | `pull_espresso` · `refill` · `snack_raid` · `chat_barista` |
| 打印区 | `wait_print` · `curse_jam` · `stack_paper` |
| 会议室 | `sit_silent` · `point_holo` · `take_notes` · `arrive_late` |
| 过道 / 楼梯 | `pass_npc` · `take_stairs` · `buy_vending` |
| 天台 | `light_up` · `lean_rail` · `wind_only` · `phone_call` |
| 老板办公室 | `knock` · `sit_across` · `look_out` |
| 厕所 | `wash` · `stall_scroll`（点到为止） |

NPC（快递 / 咖啡师 / 路人）只做 **布景触发器**：走进交互半径就播一句，不单独跑 LLM。

---

## 5. 不用纯 LLM agent 的三条备选

纯对话 agent 会在像素房间里「站着说话」。我们要的是 **看得见的日常**。

### A. 行为树 + 日程表（工程最稳）

```
Selector
 ├─ Sequence「日程命中」→ 切房间 → 播对应 vignette
 ├─ Sequence「刚进房间」→ 播 arrivalRitual
 └─ Weighted random「闲着」→ 当前房间合法动作 ∩ 卡
```

日程是一张小表，不是 planner。适合 MVP，可测试，失败也可读。

### B. 事件卡牌（产品最好讲）

每张卡 = `{when, room, action, line, weight}`。  
蒸馏输出直接 **发一副 8–12 张牌**。预览就是翻牌：进房 → 抽牌 → 演。

优点：Laura 可以盯着牌说「这张不像我，删」。比调 prompt 快。

### C. 脚本化 vignette（美术验收最快）

写死 6 段运镜（见 day-in-life）：进胡同 → 工位 → 拆盒 → 茶水间 → 开会 → 天台。  
卡只改 **走哪两段 + 气泡语气**。今晚的 `public/index.html#day` 就是这条。

---

## 6. 推荐 MVP（明早先看、本周可做）

**一句话**：卡 → 只进 2–3 个房间 → 看见「像我」的微行为。不接模型。

### 明早验收看什么（按顺序）

1. **画廊新房间**：茶水间、打印区、过道楼梯、天台、老板办、快递门口 —— 是否「日常公司」一眼可读。
2. **一天故事板**（`#day`）：固定路线能否讲完「像一个人的工作日」。
3. **房间漫游**（`#walk`）：点房间切换 + 站桩/走一圈，确认角色帧够用。
4. **这三份 design**：是否同意「题库蒸馏 + 事件卡，而不是先做 agent 后端」。

### 本周可落地的最小闭环（仍无后端）

1. 静态页加一页 **10 题表单**（可先写死提交到 `localStorage`）。
2. 映射函数 `answers → PersonaCard`（纯 JS，对照 distill-spec）。
3. 用卡的 `favoriteRooms` + `microBehaviors` **过滤** 故事板 6 段，只播 2–3 段。
4. 气泡从 `tone` 模板表取句。
5. 角色换 `castId`。

### 刻意延后

- LLM 生成日程 / 自由对话 / 多 agent 社交
- 真日历、真聊天同步
- 寻路、碰撞、存档、登录
- 把人格做成「什么都会的公司数字员工」

### 成功标准（产品语言）

同事看 20 秒预览能说：「这是你，不是通用 NPC。」  
说不出来，就加题、加牌，不要加模型。
