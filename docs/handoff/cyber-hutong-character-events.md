# 赛博胡同：人物行为与场景事件补充

本文件是 MVP 交接 prompt 的组成部分，记录 2026-09-29 用户指定的内容。沿用八个固定登录角色；新增四个角色属于 NPC，不开放注册领取。本轮交付为架构/内容配置说明，尚未实现游戏逻辑。

## 1. 固定座位

“里”指靠尽头墙，“外”指靠入口/镜头。按当前胡同背景，TTC 文化墙在右侧；座位使用墙面语义标识，切换镜头时不可交换人物归属。

|从里到外|TTC 墙侧（当前右侧）|另一侧（当前左侧）|
|---|---|---|
|1|Jilly / f04|Sid / f03|
|2|Cora / f07|Suki / f01|
|3|Amber / f08|Laura / f05|
|4|Franco / f02|Kay / f06|

座位 ID 分别为 ttc-1..4 与 opposite-1..4，ownerId 固定。工作行为返回自己的座位。图上坐标、坐姿锚点和遮挡需由实施 agent 对照素材配置，不能凭本表杜撰坐标。

## 2. 个人偏好（用户明确指定）

|人物|主要行为|
|---|---|
|Sid|喜欢坐在工位用电脑开发|
|Jilly|上班工作；有时摸鱼刷手机；去演唱会可触发朱志鑫互动|
|Cora|喜欢去盲盒店 / POP MART；常与 Amber 结伴下楼|
|Amber|喜欢去厕所；常与 Cora 结伴下楼；响应 Celine 的 Hawaii 邀请|
|Franco|喜欢打电话|
|Kay|会去健身；早上给 Sid 买咖啡|
|Laura|用电脑开发；有时加入 Amber、Cora 的下楼活动|
|Suki|喜欢去米线店|

所有人有时会去休息区贩卖机处吃东西、打咖啡。不能把偏好设为持续唯一行为。给工作、休息、外出配置权重和冷却；本表仅表示偏好，不推断真人其他性格。电脑开发和刷手机需要运行时电脑/手机道具或动作提示；复用现有小物件，不因背景桌面为空而删掉行为。当前六姿势图不含敲键盘和打电话专用动画，可先用坐姿/站姿＋道具及短状态文字表现，交付注明临时表现方式。

## 3. 四个 NPC 与指定素材

|NPC ID|名字|来源图片|
|---|---|---|
|zhu_zhixin|朱志鑫|ba626ead9435341ce89c2d34a03d05c8.png|
|buzz_lightyear|巴斯光年|7f7142bcb02ecdf2c86c4cf0d1d01da2.png|
|celine|Celine|codex-clipboard-27040317-c068-4259-9039-2cfedf7ac8e3.png|
|fuguidiao|富贵貂|codex-clipboard-0d8d922d-0eb2-458e-b214-a128c614f398.png|
|tutu|图图|Kay 去健身房刷新的六姿势小猫表|

前两张来源目录：`D:/wechat_file/xwechat_files/wxid_z40ttmse7gwb32_ef9a/temp/RWTemp/2026-09/13f040de4c7d7db4c99d4e90503a1dbe/`。
后两张来源目录：`C:/Users/hj120/AppData/Local/Temp/`。
这些是用户指定身份的游戏素材；不要自动替换。导入项目时复制到持久资产目录、去绿底并检查边缘，尤其巴斯光年服装也含绿色，不能把所有绿色统一删除。六姿势逐张核验裁切、透明度与脚底锚点。

## 4. 场景触发规则

|事件|条件|效果|
|演唱会相遇|Jilly 进入 concert|在合法 NPC 点出现朱志鑫，开放 Jilly 的互动入口|
|盲盒店相遇|Cora 进入 popmart|出现巴斯光年，开放 Cora 的互动入口|
|厕所相遇|Amber 进入 restroom|出现富贵貂，开放 Amber 的互动入口|
|健身房相遇|Kay 进入 gym|出现图图，开放 Kay 的互动入口|
|寻找 Amber|Celine 从其他场景进入 hutong，且此时 Amber 的 sceneId 不为 hutong|Celine 冒泡原文：`amber呢`|
|Hawaii 邀请|Celine 平时在 hawaii，偶尔选择 Amber 或 Jilly|发送去 Hawaii 的游戏内邀请，接受后寻路到 Hawaii 与 Celine 互动|

“刷新角色”按入场触发出现解释，不按每帧复制新 NPC。前三个事件每次有效到访触发一次（visitId 去重），角色离场后结束该次互动并回收该次临时 NPC；短时重新进入可设冷却。NPC 已存在时复用实例。其他同场玩家能看见 NPC，专属互动只向指定人物开放。互动先提供点击、招呼、简短气泡，不擅自增加任务奖励或复杂关系系统；除 `amber呢` 外的对白均属可替换创作占位。

Celine 是常驻唯一 NPC，默认在 Hawaii，偶尔来胡同访问，之后返回；不能同时在两个地方出现。`amber呢` 只在 Celine 入场的那次事件判断并播一次，Amber 已在胡同时不触发；Amber 后来离开不倒推补播。离线不等于不在胡同，条件必须读角色真实场景位置。已排队移动的 Celine 不再重复发起访问或邀请。

## 5. 结伴下楼

