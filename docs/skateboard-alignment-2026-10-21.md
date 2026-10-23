# 校园滑板人物定位修复

版本：`2026-10-21-skateboard-alignment`。

用户截图显示人物脚底悬在滑板上方。实际透明滑板图片为 48×16，中央板面在第 7 行；原来中心点放在人物 y+6，造成板面在脚底锚点下方 5 像素。现在中心点改为 y+1，并与人物一起取整，移动时保持像素对齐。素材路径与图片内容不变，没有生成或堆放新素材。

浏览器检查同时发现坐姿错误地使用椅子骨盆锚点，双腿穿过板面。滑板站姿与坐姿现均使用脚底锚点，电动车继续使用原有车座锚点。

回归先在原代码下失败，分别明确复现 5 像素悬空及坐姿脚底下穿 10 像素；修复后通过。完整服务端 432/432 通过，日志 `output/skateboard-alignment-tests-final.log`。

真实 Chrome 隔离检查通过：`output/skateboard-alignment-1792548193837/verification.json`。通过实际 E 上下板、WASD 四方向、F 切换坐姿、Esc 下板及重新上板，逐帧检查板面与人物脚底位置一致；截图已人工查看。没有浏览器错误，模型调用为 0。场景进入和初始站位为测试夹具，没有生产登录或写入。

保持原像素风与单窗口布局，无新增界面元素或品牌装饰。

云端正式构建通过并已 promote：`dpl_AJzTMAqtxmuW98WNzp34BSCtaNZB`，不可变地址 `https://cyber-hutong-ap3lwikcz-hanjinglauras-projects.vercel.app`，日志 `output/skateboard-alignment-deploy.log` 与 `output/skateboard-alignment-promote.log`。

本地默认输出目录构建遇到 Windows EBUSY 资源锁；随后使用独立输出目录进行相同类型检查与 Vite 构建，通过，日志 `output/skateboard-alignment-build-isolated.log`。

正式域名 Chrome 只读检查通过：`output/production-eight-agents-1792548694791/verification.json`，版本匹配、页面加载正常，无浏览器错误，没有生产写入或模型调用。
