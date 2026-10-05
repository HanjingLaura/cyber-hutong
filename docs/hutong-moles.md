# 胡同地鼠（Hutong Moles）


独立入口 **`/cyber-hutong/moles`**（本地为 `/moles`）（也可打开 `/moles.html`）。`npm run dev` 后访问终端地址下的 `/moles`；生产环境运行 `npm run build` 和 `npm start`。网页无需账号或 Uno 就能玩，鼠标、触摸及键盘 Q W E / A S D 对应窗口 0–5。选择至少一个角色开始，3 秒倒计时后每局 60 秒。打中 +1，停留从 1200ms 每次减 40ms，最低 350ms；打空、打错或让角色溜走会断连击，不扣分。两次冒头间隔随机 300–900ms。选择和本机最高分保存在此浏览器 localStorage，隐私模式或禁用存储时仍可玩但可能不保存。

八个角色直接复用 `assets/characters/team/v2/` 中的现有图片与 `assets/metadata/team-v2.json`，未生成新人物或改动原资源。游戏 ID 映射为 f01 Suki、f02 Sid、f03 Jilly、f04 Laura、f05 Kay、f06 Franco、f07 Cora、f08 Amber。按最新要求保留原素材姿势，命中时只做人物整体轻微抖动、头顶星星和缩回；星星由 Canvas 绘制。本入口不加载原胡同场景的脚本与样式。

## Uno 接线

先断开 USB 再接线。6 个按键与 6 颗 LED 各排成**一横排**，从左到右均为 0–5；网页为 **2 行 × 3 列**，左上至右下为 0–5：上排 0、1、2，下排 3、4、5。实体第 4 个位置对应网页左下窗口 3。

|编号|网页位置 / 键盘|按键引脚|LED 引脚|
|---|---|---|---|
|0|左上 / Q|A0|D2|
|1|上中 / W|A1|D3|
|2|右上 / E|A2|D4|
|3|左下 / A|A3|D5|
|4|下中 / S|A4|D6|
|5|右下 / D|A5|D7|

每个按键一脚接表中 A 引脚，另一脚接 GND，使用 `INPUT_PULLUP`，按下为 LOW（四脚轻触开关要跨两组接点）。每颗灯单独串联 220Ω 电阻：D 引脚 → 220Ω → LED 长脚，LED 短脚 → GND。所有 GND 共地。D0、D1 留空，不用外接上拉电阻。

## 烧录与单独查接线

1. Windows 安装 Arduino IDE，USB 接 Uno，打开 `firmware/hutong_moles/hutong_moles.ino`。
2. 工具 → 开发板选 Arduino Uno，工具 → 端口选该板的 COM 端口，点击上传。无第三方库依赖。
3. 上电后 6 颗灯从左到右各亮约 150ms，900ms 内完成自检，串口输出一次 `READY`。固件用 `millis()`，不使用阻塞 `delay()`；20ms 消抖，长按只报一次按下。
4. 查线可打开串口监视器，波特率 **115200**，右下角行尾选 **“换行”或“NL 和 CR”**，输入 `TEST`。灯依次亮一遍；按任意键显示“键 n 按下”（n 为 0–5）。正常协议为 ASCII，只有 TEST 的人工诊断文字为 UTF-8。网页发出合法灯命令后自动退出测试模式。
5. 连网页前**关闭串口监视器**（串口只能由一个程序占用）。

也可用 [Arduino CLI](https://docs.arduino.cc/arduino-cli/commands-reference/arduino-cli_compile)：

```powershell
arduino-cli core install arduino:avr
arduino-cli compile --fqbn arduino:avr:uno firmware/hutong_moles
arduino-cli upload --fqbn arduino:avr:uno --port COM3 firmware/hutong_moles
```

将 COM3 换成实际端口。不连 Uno 时无需安装 Arduino 软件。

## Windows + Chrome / Edge 连接网页

1. 用电脑 Chrome 或 Edge 打开 HTTPS 部署的 `/moles`；本机开发可使用 `http://127.0.0.1:5173/moles`（以实际端口为准）。[Web Serial 要求安全上下文](https://developer.chrome.com/docs/capabilities/serial)。
2. 点击右上角“连接 Uno”，选择板子的串口并连接，115200 波特率。Uno 打开串口会重启约 2 秒，网页必须收到 `READY` 才发送任何命令。4 秒仍未收到时提示“没连上胡同地鼠固件，请检查是否烧录”，可检查烧录和端口后重试。
3. 选人并开始。网页和 LED 同步；网页点击、触摸、键盘和实体按键共用 `src/moles/engine.mjs` 中的计分逻辑。中途接入也会同步当前灯。拔掉 USB 自动转回网页模式，当前局继续；可点“断开 Uno”主动断开。

每条协议以 `\n` 结尾：网页发 `ON:n`、`OFF:n`、`ALL:1` / `ALL:0`、`PING`；Uno 发 `READY`、`HIT:n`、`PONG`。n 为 0–5，未知行忽略。接收先缓存到换行，兼容 CRLF。不支持 Web Serial 的浏览器会禁用连接按钮并提示“请用电脑上的 Chrome 或 Edge”。**Safari 不支持 Web Serial；手机仍能玩纯网页版。** 未加入音效。Vercel 静态预览可玩本小游戏，原多人胡同后端仍按现有常驻 Node 方式运行。

模拟验收：`npm run test:moles`，无需插板，覆盖倒计时、计分、速度下限、选人约束、READY 前零写入、分片行、ON/OFF 同步、断开回退和超时。截图、编译输出及验收说明见 [hutong-moles-acceptance.md](hutong-moles-acceptance.md)。

