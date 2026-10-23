# 执行记录

用户已确认两项设计与实现计划并要求开搞；新增明确指令：咖啡独立做MANNER门店场景，米线店也做且更新素材。

Ruling: 继续当前codex/ktv-scene-albums工作区，不重置/复制451处既有未提交改动；这是承接已上线版本的连续开发。所有本轮文件及验证独立记录，不自动提交。
Ruling: 咖啡计划的yousheng窗口替换为manner独立第21场景；沿用订单/取杯/现有赠送协议，地图与出口一并接通。用户明确要求，直接落实，不再重复审批。
Ruling: 两个实现域并行，按dispatching-parallel-agents技能隔离文件所有权；根任务负责图像生成、WorldClient集成、全套验证/发布。三个玩具保持暂缓。

- [x] 米线八座/明确选碗/共享订单
- [x] 米线正式美术
- [x] MANNER场景/咖啡订单/取杯
- [x] 独立审图、真实Chrome场景与互动验证
- [x] 完整服务端测试、构建、生产发布及只读检查

Ruling: 远侧初稿y216/surface201在真实8人图里看起来站立；根与独立审图一致决定仅调新4..7座位到y230/surface215/approach202，旧0..3不变，不重画桌椅。
Ruling: noodle订单用专用payload签名receipt、全局列表revision及客户端拒旧；receipt重试不能把撤单回退为active。加入红绿回归；GET只做过期投影不写库。跨实例以稳定accounthead及scene meta实现冲突保护。内部world请求用不可预测服务端UUID，外层receipt保证重试不重复发食物。
Ruling: 采用的新背景、托盘、调料和纸张已独立审图；保持原图canonical路径，manner独立640×360背景，实际美术决定点单260,216/取杯440,216/地面204。

最终源码完整server353/353通过，build55.24秒通过；米线11项实机绿，MANNER完整双方普通出口/取杯/赠送/失控/断线绿，21场景恢复全绿。资源清单63项审核通过/缺失与重复0。发布进行中，待受控线上只读检查。

已发布2026-10-20-noodle-manner，dpl_7P7BpyVd1ujEFe555SQy99KQUCXH；线上smoke/MANNER注册/63资源hash均绿。最终报告docs/noodle-manner-2026-10-20.md，机器记录output/social-scenes/release.json。真人8人试玩仍未声明通过，3件玩具仍暂缓。
