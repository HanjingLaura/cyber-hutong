# 新增胡同地鼠：独立网页游戏与 Arduino Uno 输入固件

入口 `/moles`。网页无需硬件就能玩；连接 Uno 后，网页点击、触摸、Q W E / A S D 和实体按键同时生效。60 秒规则、随机冒头、加速、连击和计分都在网页 `src/moles/engine.mjs` 中运行，固件只执行灯命令与上报按键。

[Vercel Preview](https://hutong-online-29ql5aqkc-hanjinglauras-projects.vercel.app/moles)

八位同事多选（至少一位），全选、清空和 localStorage 保存。仅选中的人冒头；复用现有 team/v2 图集，以 f01–f08 映射，不改图像、不生成新人物。命中时保留原素材姿势，整体轻微抖动、头顶星星后缩回，不抬胳膊。结束展示本局分数、纪录及命中最多的同事，支持并列、零命中、换人重开。独立 HTML、CSS、脚本入口，保留原页面与资源。

## 接线

|编号|网页位置 / 键盘|按键 INPUT_PULLUP|LED|
|---|---|---|---|
|0|左上 / Q|A0|D2|
|1|上中 / W|A1|D3|
|2|右上 / E|A2|D4|
|3|左下 / A|A3|D5|
|4|下中 / S|A4|D6|
|5|右下 / D|A5|D7|

实体按键和 LED 各一横排，左至右 0–5；网页仍为 2×3，左上至右下 0–5。按键另一脚接 GND；每颗 LED 单独按 D 引脚 → 220Ω → LED 长脚，短脚 → GND。D0、D1 不用。

## 烧录与连接

Arduino IDE 打开 `firmware/hutong_moles/hutong_moles.ino`，选择 Arduino Uno 和实际 COM 端口，上传。无第三方库；20ms 非阻塞消抖，长按不重复，900ms 上电灯自检后发 READY。串口监视器 115200，行尾选“换行”或“NL 和 CR”，输入 TEST 自检灯，按键输出“键 n 按下”。

关闭串口监视器，Windows 电脑 Chrome/Edge 打开 HTTPS `/moles` 或 localhost。点右上“连接 Uno”，选择串口；网页 115200 打开后等待 Uno 重启约 2 秒，收到 READY 才发送命令，4 秒超时显示烧录提示。缓存至换行才解析消息；中途连接同步当前 LED，拔出自动继续网页游戏。

```powershell
arduino-cli compile --fqbn arduino:avr:uno firmware/hutong_moles
arduino-cli upload --fqbn arduino:avr:uno --port COM3 firmware/hutong_moles
```

COM3 替换为实际端口。协议每条 ASCII 行以换行结束；TEST 人工诊断文字为 UTF-8。

## 验证与限制

`npm run build` 通过；原 `npm test` 13/13 通过；`npm run test:moles` 5/5 通过；浏览器假串口验证 READY 前零写入、分片行、HIT 计分、ON/OFF 同步、断开继续。真实触摸仿真 tap 命中成功。Uno CLI 编译通过，3396 bytes flash / 296 bytes RAM。桌面、手机四种游戏状态及原首页截图见 [验收记录](hutong-moles-acceptance.md)。

Web Serial 必须使用支持它的电脑 Chrome/Edge，Safari 不支持；手机可玩纯网页。HTTPS 或 localhost 才能连接硬件。未做实物烧录和接线测试，未加入音效。Vercel 预览是静态站，原多人胡同需要现有 Node 后端；此游戏不依赖它。Vercel 部署保护若开启，预览需要相应账号访问。

最后本地全量检查时，独立修改的 `src/member-review.ts:88` 出现 `frame.index` 的 TS2339；本次没有改动它，保留现有工作。更新的小游戏 Vercel 构建通过，本地 `npx vite build` 通过；上述全量 TypeScript 问题待原成员预览改动处理。
