# 旧项目彩蛋人物

本次直接复制 cyber-hutong/assets/npcs 的原 PNG，不重新生成角色。

| 人物 | 场景 | 脚点 | 高度 |
| --- | --- | --- | --- |
| 巴斯光年 | POP MART 右侧通道 | 430,253 | 62 |
| 朱志鑫 | 演唱会舞台中央 | 320,145 | 54 |
| 富贵貂 | 厕所洗手台旁通道 | 400,269 | 45 |

统一从旧项目公布的正面帧范围裁出完整人物，运行时使用旧绿幕规则去背景（保留巴斯的绿色盔甲），最近邻渲染，脚点作为遮挡排序基准。角色脚下设置碰撞，不占用座位或机器的交互点。当前为静态站立彩蛋人物。

已验证三个场景显示对应人物，切换场景只显示本场景人物，巴斯和富贵貂脚点碰撞有效，构建通过。

2026-10-03 更新：用户提供图图原素材，已复制到 assets/npcs/tutu-green-v1.png 并接入健身房 (476,280)，高度 36，绑定 Kay。水豚噜噜在舞室 (470,270)，高度 47，绑定 Suki；镜内使用背面姿态，投影与玩家镜像一致。两者均沿用现有彩蛋人物的静态出场规则，进入对应场景即可看到，不额外添加概率或角色在线限制，也不绘制名字标签。脚点参与碰撞，按脚点排序遮挡。角色绑定保存在 guestOwners 中。

噜噜使用内置 imagegen 生成透明六姿态图集 assets/npcs/lulu-v1.png：正面、背面、右侧、右侧迈步、正面坐姿、背面坐姿。现阶段出场使用正面，镜像使用背面，其余姿态保留用于后续互动。图图沿用原绿幕处理，噜噜保留原生透明通道。

浏览器检查两个场景对应人物、场景切换隔离与人物脚点碰撞，无 JavaScript 异常。截图 output/playwright/lulu-dance-v1.png、tutu-gym-v1.png。构建通过；未添加装饰性标识或通用应用外壳。

噜噜最终提示词：

Use case stylized-concept. Create a game-ready six-pose pixel sprite sheet of capybara Lulu. Image1 is character identity reference: round yellow capybara with sleepy half-closed eyes, huge orange muzzle, tiny ears, an orange fruit with green stem on its head, orange shorts, short chunky arms and legs. Image2 is pixel style AND sheet layout reference ONLY (white ferret): match its crisp block pixel clusters, dark thin pixel outline, compact chibi anatomy, limited colors, subtle shading. Lulu must remain clearly a yellow capybara, no hat, no ferret features. Six separate full-body poses in one horizontal row, centered in six equal-width cells, same scale, feet on same baseline: front standing, back standing, right-facing standing, right-facing walking step with opposing arms and legs, front seated, back seated. Leave clear margins between sprites, no overlap, no clipping. Wide sheet 16:9 like reference, all sprite feet around 68% image height and heads around 33%. Actual transparent background, no green background, no ground shadows, no text, no labels, no props except orange atop head. Hard stepped pixel edges, no smooth illustration, no 3D rendering.
