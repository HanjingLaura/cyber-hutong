# 独立扭蛋机素材

版本：`2026-10-21-capsule-machine`。

按用户要求，以内置 image_gen 单独绘制完整粉色扭蛋机，替换 `src/popmart.ts` 从 POP MART 场景背景的 838,150 位置截图裁切的旧方案。新素材包含屋顶、透明玩具仓、左侧旋钮、右侧空取物口与底脚，透明背景、近正面微侧视、统一像素描边及左上光照，无场景背景或文字。

正式文件：`assets/props/capsule-machine.png`，82×190；完整生成提示、源文件与指纹：`assets/metadata/capsule-machine.json`；导入脚本：`scripts/materialize-capsule-machine.mjs`。只保存一个正式资源，最近邻缩小并保持 alpha，原始生成图留在项目外的生成目录。

面板与扭蛋流程沿用原实现。旋钮动画按新机身校准，仅在转动时叠加；扭蛋动画限制在取物口内部，打开后恢复完整机器底图，避免原 `clearRect` 擦出机身透明洞。旧场景背景继续用于店铺场景，不复制截图作为新素材。

完整服务端 432/432 测试通过：`output/capsule-machine-tests.log`。Chrome 隔离验收通过：`output/capsule-machine-1792550833178/verification.json`；1440×900 与390×844 显示均在视口内，E 打开、转动、取蛋、打开扭蛋、关闭重开与 Esc 关闭通过。截图已人工检查，模型调用为 0，无浏览器错误。场景与初始站位为隔离夹具，未写生产账号。

云端类型检查与正式构建通过：`output/capsule-machine-deploy.log`。部署 `dpl_2vvCrm1tuJ6gVCUTgYqHdiT9D2Pz` 已 promote 到正式域名，不可变地址 `https://cyber-hutong-pgd2hi4hl-hanjinglauras-projects.vercel.app`。

正式域名 Chrome 只读检查通过：`output/production-eight-agents-1792550992466/verification.json`，版本正确、页面正常且无浏览器错误，未登录或调用聊天模型。
