# Lume Studio

[![ci](https://github.com/Pratheekkp1/Lume/actions/workflows/ci.yml/badge.svg)](https://github.com/Pratheekkp1/Lume/actions/workflows/ci.yml)

**An all-in-one creative workspace for content creators.** Lume organizes photos, videos and audio, plans posts across platforms, and tracks what's working, all in one place.

I built it as a personal tool for running my own creative projects. It grew into a ~17k-line React app with 16 pages covering the whole content lifecycle: **capture → organize → plan → publish → measure**.

## Features

**Media library**
- Photo/video albums and audio projects with drag-and-drop upload anywhere in the app (global drop zone)
- Editing workflow statuses (`unedited → culling → editing → retouching → delivered`), notes and favorites; built-in audio player with playlist controls
- Soft-delete trash with restore

**Content pipeline**
- Posts move through `idea → in progress → ready → posted` across Instagram, TikTok, YouTube, X and Facebook, with linked photos, tracks and direct uploads
- **Calendar view** with platform filters, monthly stats and content-gap warnings for empty weeks
- **Campaigns / series** that group posts with progress tracking
- **Repurpose tracker** and per-platform post variants for adapting one piece of content; reusable post templates and content pillars

**Planning & brand**
- Ideas board, Inspiration board (tagging, starring, bulk actions, Markdown export) and Notes
- **Brand kit:** colors, tone of voice, reusable caption blocks and hashtag groups with one-click copy
- Weekly posting goals per platform with streak tracking

**Analytics**
- Per-post performance metrics (views, likes, comments, saves, shares) per platform
- Dashboards for monthly output, weekly cadence over 12 weeks, and platform mix (hand-built SVG charts, no chart library)

**Accounts & privacy**
- Email/password or magic-link sign-in (Supabase Auth)
- Every table has row-level security, so users only ever see their own rows. Uploads go to a per-user storage folder that only the owner can write to

**Quality of life**
- ⌘K command palette, global search, toast notifications, optimistic UI on uploads

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 7, React Router 7, Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Storage), queried directly with supabase-js and protected by row-level security |
| Uploads | react-dropzone, Supabase Storage buckets |
| Hosting | Vercel (SPA rewrites for client-side routing) |

## Data model

24 PostgreSQL tables, defined in [`supabase/schema.sql`](supabase/schema.sql). The core relationships:

- `collections` 1─* `photos` and `audio_projects` 1─* `audio_tracks`
- `posts` *─* `photos` (via `post_linked_photos`) and *─* `audio_tracks` (via `post_linked_tracks`)
- `posts` 1─* `post_assets`, `post_variants`, `post_metrics`
- `campaigns` *─* `posts` (via `campaign_posts`)

Supporting tables: `brand_kit` (a per-user key/value store for brand settings, notes and caption history), `hashtag_groups`, `content_pillars`, `post_templates`, `posting_goals`, `ideas`, `inspiration`, `events`, and category join tables.

**Security model.** Every table has `user_id uuid default auth.uid()` and one policy, *own rows only* (`user_id = auth.uid()` for reads and writes). Because the default fills in `user_id`, client code never sends it and can't spoof it. Storage objects live under `<user id>/…`, and only the owner can upload, replace or delete them.

## Running locally

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. It creates the tables, policies and the `Photos`/`Audio` buckets.
2. Configure and start the app:

```bash
cd lume-studio
npm install
printf "VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...\n" > .env.local
npm run dev        # sign up on the login screen
npm run lint       # ESLint with the React Compiler rules
```

## Roadmap

- Move data fetching from `useEffect` to TanStack Query (caching, request de-duplication, and clearing the remaining `set-state-in-effect` lint warnings)
- Platform API integrations to pull post metrics automatically instead of entering them by hand
