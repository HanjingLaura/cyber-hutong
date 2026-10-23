# 空气曲棍球左右球门

版本：`2026-10-21-hockey-side-goals`。

用户指出球门应在左右两端。原素材及碰撞/计分均按上下球门实现；本轮通过内置 image_gen 编辑桌面，封闭上下开口，在左右两端开门，并改为竖直中线。直接替换正式 `assets/props/arcade-hockey-table.png`，没有保留旧素材副本或新增未使用候选。

玩法与素材一起调整：玩家在左半场、电脑在右半场；指针和键盘遵守半场约束，电脑上下跟随；左右开口进球分别记对方得分，上下边框和侧面非开口位置反弹；击球方向、交替发球和重开位置一致。球门实际开口 y173..247，考虑球半径8，中心位于 y181..239 才允许通过。

四项回归在原实现下全部失败，修改后全部通过。覆盖左右进球/归中、上下及侧面封闭区反弹、半场控制与重开、双方击球方向。生成提示、尺寸与指纹见 `assets/metadata/hockey-side-goals.json`，导入脚本 `scripts/materialize-hockey-side-goals.mjs`。

完整测试 436/436 通过：`output/hockey-side-goals-tests.log`。Chrome 实际按键验收通过：`output/prop-followup/sports/browser-1792551564355/verification.json`；桌面和390px手机均未溢出，移动挡板/球、Esc关闭恢复焦点与步行通过，篮球开关/投篮复核也通过，无浏览器错误和失败图片。模型调用为0。场景与初始站位为隔离夹具，未登录生产账号。

本地类型检查和正式构建通过（独立输出目录）：`output/hockey-side-goals-build.log`。资源清单审计无缺失引用、无重复资源，更新记录与素材指纹在 `output/art-refresh/hockey-side-goals-generation-final.json`。发布过程曾多次在上传前遇到 `fetch failed`；登录与接口连通检查正常，未改产品代码绕过，重试后恢复上传。

云端类型检查与构建通过，部署 `dpl_897VmkhmXhcZQniC4VWhHo6hpzPV` 已 promote 到正式域名；不可变版本 `https://cyber-hutong-as3cij5nc-hanjinglauras-projects.vercel.app`。日志 `output/hockey-side-goals-network-detail.log`、`output/hockey-side-goals-promote.log`。

线上 Chrome 只读检查通过：`output/production-eight-agents-1792553139204/verification.json`，版本正确且无页面错误。新桌面图片 `arcade-hockey-table-DvLqp7tC.webp` HTTP200且内容指纹与本地构建一致：`output/hockey-side-goals-production-art.json`。最初 Node APIRequest 直连资源超时，改用与页面一致的真实Chrome读取通过，没有改变资源或跳过指纹验证。线上检查没有登录或模型调用。
