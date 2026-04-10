# Project State

## Last Updated
2026-04-10 — Both sessions merged into main

## What Was Accomplished (Lead Session)
1. **Campaigns / Series** — full feature built
   - `src/pages/Campaigns.jsx` — list page with status filters, color-coded cards, progress bars, create/delete modal
   - `src/pages/CampaignView.jsx` — detail page with post list, add-posts modal, edit, campaign progress breakdown, remove posts
   - Route: `/campaigns` and `/campaigns/:campaignId`
   - Sidebar nav item added ("◈ Campaigns")
   - Dashboard widget: active campaigns shown as cards between Quick Actions and Pipeline

2. **Performance Metrics** — PostView side panel now has collapsible "Performance" section
   - `src/components/ui/PostMetrics.jsx` — self-contained component, fetches/saves per-platform metrics (views, likes, comments, saves, shares)
   - Manual entry per platform, shows aggregated summary

3. **Elevated Calendar** — `Posts.jsx` CalendarView enhanced
   - Platform filter pills, monthly stats bar, content gap warning, gap week amber tint

## What Was Accomplished (Support Session)

1. **Brand Kit page** (`/brand`) — `src/pages/Brand.jsx`
   - 4 tabs: Colors, Tone of Voice, Caption Blocks, Hashtags
   - Supabase tables: `brand_kit`, `hashtag_groups`

2. **Hashtag Manager** — 4th tab inside Brand Kit, named groups with platform tags, one-click copy

3. **Publishing workflow stubs** — `PublishSection` in PostView, per-platform "Coming soon" accordion with requirements checklist

4. **Goals & Cadence Tracker** — `GoalsSection` in Settings, weekly targets per platform, progress bars, streak counter

5. **Connected Accounts + Team stubs** — Settings placeholders for future OAuth and collaboration features

## All Supabase Tables Needed
Run in Supabase SQL Editor:
```sql
-- Lead session tables
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'planning',
  start_date date,
  end_date date,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE campaign_posts (
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, post_id)
);

CREATE TABLE post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  views int DEFAULT 0,
  likes int DEFAULT 0,
  comments int DEFAULT 0,
  saves int DEFAULT 0,
  shares int DEFAULT 0,
  recorded_at date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Support session tables
CREATE TABLE brand_kit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE hashtag_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text,
  hashtags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE posting_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  target_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Next Steps
1. Content repurposing tracker
2. Deeper analytics (charts over time)
3. Account system / auth / collaboration — later phase
4. Platform API integrations (YouTube, Instagram, TikTok) — final phase

## Decisions Log
- Metrics are manual entry (no API) — APIs come last per user preference
- Campaign delete is soft-delete; posts unaffected
- Calendar gap detection is per-week
- PostMetrics is standalone component to keep PostView minimal
- Publishing section and Goals tracker are UI stubs — no real API calls
