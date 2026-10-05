# 胡同地鼠验收记录


2026-10-03，在 `hutong-online` 中完成。未修改原页面、角色图片或现有样式。入口 `/moles`，Vite 开发、Vite preview 和生产 Node 服务均支持；Vercel 用显式 rewrite。

2026-10-04 更新：按要求删除选人标题、已选人数、选人解释、人物就绪提示、右侧双模式及六十秒文案和页脚硬件解释。保留功能按钮及必要错误消息。本地 `npm run build` 已通过，先前成员预览的类型错误已不再出现；桌面和手机流程重新验证通过，截图已更新。Vercel 授权已恢复，最新 Preview 构建成功，已包含本次删文案修改及删除默认“纯网页模式 · 无需设备”提示；本地入口为 `http://127.0.0.1:5173/moles`。

预览：[打开胡同地鼠](https://hutong-online-29ql5aqkc-hanjinglauras-projects.vercel.app/moles)。这是 Vercel Preview，若项目启用了部署保护，需要登录对应 Vercel 账号。

## 自动验证

- 小游戏完成时 `npm run build`：TypeScript 检查和 Vite 构建成功，更新后的 Vercel Preview 构建也通过。原 Phaser 入口仍有大 chunk 提示，小游戏入口独立。
- 最后本地全量检查时，`src/member-review.ts` 在 23:15 被独立修改，出现第 88 行 `frame.index` 的 TS2339 类型错误。本任务保留该文件，未修写原成员预览页面；`npx vite build` 仍成功，已更新本地 dist。此问题不在本次小游戏修改中。
- `npm test`：原有 13 项测试全部通过。
- `npm run test:moles`：新增 5 项测试全部通过；包括生产服务 `/moles`、`/moles/`、查询参数及原首页。
- 浏览器桌面 1280×900、手机 390×844：三个选中角色刷新后保持；清空禁止开始；3 秒倒计时；只出现选中角色；键盘命中、点击命中、结束页和换人返回正常；无横向溢出，无 JavaScript 页面错误。
- 浏览器真实触摸仿真上下文（`hasTouch: true`）：用 `tap()` 点击开始和冒头窗口，分数变为 1。
- 开发时钟注入用于固定截图中的短暂命中状态，并推进到 60 秒结束；实际 60 秒规则也由引擎测试覆盖。生产构建移除 `window.__moles` 验收入口。

### 假串口结果

Node 测试使用真实 `ReadableStream` / `WritableStream` 包装假端口；浏览器也替换 `navigator.serial`，通过页面“连接 Uno”按钮测试完整数据流，未插实物。

```json
{
  "baudRate": 115200,
  "writes": ["ALL:0\n", "ON:2\n", "OFF:2\n"],
  "score": 1,
  "person": "f02",
  "status": "Uno 已断开，继续网页游戏",
  "realTouchScore": "1"
}
```

收到 READY 前写入数为 0；分片 `REA` 不触发握手，随后 `DY\r\n` 完成握手；冒头发 ON，`HIT:n` 使页面加分并发 OFF；断开保留游戏状态。Node 测试另外覆盖超时错误、无效行、超长行、单选与多选约束、350ms 速度下限、空洞和重复命中、截止时不计分。

### Uno 编译

```text
arduino-cli compile --fqbn arduino:avr:uno firmware/hutong_moles
Sketch uses 3396 bytes (10%) of program storage space. Maximum is 32256 bytes.
Global variables use 296 bytes (14%) of dynamic memory, leaving 1752 bytes for local variables. Maximum is 2048 bytes.
```

AVR core 1.8.6，无第三方库。未实际烧录、接线或插板验证；USB 重启耗时和硬件接触问题仍需实物确认。接线、烧录和 Windows Chrome/Edge 操作步骤见仓库 README。

## 截图

截图来源为本地 Playwright 浏览器，不是生成图。桌面截图为完整页面，游戏状态高度可能超过 900px；手机同样为完整页面。

|状态|桌面|手机|
|---|---|---|
|选中三人|[桌面](moles/desktop-selection.png)|[手机](moles/mobile-selection.png)|
|角色冒头|[桌面](moles/desktop-playing.png)|[手机](moles/mobile-playing.png)|
|打中抖动、星星|[桌面](moles/desktop-hit.png)|[手机](moles/mobile-hit.png)|
|结束|[桌面](moles/desktop-result.png)|[手机](moles/mobile-result.png)|

[原胡同首页截图](moles/original-home.png)：场景、原有按钮和人物正常显示。

## 设计检查与交付状态

沿用仓库深绿、灰砖、米黄像素配色，使用直角边框与 Canvas 最近邻缩放。没有整页白色圆角容器、渐变 AI 标志、虚构品牌、装饰导航、玻璃效果或模糊光团。

当前工作目录没有 `.git`，尚不能建立现有仓库的分支或 PR；没有初始化新仓库，也没有推送 main。已准备 [PR 描述](hutong-moles-pr.md)，待确认此目录对应的现有远端后完成提交。
