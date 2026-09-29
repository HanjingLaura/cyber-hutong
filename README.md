# 赛博胡同 (cyber-hutong) — assets and MVP handoff

These are the 8 final character sheets (`characters/f01.png` … `characters/f08.png`).

Each sheet shows one character in six poses, left to right:
front, back, side_right, walk_right, sit_front, sit_back — on a #00FF00 green background.

## 本次导入

从素材设计任务整理了最新选用版本，旧版未重复导入，原有八张角色表保持不变。

|目录|内容|
|---|---|
|`characters/`|八人角色：f01 Suki、f02 Franco、f03 Sid、f04 Jilly、f05 Laura、f06 Kay、f07 Cora、f08 Amber|
|`assets/scenes/`|16 张场景，包括胡同八工位、空桌双视角、休息区、厕所、Hawaii、POP MART、演唱会等|
|`assets/props/`|7 张小物件图集及黑色办公椅正背面|
|`assets/npcs/`|朱志鑫、巴斯光年、Celine、富贵貂四张绿底原图|
|`assets/avatars/`|原创头像 PNG/GIF、飞书暖肤色头像|
|`examples/login/`|登录/注册/忘记密码静态预览与指定背景图；打开 index.html 查看|
|`examples/mvp-behavior/`|独立行为模块、9 项测试及接入说明|
|`docs/handoff/`|MVP 架构、实施 prompt、人物行为和事件设计|

NPC、角色和部分小物件保留绿底，导入游戏前需要裁切与去背景；巴斯光年服装中的绿色必须保留。场景中含椅子时不要重复叠加椅子。登录预览未连接后端，行为代码未连接寻路、渲染和数据库。

运行模块测试：`node --test examples/mvp-behavior/engine.test.mjs src/server/chat.test.mjs`。

私聊：把百炼 Key 填进根目录 `.env` 的 `DASHSCOPE_API_KEY=`，然后 `npm start`，打开 http://127.0.0.1:8787 。领取码在 `data/claim-codes.txt`。自动角色用 `qwen-turbo` 非思考模式；真人在线时模型不会替这个人说话。模型只写对白，不决定坐标、领取或是否接受邀请。

## 胡同场景（桌面）

### 线上账号（Turso）

Vercel 使用独立 Turso 数据库 `cyber-hutong-auth`，环境变量为
`TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`。账号、固定领取码哈希、领取状态、
密码哈希、登录会话和重置码持久化保存，重新部署不会重新开放已领取角色。
八个英文名与角色绑定；只有名字对应的领取码能注册，不能自行选择他人角色。
原始领取码不提交仓库。不要把生产数据库连接到不可信的 PR 预览环境。

这次是新的账号库，不会自动导入旧 `/tmp` 实例中可能已丢失的账号。
持有指定领取码的成员需在新库首次注册并自设密码；之后直接登录。
本地未配置 Turso 时仍是独立的开发 SQLite，不代表线上账号。
管理员可在受信任终端加载生产环境变量后运行
`node src/server/reset-password.mjs NAME`，生成一次性、15 分钟有效的重置码。
固定领取码本身不能用于找回密码。

验证：`npm test`。显式云端集成测试为
`HUTONG_CLOUD_TEST=1 node --env-file=.env.production.local scripts/verify-cloud-auth.mjs`，
只领取随机隔离测试表中的角色，最后删除本次测试表，不消耗正式领取资格。
**范围限制：**聊天记录、移动世界和在线状态仍由原进程/临时 SQLite 管理；
本次账号持久化不代表已经实现跨 Vercel 实例的权威多人世界。

`npm start` 后登录，进入 1280×720 的胡同。WASD 或方向键移动，点击可走地面寻路，靠近人或自己的工位后按 E，Esc 关闭私聊。输入框聚焦时移动键不会走动。

位置由常驻 Node 进程计算。浏览器只提交带序号的意图，服务端做碰撞、速度和距离判断。同一角色同时只有一个控制窗口，断线约 15 秒内用原窗口重连。座位是 `ttc-1..4`（Jilly、Cora、Amber、Franco）和 `opposite-1..4`（Sid、Suki、Laura、Kay）。角色表只有正面、背面、朝右站立、朝右迈步、正面坐、背面坐，没有四向走路循环。

门口按 E 可以选择电梯间、休息区、厕所、POP MART、演唱会、Hawaii、健身房或米线店，到了再按 E 回胡同。Jilly 进演唱会出现朱志鑫，Cora 进 POP MART 出现巴斯光年，Amber 进厕所出现富贵貂；离开后收掉，不会重复生成。Celine 住在 Hawaii。Amber 不在胡同时，Celine 进胡同会说一次「amber呢」。托管角色按偏好偶尔出门，服务器确认走到目标后才开始停留，再走回自己的工位。Amber 和 Cora 下楼会先在电梯间会合，没有指定楼下目的地时就停在那里。Celine 在 Hawaii 时偶尔邀请 Amber 或 Jilly；手动角色会看到“去 / 不去”，不同意就不会被拖走。托管角色买咖啡会先走到咖啡机，服务器确认到达后才进入下一步。Vercel 上的 SQLite 在 `/tmp`，不能当正式存档；多人权威世界需要本机或一台常驻进程加持久卷。不要把 `data/`、`.env`、领取码提交进 Git。

验证：`npm test`。桌面请看 1280×720 和 1440×900，并切换系统浅色、深色和减少动画。

交接文档中的 Windows 绝对路径是素材来源记录。实际开发请用本仓库相对路径：场景见 assets/scenes，NPC 见 assets/npcs，预览见 examples/login，行为代码见 examples/mvp-behavior。原始照片、聊天剪贴板截图、旧版素材、node_modules 和 ZIP 未上传。
