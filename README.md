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

私聊：把百炼 Key 填进根目录 `.env` 的 `DASHSCOPE_API_KEY=`，然后 `node src/server/index.mjs`，打开 http://127.0.0.1:8787 。领取码在 `data/claim-codes.txt`。自动角色用 `qwen-turbo` 非思考模式；真人在线时模型不会替这个人说话。

交接文档中的 Windows 绝对路径是素材来源记录。实际开发请用本仓库相对路径：场景见 assets/scenes，NPC 见 assets/npcs，预览见 examples/login，行为代码见 examples/mvp-behavior。原始照片、聊天剪贴板截图、旧版素材、node_modules 和 ZIP 未上传。
