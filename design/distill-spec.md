# 蒸馏题库草案 + 人格卡 schema

> 配套 [`parallel-universe.md`](parallel-universe.md)。目标：10 题以内，把「平时会做的事」收成一张可驱动房间的 JSON 卡。

---

## 设计原则

- **每题必须映射到房间或动作**。不能映射的题（MBTI、星座、喜欢的颜色）一律不进 P0。
- 以选择题为主，最后一题允许「点三件最像我的事」。
- 允许跳过；跳过走默认（见文末 `defaults`）。
- 输出必须能被非 LLM 的映射函数消化。

---

## 题库（12 题 · 建议答 10）

| # | id | 题干 | 选项 → 写入字段 |
|---|----|------|-----------------|
| 1 | `q_energy` | 你更像哪种进公司？ | 早到开灯 `energy=lark` · 踩点 `flat` · 别人走了我还在 `owl` |
| 2 | `q_arrival` | **进门后第一件事**更接近？ | 直奔工位开电脑 `arrivalRitual=open_laptop` · 先去茶水间 `refill` · 先上个厕所 `wash` · 先取快递 `sign_parcel` |
| 3 | `q_fuel` | 续命靠什么？ | 美式/意式 `fuel=coffee` · 茶/热水 `tea` · 不喝、靠干嚼 `none` |
| 4 | `q_slack` | 真正会「消失一会儿」的地方？ | 泡泡玛特摸鱼 `slackOff=popmart` · 茶水间 `pantry` · 天台 `rooftop` · 厕所刷手机 `restroom` · 打印区装忙 `print` |
| 5 | `q_meeting` | 开会时的你？ | 我来牵 `meetingRole=lead` · 人在心不在 `silent` · 疯狂记笔记 `notes` · 习惯性晚到 `late` |
| 6 | `q_focus` | 一天的形状？ | 能隐身写东西 `focus=deep` · 会和会之间弹来弹去 `hopper` · 靠找人聊天推动 `social` |
| 7 | `q_parcel` | 取件短信响了？ | 立刻下楼 `parcelHabit=sprint` · 先堆门口 `pile` · 当没看见 `ignore` |
| 8 | `q_roof` | 天台对你是？ | 抽烟位 `rooftopHabit=smoke` · 只吹风看天际线 `wind` · 出去打电话 `call` · 基本不上 `avoid` |
| 9 | `q_desk` | 工位长什么样？ | 能拍照发杂志 `deskStyle=neat` · 能用就行 `lived` · 考古层 `chaos` |
| 10 | `q_tone` | 同事印象里你说话更像？ | 短、干、不解释 `tone=dry` · 先对人好 `warm` · 突然很跳 `chaotic` · 能不发字就不发 `short` |
| 11 | `q_speed` | 在过道里你是？ | 几乎飘 `walkSpeed=slow` · 正常人 `normal` · 要迟到了的步频 `rush` |
| 12 | `q_top3` | **只保留三件「最像我」的日常**（多选，最多 3） | 见下方动作池 → `microBehaviors[]` |

### 第 12 题动作池（勾选即进卡）

`open_laptop` 开电脑 · `sip_thermos` 喝保温杯 · `pull_espresso` 做咖啡 · `unbox` 拆盲盒 · `wait_print` 等打印 · `sit_silent` 开会不说话 · `take_notes` 开会记录 · `arrive_late` 晚进会议室 · `sign_parcel` 签快递 · `lean_rail` 天台靠栏杆 · `light_up` 点一支 · `stare_window` 看窗外 · `chat_barista` 跟咖啡师点头 · `pass_npc` 过道点头 · `snack_raid` 抄零食

映射规则：第 12 题优先；不足 3 个时，用 2/3/4/5/8 题反推补齐（例如 `fuel=coffee` ⇒ 补 `pull_espresso`）。

`favoriteRooms` 推导（取 2–3 个，去重保序）：

1. 出生房间：`hawaii`（若 `arrivalRitual=open_laptop`）否则按 arrival 对应房  
2. `slackOff` 对应房  
3. 若 `meetingRole≠silent` 或 `focus=hopper` ⇒ `meeting`；若 `rooftopHabit≠avoid` ⇒ `rooftop`；否则 `pantry`

---

