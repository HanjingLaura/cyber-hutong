# Ani 与 Sid 的办公彩蛋

2026-10-03。参考用户两张 Ani 图片，用内置 imagegen 生成透明全身像素图集 assets/npcs/ani-v1.png，六个姿态为正面、背面、右侧、右侧迈步、正面坐姿、背面坐姿。保留粉发、蓝色挑染、暖肤色、紫色眼睛、终端发夹与白色服装，统一人物显示高度 61.44。当前出场使用正面或背面，其他姿态保留。

src/ani-guest.ts 管理出场：Sid 在胡同坐到有效工位即出现，不随机抽概率；起身、离开胡同或离线后隐藏。多人适配器同时支持本地 Sid 与收到的远端 Sid 状态。初次出现选择工位旁的通道空位，避开本地玩家；脚点参与碰撞，并允许已经重叠的玩家走出。切换文化墙 / 对面视角时共用房间投影与朝向规则，背面素材同步切换。场景内不绘制名字标签或额外标识。

验证：浏览器使用临时角色状态与位置夹具，没有注册或占用正式账号。本地真实 E 坐到 L1 触发 Ani，V 切视角使用背面，Esc 起身后消失；注入远端 Sid 在 L1 工作触发，改为健身房后消失。无浏览器 JavaScript 异常。截图 output/playwright/ani-sid-work-v1.png 与 ani-sid-reverse-v1.png，构建通过。未增加通用应用外壳或装饰性品牌元素。

最终生成提示词：

Use case stylized-concept. Game-ready pixel character sprite sheet Ani. Image1 face design reference, image2 full-body appearance reference. Create six full-body chibi game sprites in one horizontal row in six equal cells, compact proportions like a classic cozy 2.5D pixel game, thin dark stepped pixel outlines, limited palette, crisp block clusters with restrained volume shading. Ani is a young adult female fantasy companion with warm tan skin, coral pink voluminous long ponytail, vivid light blue face-framing streaks, bright purple eyes, tiny navy terminal-shaped hair clip, flowing white asymmetrical Grecian-inspired modest dress with white shoulder strap, silver necklace and white sandals. Preserve hairstyle and colors across every angle, no lettering or logos. Six poses: front standing, back standing, right-facing standing, right-facing walking step, front seated, back seated. Same scale in all poses, separate cells with generous gutters, feet common baseline around 72% of height. Wide 16:9 sheet. True transparent background, no shadows, no scenery, no typography, no anime smooth lines, no photorealism, no cropped parts. No pet on shoulder for this sprite sheet to maintain readable silhouette at small game scale.
