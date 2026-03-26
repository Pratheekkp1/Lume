# Lume Studio — Project State

**Last updated**: 2026-03-25
**Current phase**: Phase 1 COMPLETE — moving to Phase 2 (see roadmap.md)

---

## What's Built (Complete)
- [x] Dashboard with stats, recent posts, quick actions
- [x] Posts management (CRUD, status pipeline, asset uploads, linked media)
- [x] Media/Albums (CRUD, event grouping, photo grid, upload, categories)
- [x] Sounds (project CRUD, track upload, audio player with speed control)
- [x] Settings (profile, keyboard shortcuts, about)
- [x] Navigation (sidebar with recent posts, topbar)
- [x] Category system (colors, many-to-many for photos/posts/tracks)
- [x] Favorites system across all media types
- [x] Cross-linking (photos & tracks linked to posts, "used in" references)

## Phase 1 — Completed (2026-03-24 to 2026-03-25)
- [x] 1.1 Auto-save notes (debounced save on PostView, AlbumView, SoundView)
- [x] 1.2 Multi-select Type & Platform (text[] arrays in DB, toggle UI)
- [x] 1.3 Visible UI actions (three-dot menus, always-visible controls)
- [x] 1.4 Caption field on Posts (auto-saving textarea between header and tabs)
- [x] 1.5 Consistent delete confirmations (category delete dialogs)
- [x] 1.6 Consistent create modals (Name + Status + Notes on all three, plus section-specific fields)
- [x] 1.7 Auto-save status/metadata (inline status pills on AlbumView & SoundView headers)

## Phase 2 — Complete
- [x] 2.1 Kanban board view for Posts (board default, grid toggle, drag-to-change-status, localStorage preference)
- [x] 2.2 Unified Library concept (new Library.jsx, merged Media+Sounds into single page with type filters, sidebar updated, routes redirected)
- [x] 2.3 Asset reordering in PostView (drag-to-reorder with HTML5 DnD, order_index persistence)
- [x] 2.4 Improved linking UX (slide-in drawer replaces modal, search, photo thumbnails, multi-select with batch link)
- [x] 2.5 Global drag-and-drop upload
- [x] 2.6 Sidebar update

## Phase 3 — In Progress
- [x] 3.1 Multi-platform variants (post_variants table, platform tabs in PostView, per-variant caption/crop notes/asset inclusion)

## What's Next
**Phase 3 — Creator Workflow Features** (6 tasks remaining)
Next task: 3.2 Calendar/schedule view

## DB Migrations Applied
- `ALTER TABLE posts ADD COLUMN caption text`
- `ALTER TABLE posts ALTER COLUMN type TYPE text[]`
- `ALTER TABLE posts ALTER COLUMN platform TYPE text[]`
- `ALTER TABLE audio_projects ADD COLUMN description text`
- `ALTER TABLE audio_projects ADD COLUMN project_date date`
- `collections.description` already existed
- `CREATE TABLE post_variants (id uuid PK, post_id FK->posts ON DELETE CASCADE, platform text, caption text, crop_notes text, included_asset_ids jsonb, included_linked_photo_ids jsonb, included_linked_track_ids jsonb, created_at timestamptz)`

## Decisions Made
| Decision | Rationale | Date |
|----------|-----------|------|
| No auth | Personal-use tool, no need for login | Initial |
| Direct Supabase queries | Simple architecture for single-user app | Initial |
| Component-level state | No need for Redux/Zustand at this scale | Initial |
| Events merged into Media | Simplified navigation, events as album metadata | 2026-03 |
| CustomEvent for cross-component updates | Lightweight, no extra dependencies | Initial |
| Content-first restructure | App should center on projects, not storage silos | 2026-03-24 |
| Unified library (Phase 2) | Merge Media + Sounds into one browsable library | 2026-03-24 |
| Three-phase roadmap | Phase 1: usability, Phase 2: restructure, Phase 3: creator features | 2026-03-24 |
| text[] arrays for type/platform | Simpler than junction tables for multi-select on single-user app | 2026-03-24 |
| Native HTML5 DnD for kanban | No extra dependencies, sufficient for single-user app | 2026-03-25 |
| localStorage for view preference | Simple persistence without DB overhead for UI preferences | 2026-03-25 |
| "Posted" instead of "Published" | User preference for post status label | 2026-03-25 |

## Open Questions
- Export/backup strategy for Supabase data?
- Theming (deferred to after Phase 3)

## Defect Log
| Issue | Root Cause | Fix | Date |
|-------|-----------|-----|------|
| AirPod play/pause desyncs UI | AudioPlayer only tracked state via React, not native audio events | Added onPlay/onPause handlers on <audio> element | 2026-03-24 |
