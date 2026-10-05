# 健身房

导航进入“健身房”。使用用户指定的 cyber-hutong 健身房布局与像素素材：后墙镜子、三台跑步机、左侧哑铃架与可调凳、右侧卧推架、右下瑜伽垫、左下饮水机和储物架。原图复制为 assets/drafts/gym-room-v1.png，来源 C:/Users/hj120/Desktop/cyber-hutong/assets/scenes/office-gym-1280x720.png。640×360逻辑世界、关闭纹理平滑，原人物与其他场景一致。

## 可玩交互

- WASD / 方向键走动，靠近器械 E 使用，E / Esc 结束。
- 三台跑步机均可使用。上机后背对镜头在传送带上迈步，传送带纹理移动；F 或侧栏按钮切换4、7、10 km/h，累计时间和米数。速度按km/h换算实际米数，停止后不继续增加。
- 靠近哑铃架右侧按 E。Space / “举一次”按钮开始完整弯举，下垂→半举→肩部→半举→放下，620ms完成计一次，中途按键不叠加。使用全身动作帧，胳膊和身体在同一张图内，重量和手没有独立漂移。
- 两张训练凳前 E 坐下休息，复用已认可坐姿。卧推架目前只开放凳子休息，不是躺姿卧推训练。
- 瑜伽垫 E 进入站姿呼吸练习，4秒吸气、4秒呼气，每8秒完成一轮；尚未做拉伸体操动作。
- 饮水机 E 取一瓶水，使用共享持物接口，可以跨场景携带。
- 左下储物架 E 打开储物，最多6件；可存放手中物品、选取一件拿回。米线调料随物品保存，不覆盖已有手持物。跑步和弯举需要空手。

离开场景会结束正在进行的训练，回到使用前的安全落点。累计里程、时间、弯举次数、呼吸轮数和储物架内容在本次会话场景切换时保留；刷新页面重置。没有货币、健身属性成长或多人占用锁。

## 碰撞与动画

跑步机中心x225、320、415，前方进入点y155，站在传送带上的脚部y127。普通移动不能进入传送带，只有互动后才能上机。哑铃动作锚点123、115，避开哑铃架与可调凳。可调凳、卧推架、饮水机、储物架和卷起的瑜伽垫设置脚部碰撞范围。

场景原画含器械；互动锚点、传送带、人物与状态是独立运行时对象，当前没有重拆原画为完整器械图集。新角色弯举素材 assets/drafts/owner-gym-curl-v1.png 使用内置image_gen生成三帧透明全身图；人物尺度沿用METRICS.standing，没有修改已有日常动作。

实现：src/gym.ts；src/shop-actor.ts增加隐藏整个人物显示的接口；src/player-inventory.ts增加可替换的“水”；src/main.ts和src/style.css接入导航与储物界面。没有新增装饰品牌、圆角页面外壳或泛化AI文案。

## 验证

实机验证三台跑步机进入和退出、4/7/10调速、时间和米数递增；弯举键盘及按钮完成两次计数；切换场景后训练停止，累计值保留且不再递增；两张训练凳坐下和起身；完成一轮8秒呼吸；饮水、存放和拿回、水带到休息室。重新加载后往返胡同与健身房三次，胡同仍八席，无浏览器错误或警告。TypeScript和Vite构建通过。

## 完整弯举生成提示词

Create a transparent pixel-art CHARACTER ACTION SHEET, exactly THREE columns and ONE row, equal cell sizes and wide transparent gutters. Use the attached approved avatar as identity/style reference: use ONLY the front-facing first character, black shoulder-length bob haircut, large black rectangular glasses, dark charcoal button-up shirt, black trousers and black shoes. Preserve EXACT face, head/body proportions, palette, outfit and thick chunky pixel density; do not redesign or beautify. Each cell shows the SAME complete connected full body facing camera, head and feet at identical positions. This is a standing bicep curl with one small dark-green/charcoal dumbbell in each hand: cell1 arms down beside hips holding dumbbells; cell2 elbows at waist and forearms bent halfway up, dumbbells near lower chest; cell3 upper arms remain beside torso, elbows same waist points, forearms curl upwards, dumbbells near shoulders BELOW face. Both arms, hands, sleeves and torso connected naturally, complete body in every frame, small rounded pixel hands. Dumbbells proportional to hands, not enormous; no floating detached limbs, no backgrounds or gym equipment, no extra people, no text, no additional row, no diagrams or frame borders. Crisp low-resolution pixel-art animation poses with no antialiasing or blur. TRUE transparent alpha.