## 输出 schema（PersonaCard）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cyber-hutong.persona-card.v0",
  "title": "PersonaCard",
  "type": "object",
  "required": ["id", "castId", "energy", "favoriteRooms", "microBehaviors"],
  "properties": {
    "id": { "type": "string" },
    "displayName": { "type": "string" },
    "castId": { "type": "string", "pattern": "^cast_0[1-8]$" },
    "energy": { "enum": ["lark", "owl", "flat"] },
    "arrivalRitual": { "enum": ["open_laptop", "refill", "wash", "sign_parcel"] },
    "fuel": { "enum": ["coffee", "tea", "none"] },
    "focus": { "enum": ["deep", "hopper", "social"] },
    "slackOff": { "enum": ["popmart", "pantry", "rooftop", "restroom", "print"] },
    "meetingRole": { "enum": ["lead", "silent", "notes", "late"] },
    "rooftopHabit": { "enum": ["smoke", "wind", "call", "avoid"] },
    "parcelHabit": { "enum": ["sprint", "pile", "ignore"] },
    "deskStyle": { "enum": ["neat", "lived", "chaos"] },
    "tone": { "enum": ["dry", "warm", "chaotic", "short"] },
    "walkSpeed": { "enum": ["slow", "normal", "rush"] },
    "favoriteRooms": {
      "type": "array",
      "minItems": 2,
      "maxItems": 3,
      "items": {
        "enum": [
          "gate", "delivery", "hawaii", "office", "popmart", "pantry",
          "print", "meeting", "hallway", "rooftop", "boss", "restroom"
        ]
      }
    },
    "microBehaviors": {
      "type": "array",
      "minItems": 3,
      "maxItems": 6,
      "items": { "type": "string" }
    },
    "schedule": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["t", "room", "action"],
        "properties": {
          "t": { "type": "string", "description": "HH:MM 故事时间" },
          "room": { "type": "string" },
          "action": { "type": "string" },
          "line": { "type": "string", "maxLength": 24 }
        }
      }
    },
    "lines": {
      "type": "array",
      "maxItems": 3,
      "items": { "type": "string", "maxLength": 24 }
    },
    "defaultsApplied": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

## 示例：Laura 卡（虚构，仅供拍板看形状）

```json
{
  "id": "persona_laura_demo",
  "displayName": "胡同里的 Laura",
  "castId": "cast_01",
  "energy": "lark",
  "arrivalRitual": "open_laptop",
  "fuel": "coffee",
  "focus": "deep",
  "slackOff": "popmart",
  "meetingRole": "notes",
  "rooftopHabit": "wind",
  "parcelHabit": "sprint",
  "deskStyle": "lived",
  "tone": "dry",
  "walkSpeed": "normal",
  "favoriteRooms": ["hawaii", "popmart", "rooftop"],
  "microBehaviors": ["open_laptop", "unbox", "lean_rail", "pull_espresso"],
  "schedule": [
    { "t": "09:12", "room": "delivery", "action": "badge_in", "line": "先让我进去。" },
    { "t": "09:18", "room": "hawaii", "action": "open_laptop", "line": "先把窗边这档开了。" },
    { "t": "10:40", "room": "popmart", "action": "unbox", "line": "就拆一个。" },
    { "t": "11:05", "room": "pantry", "action": "pull_espresso", "line": "第二杯。" },
    { "t": "14:00", "room": "meeting", "action": "take_notes", "line": "我记，你们说。" },
    { "t": "17:40", "room": "rooftop", "action": "lean_rail", "line": "风比会好。" }
  ],
  "lines": ["就拆一个。", "我记，你们说。", "风比会好。"],
  "defaultsApplied": []
}
```

同卡驱动的事件牌（产品可直接剪）：

| 牌 | when | room | action | line（dry） |
|----|------|------|--------|-------------|
| 进门 | 09:12 | delivery | badge_in | 先让我进去。 |
| 开机 | 09:18 | hawaii | open_laptop | 先把窗边这档开了。 |
| 摸鱼 | 10:40 | popmart | unbox | 就拆一个。 |
| 续命 | 11:05 | pantry | pull_espresso | 第二杯。 |
| 会 | 14:00 | meeting | take_notes | 我记，你们说。 |
| 收束 | 17:40 | rooftop | lean_rail | 风比会好。 |

语气换皮（同一动作，不改房间）：

| tone | `unbox` |
|------|---------|
| dry | 就拆一个。 |
| warm | 这个盒子看了你好几次。 |
| chaotic | 欧气来了没有！！ |
| short | …开。 |

---

## 默认值

未答题时：

```json
{
  "energy": "flat",
  "arrivalRitual": "open_laptop",
  "fuel": "coffee",
  "focus": "deep",
  "slackOff": "pantry",
  "meetingRole": "silent",
  "rooftopHabit": "wind",
  "parcelHabit": "pile",
  "deskStyle": "lived",
  "tone": "short",
  "walkSpeed": "normal",
  "favoriteRooms": ["hawaii", "pantry", "meeting"],
  "microBehaviors": ["open_laptop", "refill", "sit_silent"]
}
```

---

## MVP 映射伪代码

```
card = defaults()
card.energy = q1
card.arrivalRitual = q2
...
card.microBehaviors = q12[:3] or infer(q2,q3,q4,q5,q8)
card.favoriteRooms = derive_rooms(card)
card.schedule = day_in_life_template.filter(
    room in card.favoriteRooms or action in card.microBehaviors
)
# 若过滤后 < 2 段，强制保留 hawaii + slackOff 房
```

不在本阶段做：把问答题丢给 LLM「自由总结成人格」。那会丢掉和房间的一一对应，验收时无法改。
