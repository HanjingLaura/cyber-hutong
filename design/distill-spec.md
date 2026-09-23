# 蒸馏 spec · 冷启动 only

> 蒸馏 Q&A → PersonaCard 是 **冷启动**。  
> 上线之后，**在线操作日志（行为轨迹）** 覆盖 / 加权同一张卡。不要把蒸馏当成日常大脑。  
> 产品三层见 [`parallel-universe.md`](parallel-universe.md)：Online-control / Offline-agent / Behavior-learning。

## 两路信号怎么进同一张卡

```
PersonaCard_0  = distill(Q&A)                 // 只在没玩过时用
online_events  = 本人在线时的操作日志           // 持续训练 / 更新信号
PersonaCard'   = merge(PersonaCard_0, summarize(online_events))
```

| 来源 | 时机 | 权限 |
|------|------|------|
| 蒸馏 Q&A | 冷启动、还没有任何在线轨迹 | 填空：常去房、桌上第一件东西、摸鱼去哪、开会角色、和谁说话 |
| 在线操作日志 | 每次本人上线之后 | **轨迹赢**。计数、停留、摆物、对话都覆盖或加权蒸馏字段 |

`source.coldStart` 记下蒸馏版本；`source.behaviorEvents` 记下已合并的事件条数。`behaviorEvents == 0` 时离线完全按蒸馏卡抽牌。

## PersonaCard（最小）

```json
{
  "id": "you",
  "castId": "cast_01",
  "source": {
    "coldStart": "distill_v0",
    "behaviorEvents": 0
  },
  "favoriteRooms": ["hutong", "hawaii"],
  "deskHabit": {
    "hutong": { "slot": 2, "item": "cup" },
    "hawaii": { "slot": 1, "item": "laptop" }
  },
  "social": ["cast_06", "cast_02"],
  "slackOff": "popmart",
  "meetingRole": "notes",
  "microBehaviors": ["open_laptop", "unbox", "sit_aisle"]
}
```

`castId` 指向画廊里的同一个小人。在线操控和离线 agent **共用这个 id**，不另造角色。

## 冷启动：蒸馏题 → 卡

题只用来填空，不生成旁白，不编一天。示例映射：

| 题意 | 写入 |
|------|------|
| 你常坐哪 | `favoriteRooms[0]`（胡同 / 夏威夷 / 普通工位） |
| 桌上第一件东西 | `deskHabit.*.item` ∈ cup / notebook / blindbox |
| 摸鱼去哪 | `slackOff` ∈ popmart / restroom / hawaii |
| 开会你干嘛 | `meetingRole` ∈ notes / silent / late |
| 和谁说话 | `social` cast ids |

完整题面可后补。**不要**用 LLM 当场编一天。本周 MVP 甚至可以手填这张卡。

## 与行为学习如何合并

agent 必须从真人在线操作里学：常去房间、停留时长、桌面摆物习惯、社交对象、摸鱼偏好。MVP 手写规则，不接模型：

| # | 在线轨迹 | 合并进卡 |
|---|----------|----------|
| 1 | 某房间 `enter_room` 次数 ≥ 3 | 推入 `favoriteRooms` 头部 |
| 2 | 某房间单次停留 > 阈值（如 180s） | 提高该房权重；若房 ∈ popmart / restroom / hawaii，可作为 `slackOff` 候选 |
| 3 | 某空位连续两次 `place_item` 同一道具 | 覆盖 `deskHabit[room]` |
| 4 | 与某 cast `talk` ≥ 2 | 推入 `social` |
| 5 | 在 popmart / restroom / hawaii 累计停留最长 | `slackOff` 改到该房 |
| 6 | 蒸馏字段与轨迹冲突 | **轨迹赢**，蒸馏值只留在历史里 |

事件形状（持续训练信号）：

```json
{ "t": "09:21", "room": "hutong", "action": "place_item", "slot": 2, "item": "cup" }
{ "t": "09:40", "room": "hawaii", "action": "leave_room", "dwell_s": 420 }
{ "t": "10:41", "room": "popmart", "action": "talk", "target": "cast_06" }
```

`action` 与 [`parallel-universe.md`](parallel-universe.md) 在线操作表对齐：`move` / `enter_room` / `leave_room` / `place_item` / `take_item` / `talk` / `slack`。

离线 agent 读的是合并后的卡，不是原始蒸馏答卷。

## 一天故事板怎么用卡

`design/day-in-life.md` 的 7 格是默认事件牌。展示时按卡过滤，不是 agent 自由发挥：

```
shown = beats.filter(b =>
  b.room in card.favoriteRooms || b.action in card.microBehaviors)
if len(shown) < 2:
    shown = [hawaii_open_laptop, beat_of(card.slackOff)]
```

画廊「一天」预览的是这条默认牌，提醒读者：**本人在线才是操控；离线才回放；蒸馏只冷启动。**
