# Lume Studio — Project State

**Last updated**: 2026-03-24
**Current phase**: Core features built, polish & refinement phase

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

## What's In Progress
- [ ] Route consolidation (old routes: /collections, /audio, /events -> redirected)
- [ ] Uncommitted changes in: AlbumView, Settings, SoundView, Sounds

## What's Next (Prioritized)
1. Commit and stabilize current changes
2. UI polish — consistent empty states, loading states, error states
3. Theming — koi fish + cherry blossom pixel-retro aesthetic (deferred)
4. Cover photo selection refinement for collections
5. Bulk operations polish (multi-select actions)
6. Dashboard data accuracy (ensure stats reflect real data)

## Decisions Made
| Decision | Rationale | Date |
|----------|-----------|------|
| No auth | Personal-use tool, no need for login | Initial |
| Direct Supabase queries | Simple architecture for single-user app | Initial |
| Component-level state | No need for Redux/Zustand at this scale | Initial |
| Events merged into Media | Simplified navigation, events as album metadata | 2026-03 |
| CustomEvent for cross-component updates | Lightweight, no extra dependencies | Initial |

## Open Questions
- Should we add search/filter across all content types?
- Video project section — dedicated or keep within albums?
- Export/backup strategy for Supabase data?

## Defect Log
| Issue | Root Cause | Fix | Date |
|-------|-----------|-----|------|
| (Start logging issues here) | | | |
