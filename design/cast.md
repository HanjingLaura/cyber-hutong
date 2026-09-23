# Cast · 8 refined-pixel chibi（多版 A/B/C）

> Q 版游戏头，抓发型/衣服。**不要写真脸**。每人 2–3 个变体，默认 idle 用 **A**。
> 真人 JPG **不入库**。对照页左栏是像素 cue，不是照片。

## 照片映射

| ID | 照片 | 合影里第几个 / 衣服发型 | 正脸 | 推荐 A | B / C |
|----|------|------------------------|------|--------|-------|
| `cast_01` | cast01-ref 证件正脸 | —（独立证件照，不在合影里点名） | 有正脸 | 薄刘海+浅发尾+炭灰西装 | 刘海更密 / 西装略浅 |
| `cast_02` | hutong-wall-seats 合影 | 朝墙长桌·中间那位（白衬衫、眼镜、手撑头、侧对镜头） | **仅合影侧/背** | 眼镜+白衬衫+低马尾 | 同发型无眼镜 / 头发放下 |
| `cast_03` | hutong-inward 合影 | 前排左二：黑 polo、短发、转向镜头（3/4 脸） | 合影 3/4 脸（非证件） | 黑 polo 短发 | 黑 T / 白衬衫男（拉开差异，合影未穿） |
| `cast_04` | hutong-inward 合影 | 前排右：黑 T、眼镜、托腮看屏幕 | **仅合影侧/背** | 黑T+眼镜 | 黑T无眼镜 / 灰西装+眼镜 |
| `cast_05` | hutong-inward 合影 | 前排最左：浅色短袖、坐着打平板，侧/背对镜头 | **仅合影侧/背** | 薄荷短袖+深发 | 白短袖 / 短发薄荷衫 |
| `cast_06` | hutong-wall-seats 合影 | 朝墙长桌·右侧那位（褐发、蓝衬衫、打电话、背影） | **仅合影侧/背** | 褐长发+浅蓝衫 | 红白横条（变体，合影未穿） / 双丸子头（变体，合影看不清） |
| `cast_07` | hutong-inward 合影 | 后排靠绿墙 / ttc 字：深衣深发，只看见背或很小的侧影 | **仅合影侧/背** | 短发深衣 | 黑毛衣浅蓝领 / 双丸子+深衣（猜测） |
| `cast_08` | cast08-ref 证件正脸 | —（独立证件照） | 有正脸 | 中分长直+黑毛衣 | 中分略露额 / 同发型+开衫感 |

## 还缺 Laura 补正脸

| ID | 现有线索 | 为什么缺 |
|----|----------|----------|
| `cast_02` | wall-seats 中间：白衬衫+眼镜+挽发 | 只有 3/4 侧，不是证件正脸 |
| `cast_03` | inward 左二：黑 polo 短发看镜头 | 有 3/4 脸，仍缺证件正脸 |
| `cast_04` | inward 右：黑 T + 眼镜托腮 | 仅侧/3/4 |
| `cast_05` | inward 最左：薄荷短袖打平板 | 仅侧/背 |
| `cast_06` | wall-seats 右：褐发蓝衫打电话 | 仅背影。B 红白条 / C 丸子是拉开差异，合影未确认 |
| `cast_07` | inward 后排绿墙边深衣 | 只看见远/背。C 丸子是猜测 |

合影里**没有**清楚的「白衬衫男」正脸；`cast_03` C 是拉开差异的白衬衫变体，已标明合影未穿。
合影里**没有**确认的双丸子头；只作为 `cast_06` C / `cast_07` C 的猜测剪影。

## Asset paths

```
public/assets/characters/cast_XX/idle_front.png          # 推荐 A
public/assets/characters/cast_XX/variant_A.png
public/assets/characters/cast_XX/variant_B.png
public/assets/characters/cast_XX/variant_C.png
public/preview/cast_sheet.png
public/preview/cast_variants_sheet.png
public/preview/cast_photo_map.png
```

真人照片只放本地 `uploads/`，**不提交进仓库**。
