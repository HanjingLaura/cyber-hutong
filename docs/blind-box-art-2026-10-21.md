# 盲盒选盒包装更新

版本：`2026-10-21-blind-box-art`。

选盒面板原来按百分比裁切陈列柜大图，包装偏窄且右侧混入相邻区域。替换为独立三款包装精灵，沿用粉色兔子、蓝色小熊、奶油黄色小熊；相同基线、比例、略俯视视角、右侧厚度与左上光照，深色像素描边。保留原六列选盒、编号、库存、抽取、补货及收藏行为。

正式文件为 `assets/props/blind-box-packaging.png`，144×64 透明图集，三个 48×64 帧。桌面原生 48×64，手机 36×48，保持 3:4 比例与 pixelated 渲染。删除旧包装裁切逻辑及冲突的图片尺寸规则。原陈列柜大图还供场景柜体使用，不能整张删除；新素材仅一个正式文件，候选源留在项目外生成目录。

使用内置 image_gen，完整生成规格、源文件与指纹见 `assets/metadata/blind-box-packaging.json`。导入脚本 `scripts/materialize-blind-box-art.mjs` 先分格再透明裁切、最近邻缩放，保持 alpha。视觉提示：三款透明背景像素纸盒，粉兔、蓝熊、奶油熊，近正面小幅俯视、狭窄右侧、统一左上光照、深色描边、有限色阶，无文字、logo、柜台或投影。

Impeccable 检测只报告既有 `.pixel-box` 旧样式与钢琴按键侧边高光，未引入新的通用界面装饰。现有像素风、单窗口和操作不变。

Chrome 隔离检查通过：`output/blind-box-art-1792550525314/verification.json`。桌面 1440×900、手机 390×844 中弹窗在视口内、全部包装原图 48×64、实际显示保持比例；实际 E 打开、选中、抽取、关闭重开、Esc 退出均通过，截图已人工查看，无浏览器错误，模型调用为 0。

全量测试最终 432/432 通过：`output/blind-box-tests-final.log`。首次高并行运行中吞吐时间窗口断言未通过；降低测试进程并发至 2 后全量复跑通过，没有修改断言。云端完整类型检查与正式构建通过：`output/blind-box-deploy.log`。本地重复构建因资源竞争主动停止，以独立云端构建作为发布构建证据。

部署：`dpl_GwLL6PWNtavCAV6oJyQwFF3pjy7X`，不可变地址 `https://cyber-hutong-16uk7elux-hanjinglauras-projects.vercel.app`。

已 promote 到正式域名。线上 Chrome 只读检查通过：`output/production-eight-agents-1792550656184/verification.json`，版本匹配、页面正常，无浏览器错误。正式入口 `https://hanjing-laura.vercel.app/cyber-hutong/`。
