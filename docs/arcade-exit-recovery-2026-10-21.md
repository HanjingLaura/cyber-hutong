# 娱乐室离开后场景加载恢复

版本：`2026-10-21-arcade-exit-recovery`。

普通隔离实玩中，投篮和曲棍球结束关闭后往返娱乐室、会议室4次未复现。进一步阻断首次会议室椅子图片请求，复现截图对应的“载入1/1、地图关闭禁用”：预加载清单只有会议室背景，椅子由随后 Phaser 场景预载单独请求，既不计入进度，也不能由用户取消等待。这一复现中小游戏已关闭；不将隔离故障夹具当作用户设备实际网络原因的证明。

修复：会议室与 Google 总结会的独立椅子加入共享预加载及缓存，真实进度包含依赖资源。提交服务器切换之前，关闭按钮与 Esc 可取消素材加载和场景准备；取消释放预载槽位、清除场景监听器与超时，停止未提交场景并保留原位置。正式提交后继续禁止中断，并沿用服务器位置恢复机制，避免客户端取消造成位置分歧。准备场景与确认位置显示各自阶段。

原代码故障验收失败：`output/arcade-exit-cold-red.log`，断言冷加载期间关闭按钮不应禁用。修复后同一脚本通过：`output/arcade-exit-1792553585119/verification.json`，9项浏览器检查，包含故障取消、重新进入、四次往返、游戏关闭恢复焦点与移动；初次正常路径报告 `output/arcade-exit-1792553361304/verification.json`。全部为隔离账号与显式网络夹具，没有生产账号写入或模型调用。

新增两项单元回归覆盖取消冷素材加载后重试、取消场景创建及时释放；相关导航/预载19项通过。公共接口、小游戏规则、前端布局和美术素材不变。

完整服务端438/438通过：`output/arcade-exit-tests.log`。云端类型检查与构建通过：`output/arcade-exit-deploy.log`。部署 `dpl_AzePaDBbVKrr5Z1cPu2tyxJbe3C4` 已 promote 到正式域名，不可变地址 `https://cyber-hutong-lt84wbtu5-hanjinglauras-projects.vercel.app`；切换日志 `output/arcade-exit-promote.log`。

线上Chrome只读检查通过：`output/production-eight-agents-1792554681837/verification.json`。正式版本匹配、页面正常、无浏览器错误，未登录生产账号或调用模型。正式入口 `https://hanjing-laura.vercel.app/cyber-hutong/`。
