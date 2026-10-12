# Lume Studio

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

**Quality of life**
- ⌘K command palette, global search, toast notifications, optimistic UI on uploads

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 7, React Router 7, Tailwind CSS |
| Backend | Supabase (PostgreSQL + Storage), queried directly with supabase-js |
| Uploads | react-dropzone, Supabase Storage buckets |
| Hosting | Vercel (SPA rewrites for client-side routing) |

## Data model

24 PostgreSQL tables. The core relationships:

- `collections` 1─* `photos` and `audio_projects` 1─* `audio_tracks`
- `posts` *─* `photos` (via `post_linked_photos`) and *─* `audio_tracks` (via `post_linked_tracks`)
- `posts` 1─* `post_assets`, `post_variants`, `post_metrics`
- `campaigns` *─* `posts` (via `campaign_posts`)

Supporting tables: `brand_kit`, `hashtag_groups`, `content_pillars`, `post_templates`, `posting_goals`, `ideas`, `inspiration`, `events`, and category tables.

## Running locally

```bash
cd lume-studio
npm install
echo "VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=..." > .env.local
npm run dev
```

You'll need a Supabase project with the tables above and two storage buckets, `Photos` and `Audio`.
