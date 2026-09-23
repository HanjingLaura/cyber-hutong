# 一条「平行宇宙的一天」故事板

> 固定路线，用来验收 **场景是否接得上、微行为是否可读**。卡只改「走哪几段 + 气泡」，不改运镜骨架。  
> 预览：打开画廊 → 顶部 **一天**，或直接 `http://localhost:4173/#day`

角色默认 `cast_01`（可换）。NPC：快递门口的骑手、茶水间咖啡师、过道路人。

---

## 总览

```
09:12  快递门口 / 胡同口     badge_in
09:18  夏威夷工位            open_laptop
10:40  泡泡玛特店            unbox
11:05  茶水间                pull_espresso
14:00  会议室                take_notes
17:40  天台                  lean_rail
```

过场（可选，漫游页点进即可，故事板不强制停）：`楼梯/过道` `打印区` `厕所` `老板办公室`。

---

## 分镜

### 1 · 09:12 · 进胡同 —— `delivery` / 兼用 `room_hutong_gate`

| | |
|--|--|
| 画面 | 黄昏卷帘、灯笼、电驴、纸箱堆。快递 NPC 抱盒站在门口。 |
| 触发 | 故事开始 / `arrivalRitual=sign_parcel` 时先播签收再进门 |
| 动作 | 从画面右侧走进 → 在对讲机前停 1 拍 → `badge_in` |
| 气泡（dry） | 「先让我进去。」 |
| 若卡不同 | `parcelHabit=sprint`：先冲向纸箱 `sign_parcel`；`ignore`：不看盒，直入 |
| 素材 | `public/assets/rooms/room_delivery.png` · `npc_courier` |

### 2 · 09:18 · 工位开机 —— `hawaii`

| | |
|--|--|
| 画面 | 窗边长桌、三座位纵向、卷帘漏光。角色在中间椅侧。 |
| 触发 | `arrivalRitual=open_laptop`（默认） |
| 动作 | 坐下 idle 呼吸 → 面向笔记本 `open_laptop` → 抿一口保温杯 |
| 气泡 | 「先把窗边这档开了。」 |
| 若卡不同 | `deskStyle=chaos` 以后可加更多桌面纸；MVP 只改气泡 |
| 素材 | `public/assets/scenes/hawaii/scene_hawaii.png` |

### 3 · 10:40 · 泡泡玛特摸鱼 —— `popmart`

| | |
|--|--|
| 画面 | 糖果格地板、盲盒墙、柜台已开盒 + 手办。 |
| 触发 | `slackOff=popmart` 或 `microBehaviors` 含 `unbox` |
| 动作 | 沿货架走两步 `browse_shelf` → 柜台 `unbox` |
| 气泡 | 「就拆一个。」 |
| 若卡不同 | slack 去茶水间/天台/厕所/打印区则 **跳过本段**，故事板缩成 5 格 |
| 素材 | `public/assets/scenes/popmart/scene_popmart.png` |

### 4 · 11:05 · 茶水间续命 —— `pantry`

| | |
|--|--|
| 画面 | 陶土砖、咖啡机蒸汽、高桌两杯、咖啡师 NPC。 |
| 触发 | `fuel=coffee` 或 `arrivalRitual=refill` |
| 动作 | 走向机器 `pull_espresso` → 对咖啡师 `chat_barista`（点头一拍） |
| 气泡 | 「第二杯。」 |
| 若卡不同 | `fuel=tea` → 水壶锚点；`none` → 只抄零食 `snack_raid` 或不进此房 |
| 素材 | `public/assets/rooms/room_pantry.png` · `npc_barista` |

### 5 · 14:00 · 开会 —— `meeting`

| | |
|--|--|
| 画面 | 深紫霓虹格、全息桌、一圈椅。 |
| 触发 | 日程 14:00；`focus=hopper` 必进 |
| 动作 | `meetingRole=notes`：坐侧面 `take_notes`；`silent` 靠后；`late` 从过道推进来；`lead` 站全息前 `point_holo` |
| 气泡 | 「我记，你们说。」 |
| 过场 | 可从 `hallway` 楼梯上来再推门 |
| 素材 | `public/assets/rooms/room_meeting.png` |

### 6 · 17:40 · 天台收束 —— `rooftop`

| | |
|--|--|
| 画面 | 夜空、城市窗点、栏杆、空调外机、两把折叠椅、一点火星。 |
| 触发 | `rooftopHabit≠avoid` |
| 动作 | 靠栏杆 `lean_rail`；`smoke` 则加烟头闪点；`call` 侧身一拍 |
| 气泡 | 「风比会好。」 |
| 若卡不同 | `avoid`：改在夏威夷看窗 `stare_window` 结束 |
| 素材 | `public/assets/rooms/room_rooftop.png` |

---

## 过场房（不进主时间轴，漫游可点）

| 房间 | 什么时候会「像日常」 | 触发建议 |
|------|----------------------|----------|
| 楼梯/过道 | 任意切房之间 | 撞见 `npc_passerby`，`pass_npc` |
| 打印区 | `microBehaviors` 含 `wait_print` / slack=print | 对打印机站桩，纸页飞出 |
| 厕所 | slack=restroom 或 arrival=wash | 洗手台一拍，不演隔间 |
| 老板办公室 | 预留「被叫进去」事件卡 | 现不作默认一天 |
| 工位 supporting | 夜班视觉，与夏威夷分工 | 卡选 `office` 才用 |

---

## 预览如何对应

| 故事板格 | 画廊 / 漫游 id |
|----------|----------------|
| 1 进门 | `#walk` → 快递门口 |
| 2 工位 | 夏威夷 |
| 3 摸鱼 | 泡泡玛特 |
| 4 续命 | 茶水间 |
| 5 开会 | 会议室 |
| 6 天台 | 天台 |

漫游页按此顺序排房间芯片；点一下切背景、角色走一个往返、顶上冒当前格气泡。

---

## 和人格卡怎么接（过滤，不重写）

```
shown = storyboard.filter(beat =>
    beat.room in card.favoriteRooms
    or beat.action in card.microBehaviors
)
if shown.length < 2:
    shown = [hawaii_open_laptop, beat_of(card.slackOff)]
```

这样「深工 + 讨厌天台 + 不拆盒」的人会看到：进门 → 工位 → 茶水间 → 开会，而不是六格硬走完。

---

## 明早怎么验收这条一天

1. 故事板六格图都在，且 **地板/光色互不相同**（不要六间同一种深蓝格）。
2. 每格能读出动作（拆盒、端杯、靠栏杆），不是空房间摆人。
3. 产品能指着某格说「这格从我的卡里删掉」——对应字段在 distill-spec 里找得到。
