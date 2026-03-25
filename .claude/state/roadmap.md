# Lume Studio — Product Roadmap & Vision

**Last updated**: 2026-03-24

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

Core features built: Posts, Media/Albums, Sounds, Dashboard, Settings, cross-linking, categories, search. App is functional for a single creator but organized around storage silos with inconsistent UX patterns.

---

## Phase 1 — Usability Fixes (No Restructuring)

Fix the friction in what already exists. Every change here is an improvement to existing code, no new pages or major refactoring.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 1.1 | Auto-save notes | Replace all manual Save buttons on notes fields with debounced auto-save (500ms). Show a brief "Saved" indicator. Applies to: PostView, AlbumView (lightbox), SoundView detail panel. | done (2026-03-24) |
| 1.2 | Multi-select Type & Platform | Change Type and Platform fields from single-select toggles to multi-select in both Posts create modal and PostView side panel. Update DB if needed (array or junction table). | done (2026-03-24) |
| 1.3 | Visible UI actions | Replace hover-only actions with always-visible controls: (a) Album cards — three-dot menu instead of hover edit icon, (b) AlbumView photos — "Select" toggle mode with always-visible checkboxes, (c) Post/Sound delete — three-dot menu instead of hover X. | done (2026-03-24) |
| 1.4 | Caption field on Posts | Add a prominent text area for the actual post copy/caption. This is the most important field for a creator and it's currently missing. Place it prominently in PostView (above or alongside the media tabs). | done (2026-03-24) |
| 1.5 | Consistent delete confirmations | Add confirmation dialog to category delete (currently instant). Ensure all delete flows use the same confirmation pattern. | done (2026-03-24) |
| 1.6 | Consistent create modals | Normalize create modals: all should offer Name + optional Notes + optional Status. Posts: keep type/platform. Albums: keep event/date/location. Sounds: add date field. | done (2026-03-24) |
| 1.7 | Auto-save status/metadata | Status, type, platform changes should auto-save immediately on click (verify this is already the case everywhere, fix where it's not). | not started |

**Phase 1 complete when:** All 7 tasks done. App feels consistent — no manual save buttons for notes, no hover-only features, no missing confirmations.

---

## Phase 2 — Restructure Around Content

Reorganize the app so content creation is the primary workflow. Library supports it.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 2.1 | Kanban board view for Posts | Add a toggle between Grid view (current) and Board view (kanban columns by status). Drag posts between columns to update status. Column headers show count. | not started |
| 2.2 | Unified Library concept | Create a combined browsing experience for all media. One Library page with type filters (photo, video, audio), album/project filters, category filters, date range. Albums and Sound Projects become organizational containers within the library. Keep existing Album/Sound detail pages. | not started |
| 2.3 | Asset reordering in PostView | Add drag-to-reorder for photos, videos, and audio within PostView tabs. Persist order via `order_index` field (already exists on post_assets). | not started |
| 2.4 | Improved linking UX | Replace modal-based "Link from Album" with an inline library browser panel (slide-in drawer or split view). Filter and multi-select assets without leaving PostView context. | not started |
| 2.5 | Global drag-and-drop upload | Drop files anywhere in the app. Auto-detect file type (image/video/audio). If inside a PostView, attach to current post. If on Media page, prompt for album. If on Sounds, prompt for project. | not started |
| 2.6 | Sidebar update | Update sidebar to reflect new structure: Dashboard, Projects (renamed from Posts), Library (merged Media + Sounds), Settings. Keep recent items section but expand to include recent albums/projects too. | not started |

**Phase 2 complete when:** The app feels project-centric. Creator opens a project, pulls from a unified library, arranges assets, writes caption. The workflow is: create → collect → arrange → write → publish.

---

## Phase 3 — Creator Workflow Features

Add features that make Lume genuinely useful for content creators publishing across platforms.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 3.1 | Multi-platform variants | A project can target multiple platforms. Each variant can have different caption, crop notes, or asset selection. Platform tabs within a project. | not started |
| 3.2 | Calendar/schedule view | New view showing posts on a calendar by target publish date. Add `scheduled_date` field to posts. Drag to reschedule. | not started |
| 3.3 | Undo/trash system | Soft delete with 30-day trash. Toast notification with "Undo" button on delete (5 second window). Trash page in settings or sidebar. | not started |
| 3.4 | Batch operations everywhere | Multi-select + bulk actions (status change, category assign, delete) on Posts page, Sounds page, and within PostView. Not just AlbumView. | not started |
| 3.5 | Templates | Create post from template. Templates save type, platform, category, and placeholder structure. E.g., "Instagram Reel Template" pre-fills type=Reel, platform=Instagram. | not started |
| 3.6 | Enhanced search | Search across notes, categories, captions — not just titles. Add recent searches. Full-page search results view for complex queries. | not started |
| 3.7 | Dashboard overhaul | Dashboard becomes a true home: upcoming scheduled posts, pipeline board summary, recent activity feed, storage alerts, quick actions. | not started |

**Phase 3 complete when:** Lume is a complete content creation workflow tool. A creator can plan, collect, assemble, write, schedule, and track content across platforms from one app.

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

**When starting a new phase:** Read this file, confirm with the user which tasks to tackle, use the planner agent to plan the first task, then the implementer agent to build it.

**When a task is done:** Update the Status column for that task to `done` and note the date. If the task revealed new work, add it to the appropriate phase.

**When the user says "implement the next stage":** Find the first `not started` task in the current phase. If all tasks in the current phase are `done`, move to the next phase. Always confirm with the user before starting.

**Between phases:** The user may want to tweak or adjust completed work before moving on. Respect that — don't rush to the next phase.
