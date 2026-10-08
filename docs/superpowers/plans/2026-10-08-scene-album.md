# Scene album implementation plan

**Goal:** Add real scene photos with member-selected visibility and the three supplied initial photos.

**Architecture:** Protected Node APIs store metadata and JPEG chunks in SQLite, replicated through the existing Turso adapter. A native dialog reads the active Phaser scene and offers uploads, member checkboxes, photo viewing and owner actions.

**Tech Stack:** TypeScript, DOM, Canvas, Node HTTP, SQLite/Turso, Playwright.

**Spec:** docs/scene-album.md

## Constraints

Preserve existing olive pixel UI. No new branding or dependencies. No public static photo paths. Preserve unrelated working changes.

- [x] Write API privacy, ownership, scene, validation and persistence tests; observe missing endpoint failure.
- [x] Implement chunk storage, authenticated image/list endpoints, synchronous cloud commits and initial protected photos.
- [x] Add toolbar album dialog, image preparation, multi-select visibility, viewing and owner actions.
- [x] Run all tests/build and isolated browser checks for desktop and touch; review and document results.

## Execution ledger

Execute inline. Additional user instructions incorporated: two KTV photos public to all eight members; POP MART photo visible only to Laura, Jilly, Cora, Amber. Initial photos use role ACL because roles are fixed and may not yet be claimed; personal uploads resolve selected roles to immutable account IDs.

Ruling: use deterministic upload IDs and authoritative metadata reconciliation — review reproduced duplicate retry rows and stale failed sharing writes across instances. Full regression coverage added before acceptance. Concurrent whole-request persistence work uses savepoints; album supports nested savepoints and slash-terminated upload paths.

Verification: full server suite 129 passed; album + replica 19 passed after final path fix; TypeScript/Vite build passed; isolated real browser checks passed for multi-upload, multi-select, sharing edits/deletion, three seed ACLs, desktop, touch portrait and landscape. Second capture confirmed persistent close/header and square edges; no prohibited branding or app-shell patterns introduced. Code reviewer also verified real cloud-hook HTTP behavior across two instances. Screenshots are under output/playwright/album.
