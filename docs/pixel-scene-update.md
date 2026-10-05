# 像素场景更新

所有新增栅格素材均使用内置 image_gen；角色没有重新生成。

演唱会背景 assets/drafts/concert-room-v2.png；独立折叠椅 assets/drafts/concert-chair-v1.png。舞台与地面使用原图的运行时纹理区域，舞台底边固定在逻辑 y154，三排18席与中央通道独立布局，保留顶部标志，屏幕没有文字。靠近 E 坐下，E/Esc 起身。坐下背对镜头，椅背来自同一椅子原图的前景裁片。

厕所新增 assets/drafts/bathroom-depth-kit-v2.png，隔间内壁、侧墙和地面呈现纵深；两水池为一整条130×80台面，两个交互点保留；门宽58、开门宽12，马桶更新为独立水箱与盆体，尺寸与锚点见 bathroom-mvp.md。替换旧平面结构，没有重画人物。

夏威夷窗户左右立边垂直，横向边线随墙面的共同消失点收敛；卷帘使用同一墙面投影，避免独立斜率导致窗户贴歪。

POP MART使用 assets/drafts/popmart-store-v3.png，复制自用户要求参考的 C:/Users/hj120/Desktop/cyber-hutong/assets/scenes/popmart-store-1280x720.png。保留两侧立体货架、中央盒装展台、店铺原标，移除照片拼贴与重复主题标题。中央展台注册原图区域为前景层。步行区采用原项目通道多边形，并加展台碰撞。盲盒机放大图来自场景同一粉色机器区域，直接抽取，无主题或盒位选择；抽取加入原收藏存档。陈列台仍可选具体盒位。收藏只显示拥有款，必要文字保留，产品包装与机器放大为像素素材。

IP玩具角色的十格像素图生成失败，图像工具返回 moderation_blocked，类别 other，未得到具体原因。没有伪装成已生成。当前抽取结果显示像素包装与记录名称，不用商品照片或错误对应的其他玩具图冒充。原IP角色像素素材仍待补齐。

## 完整生成提示词

### concertBackgroundPrompt

Generate a 16:9 production pixel-art game concert arena background, orthographic 2.5D view from the infield audience towards the stage, logical 640x360. Reference image 1 is the exact real concert stage: preserve its distinctive angular metallic outlined emblem suspended TOP CENTER, make it recognizable in pixel art. Keep the enormous blue-violet LED stage screen with soft pink clouds and stars, REMOVE ALL Chinese lyrics and all text from screens. Stage structure, white light strips, suspended dark line-array speakers and roof trusses; late-night navy background and purple/pink concert illumination. Reference image 2 is the approved pixel game style ONLY: crisp chunky pixels, restrained flat shading, dark outlines, no antialiasing/blur. Game layout: stage entirely in upper 0..132 logical y; broad dark violet smooth infield floor below y132..350, clear horizontal playable floor, faint aisle markings; empty floor to later place THREE separate rows of interactive chairs. No chairs, no audience, no people, no foreground railing covering playable floor, no UI, no extra text or invented logos. Reserve floor x55..585 across y160..350. Keep photo's top emblem, no invented substitute. Opaque background.

### concertChairPrompt

Generate ONE production pixel-art game sprite: portable stadium infield folding chair viewed FROM BEHIND, facing UP towards an unseen concert stage. Orthographic 2.5D, slightly looking down, matching supplied pixel game reference. Seat back is broad rectangular slate blue/navy plastic with simple inset ridges, dark metal folding legs, subtle purple concert rim light. The near-facing backrest occludes a seated character's lower torso; top edge horizontal, no headrest, no arms. Clear simple silhouette 28 logical pixels wide by 42 high aspect, use chunky clean pixel blocks and dark single-pixel outline, flat 3-color shading. Show full chair, centered, no person, no floor, no ground shadow, no chair row, no text, no other views, no extra parts. TRUE transparent alpha background. Keep large clean transparent gutters. This is a reusable independent chair sprite, not a scene.

### concertLayoutEditPrompt

Edit this pixel-art concert background for game layout. Keep the stage, its exact top center angular emblem, blue-violet stars/pink clouds LED screen with NO text, trusses, side speakers and strip lights. Recompose to have the ENTIRE stage plus its floor lip fit in TOP 42% of the 16:9 frame. The bottom 58% must be empty flat dark violet audience floor, ready for THREE ROWS of independently drawn interactive chairs. In logical640x360, stage ends at y151 and playable floor runs y152..355. Do NOT draw chairs or people. This is vital: the first chair row will be at y203, character head y141, so stage can end at y151 but no stage platforms below151. Do not change top emblem design or add any words. Maintain crisp chunky pixel art, no blur, no photorealism.

### bathroomDepthPropsPrompt

Production pixel-game prop atlas, TWO equal columns, TRUE transparent alpha. Match supplied approved game bathroom warm cream/tan palette, crisp chunky pixels, dark outlines, orthographic 2.5D front view from slightly ABOVE. LEFT sprite: one EMPTY toilet cubicle structural shell, NO door and NO toilet, NO person. Width88 height152 game aspect. Substantial cream outer partition walls with visible TOP and SIDE FACES and dark grey feet; door opening width76 height126 in lower front face. Recessed warm brown tile back wall, side return walls visibly receding into interior, a small tiled floor receding inside from front threshold up to back wall. This must read as a ROOM with real depth, not a flat empty rectangle or wallpaper. Side walls thickness about8 logical pixels, inner floor about24 pixels deep; use geometric perspectival corners, contact shadows, no blur. Front opening lies at lowest edge and ready to overlay a separate door80x126. Do not bake a toilet or paper dispenser. RIGHT sprite: ONE continuous ivory stone bathroom vanity counter with EXACTLY TWO embedded white oval sinks, TWO chrome taps, ONE uninterrupted thick slab spanning BOTH basins, no seam or gap between the sinks, cabinet below with multiple flush doors, visible top surface with depth and visible RIGHT SIDE cabinet plane. Width130 height80 game aspect. Higher dimension and depth than flat elevation. Modest purple-free warm lighting, one clear contact foot/plinth. Do not add mirrors, people, text, labels, floors outside props, UI or ground shadows. Each object fully inside own equal cell with transparent gutters. Actual transparent background.

### popPixelToysPrompt

Create a transparent pixel-art game collectible sprite sheet, exactly FIVE columns by TWO rows equal cells, each sprite centered in its cell with clean transparent gutters and identical pixel density. Ten cute miniature vinyl-style figures, row-major order: Woody (cowboy hat, yellow plaid, cow-pattern vest); Buzz Lightyear (white green purple space suit); Bullseye (brown friendly toy horse); SpongeBob (yellow square sponge, white shirt, brown shorts); Patrick Star (pink starfish, green purple shorts); Sandy Cheeks (small squirrel, white diving suit); MOLLY (round pouty face, big turquoise eyes, blonde bob and red dinosaur outfit); DIMOO (pastel blue cloud-like hair, big round eyes, cream outfit); SKULLPANDA (dark bob hair, round ear-shaped hair pieces, gothic black-white outfit); LABUBU (small furry pointed-eared mischievous smiling creature, cream pink colors). Pixel-art toy figures, readable silhouettes and flat pixel shading, about24x32 logical pixels each, dark one-pixel outline. NO photorealistic product photos, no text or labels, no packaging, no pedestal, no shadows, no environment, no UI. TRUE transparent alpha. Designed to be shown magnified with nearest-neighbor scaling inside a pixel-game blind-box machine.

