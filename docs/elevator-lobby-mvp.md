# 电梯间

参考用户照片，从左侧朝右侧电梯墙观察：左端墙和雕塑、米色石材墙、暖灯带、浅色石材地板，两部电梯之间的垃圾桶。补上照片没拍到的第二部电梯，放在垃圾桶右侧。背景 assets/drafts/elevator-lobby-v1.png，沿用 640×360 像素世界及已认可人物。

WASD / 方向键移动，靠近对应电梯按 E 开关门，侧栏按钮也可操作。两部电梯各自独立状态和约 700ms 双扇滑门动画；过程中再按 E 可平滑反向。打开后露出有深度的原图轿厢，滑门通过门洞形状遮罩藏入两侧，保持门框和门槛固定。实际门洞坐标按生成图校准，不直接套提示词坐标。门洞内即使打开也不可通行，人物脚点边界固定在门槛前；未加入乘梯、楼层切换或人物进入轿厢。

切换场景保留门状态和动画进度，离开时暂停，返回继续。手中物品使用原有共享背包系统。页面刷新后两扇门重新关闭。

验证：构建通过，浏览器无错误和警告；实测一号开门、二号开关门，两者状态互不影响；门打开后持续向前仍被边界阻止；中途反向关门、侧栏操作、切场景暂停与返回继续。截图 elevator-closed.png、elevator-left-open.png、elevator-both-open.png、elevator-final.png 在 output/playwright/ 中。界面沿用现有导航和功能侧栏，没有新增品牌或通用 SaaS 装饰外壳。

## 背景提示词

Create an original pixel art elevator lobby for our 640x360 game, landscape 16:9. Reference 1 actual lobby for beige stone walls, warm ceiling cove lights, white marble floor, a small dark statue pedestal and a black stainless trash bin. Reference 2 existing game for pixel style. Camera from the LEFT side of the real lobby looking RIGHT toward the elevator wall, presented as the same slightly elevated frontal 2.5D room composition as game, narrow end wall at left, the RIGHT-hand elevator wall now main wall across the picture. Exactly TWO elevator entrances, side by side, bin BETWEEN them, second elevator to the RIGHT of bin. Both elevator doors fully OPEN with NO sliding door leaves visible, open rectangular vertical portals for independently animated doors to be inserted later. Each has thick brushed steel jambs, a deep visible cabin with steel rear wall, side walls and ceiling lights, threshold and correct three dimensional depth. Main rectangular openings in logical 640x360 coordinates: elevator1 approx x=190..288 y=75..222; elevator2 x=430..528 y=75..222. Headers and frames outside openings. Both same size, rectangles vertical and approximately axis aligned. Small call buttons beside each, small blank dark header display above. Trash bin around x=352 bottom y=230. Statue on left end wall around x=90 bottom y=215. Marble floor extends from y=220 to360. Clear walkable floor with subtle restrained square tile joints in perspective. No people no text no logos no extra elevators. Crisp square pixel edges, low resolution pixel look, limited palette, natural solid volume not flat paper, matches game's existing furniture pixel density.

