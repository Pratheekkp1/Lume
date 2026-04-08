# Lume Studio — Product Roadmap & Vision

**Last updated**: 2026-04-08

---

## Mission

Lume Studio is a creative content management platform that helps creators **collect, organize, edit, and publish content** across platforms without sacrificing quality. The app should be organized around the **creative workflow** — not file storage. Creators think in terms of content they're making, not folders they're filing into.

## Design Principles

1. **Content-first, not storage-first** — Projects/Posts are the center of everything. Media and audio are the library that feeds into them.
2. **Zero friction** — Auto-save, drag-and-drop, no unnecessary modals. Every action should feel instant.
3. **Nothing hidden** — Features should be discoverable without hovering or hunting. If it exists, the user should be able to find it.
4. **Consistency** — Same patterns everywhere. If notes auto-save in one place, they auto-save in all places.
5. **Pipeline-driven** — Status workflows (idea → published) should be visual and central, not just filter pills.

---

## Current State

All three phases complete. App is a full creator workflow tool: plan, collect, assemble, write, schedule, and track content across platforms. Codebase is clean with no dead routes or unused files.

---

## Phase 1 — Usability Fixes (No Restructuring)

| # | Task | Description | Status |
|---|------|-------------|--------|
| 1.1 | Auto-save notes | Replace all manual Save buttons on notes fields with debounced auto-save (500ms). | done (2026-03-24) |
| 1.2 | Multi-select Type & Platform | Change Type and Platform fields from single-select toggles to multi-select. | done (2026-03-24) |
| 1.3 | Visible UI actions | Replace hover-only actions with always-visible controls. | done (2026-03-24) |
| 1.4 | Caption field on Posts | Add a prominent text area for the actual post copy/caption. | done (2026-03-24) |
| 1.5 | Consistent delete confirmations | Add confirmation dialog to category delete. | done (2026-03-24) |
| 1.6 | Consistent create modals | Normalize create modals: Name + Status + Notes on all three. | done (2026-03-24) |
| 1.7 | Auto-save status/metadata | Status, type, platform changes auto-save immediately on click. | done (2026-03-25) |

---

## Phase 2 — Restructure Around Content

| # | Task | Description | Status |
|---|------|-------------|--------|
| 2.1 | Kanban board view for Posts | Board view with drag-to-change-status; grid toggle; localStorage preference. | done (2026-03-25) |
| 2.2 | Unified Library concept | Combined browsing for all media with type filters. | done (2026-03-25) |
| 2.3 | Asset reordering in PostView | Drag-to-reorder for photos/videos/audio; order_index persistence. | done (2026-03-25) |
| 2.4 | Improved linking UX | Slide-in drawer replaces modal for linking assets to posts. | done (2026-03-25) |
| 2.5 | Global drag-and-drop upload | Drop files anywhere; auto-detect type; route to correct destination. | done (2026-03-25) |
| 2.6 | Sidebar update | Unified Library in nav; recent items expanded to albums/projects. | done (2026-03-25) |

---

## Phase 3 — Creator Workflow Features

| # | Task | Description | Status |
|---|------|-------------|--------|
| 3.1 | Multi-platform variants | Per-platform caption, crop notes, asset selection within a post. | done (2026-03-25) |
| 3.2 | Calendar/schedule view | Month calendar with scheduled_date; drag-to-reschedule. | done (2026-03-25) |
| 3.3 | Undo/trash system | Soft delete, 30-day trash, toast with Undo. | done (2026-03-26) |
| 3.4 | Batch operations everywhere | Multi-select + bulk actions on Posts, SoundView, PostView. | done (2026-03-28) |
| 3.5 | Templates | Create post from saved template (type, platform, status prefilled). | done (2026-03-28) |
| 3.6 | Enhanced search | Full-text across notes/captions/categories; recent searches; full-page results. | done (2026-04-03) |
| 3.7 | Dashboard overhaul | Upcoming posts, pipeline summary, recent activity, storage alerts. | done (2026-04-03) |

---

## Future Considerations (Not Planned Yet)

- Theming (koi fish + cherry blossom pixel-retro aesthetic)
- Team collaboration (comments, sharing, permissions)
- Platform API integrations (auto-publish to Instagram, TikTok, YouTube)
- Analytics (track post performance)
- Export/backup
- Mobile responsiveness or native app

---

## How to Use This Document

**When starting a new phase:** Read this file, confirm with the user which tasks to tackle, plan the first task, then implement.

**When a task is done:** Update the Status column to `done` with the date.

**When the user says "implement the next stage":** Find the first `not started` task. If all done, move to the next phase. Always confirm before starting.
