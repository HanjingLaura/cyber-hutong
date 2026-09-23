# 蒸馏 spec · 冷启动 only

> 蒸馏 Q&A → PersonaCard 是 **冷启动**。  
> 上线之后，**在线操作日志**覆盖/加权同一张卡。不要把蒸馏当成日常大脑。

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

## 冷启动：12 题 → 卡

题只用来填空，不生成旁白。示例映射：

| 题意 | 写入 |
|------|------|
| 你常坐哪 | `favoriteRooms[0]`（胡同 / 夏威夷 / 普通工位） |
| 桌上第一件东西 | `deskHabit.*.item` ∈ cup / notebook / blindbox |
| 摸鱼去哪 | `slackOff` ∈ popmart / restroom / hawaii |
| 开会你干嘛 | `meetingRole` ∈ notes / silent / late |
| 和谁说话 | `social` cast ids |

完整题面可后补；**不要**用 LLM 当场编一天。

## 与行为学习如何合并

```
PersonaCard' = merge(PersonaCard_0, summarize(online_events))
```

合并规则（MVP 手写，不接模型）：

1. 某房间进房次数 ≥ 3：推入 `favoriteRooms` 头部
2. 某空位连续两次放下同一道具：覆盖 `deskHabit`
3. 与某 cast 对话 ≥ 2：推入 `social`
4. 在 popmart/restroom 停留 > 阈值：`slackOff` 改到该房
5. 蒸馏字段若与轨迹冲突：**轨迹赢**

事件形状：

```json
{ "t": "09:21", "room": "hutong", "action": "place_item", "slot": 2, "item": "cup" }
```

## 一天故事板怎么用卡

`design/day-in-life.md` 的 7 格是默认牌。展示时：

```
shown = beats.filter(b =>
  b.room in card.favoriteRooms || b.action in card.microBehaviors)
if len(shown) < 2:
    shown = [hawaii_open_laptop, beat_of(card.slackOff)]
```

这是过滤，不是 agent 自由发挥。
