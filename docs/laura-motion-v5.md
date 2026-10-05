# Laura 八帧侧面周期

仅替换 Laura 的空手侧面走路和跑步。站立、坐姿、打字、持物和其他人物使用原有图集。四张完整重绘的透明图集在 `assets/characters/laura/v5/`：walk-a/b 为走路前后半周期，run-a/b 为跑步前后半周期。各半周期四张完整人物，共 16 张，不移植手臂或腿。

人物保持原来的棕色短发、黑框眼镜、白帽衫、深色裤子和白鞋。以近侧/远侧标识四肢，使用深浅裤色区分腿的身份。落脚与换腿包括承重、抬脚和经过支撑腿的过渡；跑步另有缓冲、蹬地和腾空。

走路每帧 100ms，周期 800ms；跑步每帧 75ms，周期 600ms。元数据保存固定图集比例和头部定位点；换腿不根据前伸鞋子重新居中。左侧使用完整帧镜像。

`scripts/build-laura-motion-v5.cjs` 读取透明图集的完整人物边界并写入 `assets/metadata/laura-motion-v5.json`，不修改图像。它从相邻完整人物之间的透明空隙划分帧，避免生成图集的非等宽间隔切到身体。

`scripts/verify-laura-motion-v5.cjs` 验证两种动作的 0–7 帧互不重复、左右方向选帧和加载，并用实际 TeamAvatar 输出 16 帧检查截图。入口 `/members.html?action=9&direction=1` 可直接播放右侧跑步，用帧滑块暂停逐帧核对。游戏内直接使用相同 TeamAvatar 与新图集。

使用内置 image_gen 完整重绘；完整提示记录在图集目录的 `generation-prompts.json`。
