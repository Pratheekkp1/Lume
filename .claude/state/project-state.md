# Lume Studio — Project State

**Last updated**: 2026-03-24
**Current phase**: Phase 1 — Usability Fixes (see roadmap.md for full plan)

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

## What Was Done This Session
- [x] Task 1.4: Caption field on Posts — auto-saving caption textarea in PostView between header and tabs
- [x] Task 1.6: Consistent create modals — all three modals now offer Name + Status + Notes, plus section-specific fields (type/platform for Posts, event/date/location for Albums, date for Sounds). Normalized modal styling.
- [x] AirPod audio desync fix — added onPlay/onPause handlers to AudioPlayer <audio> element
- [x] Layout consistency — Posts/Sounds headers match Media (button placement, item count)
- [x] Task 1.2: Multi-select Type & Platform (DB migrated to text[] arrays)

## What's In Progress
- [ ] Uncommitted changes in: AlbumView, Settings, SoundView, Sounds, Posts, PostView, Media, AudioPlayer, roadmap

## What's Next
See `.claude/state/roadmap.md` for the full phased plan.
Current: **Phase 1 — Usability Fixes** (6 of 7 tasks done)
Next task: 1.7 Auto-save status/metadata (last task in Phase 1)

## DB Migrations Applied This Session
- `ALTER TABLE posts ADD COLUMN caption text`
- `ALTER TABLE posts ALTER COLUMN type TYPE text[]` (for multi-select)
- `ALTER TABLE posts ALTER COLUMN platform TYPE text[]` (for multi-select)
- `ALTER TABLE audio_projects ADD COLUMN description text`
- `ALTER TABLE audio_projects ADD COLUMN project_date date`
- Note: `collections.description` already existed

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

## Open Questions
- Export/backup strategy for Supabase data?
- Theming (deferred to after Phase 3)

## Defect Log
| Issue | Root Cause | Fix | Date |
|-------|-----------|-----|------|
| AirPod play/pause desyncs UI | AudioPlayer only tracked state via React, not native audio events | Added onPlay/onPause handlers on <audio> element | 2026-03-24 |
