# DESIGN.md — 赛博胡同

> Synthesized for this project from [impeccable](https://github.com/pbakaus/impeccable) anti-patterns + craft guidance, and DESIGN.md patterns from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (Nintendo 2001 console chrome, VoltAgent signal-accent dark canvas, PlayStation gaming channel clarity). Not a clone of any brand — a dusk alley CRT for an eight-person pixel office.

## 1. Visual Theme & Atmosphere

**Dusk alley CRT.** The game canvas is the world; chrome is hardware bolted onto it — hard edges, offset drops, lantern amber as the only warm signal, moss-ink panels that feel like tiled hutong walls at 9pm. Density is utilitarian: HUD stays thin so pixels stay readable. Joy comes from machine panels (vending, fridge, blind box) that look like physical cabinets, not SaaS cards.

Mood keywords: pixel office, dusk moss, lantern signal, console faceplate, literary Chinese display.

## 2. Color Palette & Roles

| Token | Hex | Role |
|-------|-----|------|
| `lantern` | `#E2C56A` | Primary signal — CTA, pressed nav, focus ring |
| `lantern-hot` | `#F0D98A` | Hover / active lift on signal |
| `moss-ink` | `#15231D` | Deepest canvas / HUD glass |
| `moss` | `#1E2C26` | Panel body |
| `moss-mid` | `#2A3931` | Raised chrome, buttons |
| `tile` | `#3A4A40` | Borders, kbd bottoms |
| `paper` | `#F3EBD4` | Primary text on dark |
| `paper-soft` | `#C9D0B8` | Secondary text (tinted, never pure gray) |
| `cream` | `#EDF0E6` | Login wall / light machine face |
| `ink` | `#23372F` | Text on cream |
| `vermilion` | `#B44A32` | Errors / destructive only |
| `glass` | `#15231DCC` | Translucent HUD |

Never use pure `#000` / `#111` / neutral gray text. Always tint greens or ambers. No purple, no indigo glow, no neon bloom.

## 3. Typography Rules

| Role | Family | Notes |
|------|--------|-------|
| Brand / display | `ZCOOL QingKe HuangYou` | Hero wordmark only; large tracking |
| UI / body | `IBM Plex Sans` + `Noto Sans SC` | Readable bilingual UI |
| Mono / machine | `IBM Plex Mono` | HUD labels, kbd, scores, scene tags |

Hierarchy: brand ≫ section title ≫ body ≫ micro. Do not let a generic headline overpower 「赛博胡同」.

## 4. Component Stylings

- **Buttons:** 0 radius, 2px border, hard `3px 3px 0` drop in ink. Primary fills lantern on moss-ink text. Ghost buttons are moss-mid with paper text.
- **Inputs:** Cream or moss inset, 2px tile border, focus ring lantern 3px offset.
- **Panels / dialogs:** Machine plates — border + hard shadow, no nested cards. Interaction containers only.
- **HUD tools:** Underline accent bar (lantern) instead of pill chips; translucent glass.
- **Speech bubbles:** Paper cream face, moss border, tiny pixel tail.

## 5. Layout Principles

- Game stays full-bleed 16:9; overlays float as hardware, not dashboard grids.
- Login first viewport: brand, one short line, form CTA — nothing else competing.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Prefer open edges over boxed promo strips.

## 6. Depth & Elevation

1. Canvas (game)
2. Glass HUD (`glass`)
3. Machine plate (`moss` + 4px 4px 0 ink)
4. Modal machine (stronger border + dim backdrop)

No multi-layer soft shadows. No glow.

## 7. Motion

- Purposeful only: panel enter `140ms` ease-out, notice fade, pressed button translate 1–2px.
- Prefer `steps()` for pixel toys; never bounce / elastic.
- Honor `prefers-reduced-motion`.

## 8. Do's and Don'ts

**Do**
- Keep brand wordmark as the login hero.
- Tint every neutral.
- Use hard chrome and lantern sparingly.
- Let machine metaphors (shelf, pickup slot, CRT) drive special dialogs.

**Don't**
- Inter / Roboto / Arial / system-ui as the face of the product.
- Purple-to-indigo gradients, glow, rounded-full pills.
- Gray text on colored backgrounds.
- Cards nested in cards; decorative stat strips in the first viewport.
- Bounce easing.

## 9. Agent Prompt Guide

Rebuild or polish UI as **dusk alley CRT for 赛博胡同**: moss-ink glass, lantern amber signal, ZCOOL QingKe HuangYou brand, IBM Plex + Noto Sans SC UI, hard 0-radius machine plates, pixel-friendly motion. Reference tokens in `src/tokens.css`.