Amber 与 Cora 较常发起共同出行，偶尔邀请 Laura。流程为邀请 → 接受 → 前往电梯间集合 → 所有人到齐 → 电梯转场 → 后续活动/返回。

电梯间使用 elevator 场景；“下楼”的具体落点用户尚未指定，配置项 downstairsDestination 保留待定，不硬编码成 POP MART 或米线店。一期可让电梯播放“下楼中”并进入有返回入口的临时过渡状态，不能把玩家传送到不存在的地图；正式转场必须等待合法出口配置。

真人手动控制者收到接受/拒绝按钮；不替玩家自动点击、不强行传送。自动模式/离线角色由规则决定是否加入。集合设超时，拒绝或成员无法到达时取消/缩小队伍并给出状态。两位核心成员须均接受才开始结伴，Laura 可选，Laura 不加入不阻塞核心两人。每个角色同一时刻最多参与一个组队事件。

## 6. 给 Sid 送咖啡

用户指定：Kay 早上给 Sid 买咖啡；Amber 下午给 Sid 买咖啡。

规则链：到休息区咖啡机 → 获取咖啡道具 → 返回胡同 → 寻路至 Sid 工位附近交互点 → 交付。不要只显示一句话就标为完成。Sid 不在时可把咖啡放在 Sid 桌面并记录一次送达，返回后出现提示；不强迫 Sid 回工位。道具与送达事件关联，避免重复发放。

真人控制 Kay/Amber 时先显示行动提示，由玩家接受；自动模式/离线时可执行。每位赠送者每个本地日期最多完成一次对应事件，按 Asia/Shanghai 计算日期，并持久化完成记录。重启、重连不能再次赠送。超过时段不补发多天历史事件。首次有人进入世界后只评估当天仍有效的窗口。

## 7. 建议可调默认值（不是用户指定事实）

- 游戏时间先采用北京时间；morning = 09:00–11:30，afternoon = 14:00–17:00。
- 送咖啡在对应窗口内挑一次空闲机会；被玩家拒绝后该窗口不反复催促。
- 一般偏好每 30–60 秒评估；一次工作保持数分钟，外出/手机有持续时间与冷却。
- Celine 访问胡同、邀请去 Hawaii 与结伴事件均低频评估；建议 20–40 分钟冷却，由配置调整。Amber/Cora 的结伴相对其他外出提高权重，不解释为固定频率。
- 临时 NPC 重入冷却建议 60 秒，互动结束/离场时清理；集合超时建议 90 秒。

## 8. 实施约束与最小配置骨架

采用规则驱动即可实现以上一期需求，无需 AI 调用。后续 AI 可生成少量可替换对白，不能改变座位、事件触发条件、领取归属或替真人接受邀请。

```ts
export const seats = {
  'ttc-1': 'jilly', 'ttc-2': 'cora', 'ttc-3': 'amber', 'ttc-4': 'franco',
  'opposite-1': 'sid', 'opposite-2': 'suki',
  'opposite-3': 'laura', 'opposite-4': 'kay',
} as const;

export const encounters = [
  { id: 'jilly-concert', actor: 'jilly', scene: 'concert', npc: 'zhu_zhixin' },
  { id: 'cora-popmart', actor: 'cora', scene: 'popmart', npc: 'buzz_lightyear' },
  { id: 'amber-restroom', actor: 'amber', scene: 'restroom', npc: 'fuguidiao' },
  { id: 'kay-gym', actor: 'kay', scene: 'gym', npc: 'tutu' },
] as const;

export const coffeeGifts = [
  { id: 'kay-morning', from: 'kay', to: 'sid', start: '09:00', end: '11:30' },
  { id: 'amber-afternoon', from: 'amber', to: 'sid', start: '14:00', end: '17:00' },
] as const;
// scene IDs 对接实际 SceneConfig。名字 ID 通过 roster 映射至 f01–f08。
// onSceneEnter(celine, hutong): if amber.sceneId !== hutong -> say('amber呢')
```

扩展 Activity 为 development、work、phone_scroll、phone_call、gym、mixian、popmart、restroom、coffee、snack、concert、group_outing；执行目标用场景交互点 ID，不在规则内写坐标。优先级：玩家指令 > 已接受活动 > 已执行中的活动 > 定时事件 > 随机偏好。玩家取消立即释放预留资源。

服务端维护 event_runs（event_key UNIQUE、参与者、阶段、状态、进度、更新时间）、invites（收件人、状态、过期时间）、NPC 实例及出行队伍。事件先原子占用 event_key，再发起动作；完成阶段与道具变更同事务提交。定时事件键为规则 ID + 上海日期，入场事件键为规则 ID + visitId；重连保留 visitId，真正离场再入才生成新 visitId。定期保存阶段，进程重启后安全恢复或取消，不重复奖励、生成 NPC 或发对白。共享场景状态由单一服务端广播。

验收：座位顺序准确；非指定成员进入场景不触发专属相遇；指定成员进入只出现一个 NPC；Celine 在 Amber 缺席/在场时分支准确；Celine 与八个成员都无分身；邀请可拒绝，手动操作不被抢占；咖啡早晚归属正确、日内去重且重启后仍成立；结伴走电梯而非瞬移；素材服装绿色不被误抠；修改偏好配置无需改渲染组件。
