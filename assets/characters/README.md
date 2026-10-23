# 人物素材库

每个人的 `manifest.json` 是正式运行时入口。八位成员与 Celine 各有独立目录。源图的裁切矩形、脚底、座点、握持点、referenceHeight、横向比例及偏移仍逐帧保存在清单，动作循环与帧长保存在 member。

本次迁移保持图像字节完全一致，移除动作选择已不再使用的追加帧；当前工作区等效不代表线上或人物本人已验收。provenance 不将待确认素材标为已通过。

新增动作：

1. 在对应人物目录放入候选图集，保持外观、服装、头身比例、像素画风和已有锚点标准；暂不替换正式文件。
2. 在 sources 登记尺寸、来源和 SHA256；在 frames 记录每帧 rect、foot、seat、grip、比例与镜像依据。在相应循环登记帧序和帧长。
3. 在 `members.html` 选择动作、四个方向、持物、暂停/逐帧及座具组合检查；不得只看图集缩略图。
4. 运行人物库验证、构建与相关游戏检查；记录本人/视觉验收来源和代码版本。
5. 经确认后启用正式清单。替代图集在确认无运行引用后移至项目外可恢复归档，不重新叠加版本注册表。

历史构建脚本生成的版本目录是候选/迁移来源，不是运行加载入口。`materialize-character-library.mjs` 仅用于重放本次冻结基准迁移，会覆盖同名正式文件，新增动作后不要再次运行。

旧图集以 SHA256 校验后归档于项目旁的 `cyber-hutong-character-archive-2026-10-12` 目录。历史构建脚本若需旧输入，先用 `node scripts/restore-character-source.mjs assets/characters/team/v4/sid-motion.png` 恢复所需的一张；它不修改正式清单。归档位置可用 `HUTONG_CHARACTER_ARCHIVE` 指定。旧文档中的版本路径仅供历史追溯，现有动作以本库为准。
