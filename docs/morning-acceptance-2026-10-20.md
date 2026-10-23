# 明早验收

入口：https://hanjing-laura.vercel.app/cyber-hutong/  
版本：2026-10-20-interaction-focus

## 先看这几处

1. 米线店：桌凳、饮料柜、米线与炸鸡柜；坐下后查看餐桌菜单，拿食物、放回、起身再互动。
2. 休息室：冰箱、贩卖机、咖啡机；取物、放回，Esc关面板后再按E。
3. POP MART与娱乐室：盲盒、扭蛋、娃娃机；检查商品图、动态爪子、结果与收藏。
4. 会议室与Google：椅子脚底、坐姿与遮挡。校园：路锥、滑板与碰撞。KTV：文字、点歌及拿麦。
5. 连续切换几个场景，短时断网再恢复；发现问题记录版本、场景、步骤与恢复时间。

## 已有证据

| 范围 | 结果 | 权威记录 |
|---|---|---|
| 20场景进入/互动/退出再进入 | 正常出口和E，40次通过；恢复397ms | output/scene-interactions-1792427176712/verification.json |
| 完整服务端/地鼠/构建 | 329 / 5通过，发布构建通过 | output/art-refresh-server-tests-final.log、art-refresh-moles.log、art-refresh-build-release.log |
| 全场景视觉与窄屏面板 | 20场景、电脑1440/390/320、KTV小屏独立复核通过 | output/art-refresh/browser-art-verification.md |
| 正式48项新素材 | 39外部文件字节匹配、9内嵌图匹配线上脚本；全部可解码 | output/production-pixel-art-assets-1792452619907/verification.json |
| 八人并发30分钟 | 隔离PartyKit+持久化、112181请求、0失败 | output/integration-1792419204452/verification.json |
| 八人真实模型聊天链路 | 隔离真实百炼，24次，保护计费13181/20000token | output/agent-preflight-1792419303514/verification.json |
| 线上配置/隐私/登录 | 新版本、模型ready、后台调用关闭、无资料编辑入口、人设文件404 | output/production-pixel-art-1792452430996/verification.json |

## 边界与未完成项

- 巴斯、海绵宝宝、派大星三款图片生成被工具拦截，仍是旧图；未冒充已更新。记录：output/art-refresh/shop-blocked-assets.json。
- 八位本人线上30分钟试玩未验证，按用户自行安排的时间进行；每人使用自己的账号，不提供密码。轮换方案见docs/acceptance-2026-10-19.md。
- LLM负责聊天；离线走动与活动由现有规则负责。没有新增模型自主使用物件。
- 本次视觉验收不调用真实聊天模型；每日上限仍为200次/50000token，不自动提高。此前真实预检24次额度已用完。
- 生产只做受控检查，不跑隔离压测。自动化、截图fixture、本人试玩分别记录。

## 反馈格式

版本 / 设备浏览器 / 场景 / 操作步骤 / 预期与实际 / 能否再次复现。不要提供密码、密钥或私聊正文。

用户最新确认：三款玩具仍须全部替换，不接受保留旧图作为本轮例外；待有可用素材后继续。当前三张旧图只维持线上现有功能，不计入本轮替换完成。

用户随后调整顺序：三款玩具先暂缓，继续其他工作；不以这三项阻塞当前互动修复，后续仍须补齐。快捷物品操作焦点修复见docs/interaction-focus-2026-10-20.md。

本轮追加：快捷喝掉/吃掉/收藏后的焦点恢复已修复并上线。快捷操作成功、503失败、迟到响应保护聊天输入，以及直接方向键和E续玩已通过隔离Chrome验证。详情见docs/interaction-focus-2026-10-20.md。
