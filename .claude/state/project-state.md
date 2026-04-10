# Project State

## Last Updated
2026-04-10 — Session: Content creator hub — lead session

## What Was Accomplished This Session

### New Features (Lead Session)
1. **Campaigns / Series** — full feature built
   - `src/pages/Campaigns.jsx` — list page with status filters, color-coded cards, progress bars, create/delete modal
   - `src/pages/CampaignView.jsx` — detail page with post list, add-posts modal, edit, campaign progress breakdown, remove posts
   - Route: `/campaigns` and `/campaigns/:campaignId`
   - Sidebar nav item added ("◈ Campaigns")
   - Dashboard widget: active campaigns shown as cards between Quick Actions and Pipeline

2. **Performance Metrics** — PostView side panel now has collapsible "Performance" section
   - `src/components/ui/PostMetrics.jsx` — self-contained component, fetches/saves per-platform metrics (views, likes, comments, saves, shares)
   - Manual entry per platform, shows aggregated summary
   - Plugged into PostView with one import + one line

3. **Elevated Calendar** — `Posts.jsx` CalendarView enhanced
   - Platform filter pills (filter calendar by Instagram, TikTok, YouTube, etc.)
   - Monthly stats bar (scheduled count, published count, unscheduled count)
   - Content gap warning if any weeks have zero posts
   - Gap weeks highlighted with subtle amber tint

## Requires: Supabase SQL
Run this in Supabase SQL Editor before using Campaigns/Metrics:
```sql
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
```

## Support Session (Other Chat) Is Building
- Brand Kit page (`/brand`)
- Hashtag Manager
- Platform publishing workflow stubs in PostView
- Posting Goals & Cadence Tracker (Dashboard + Settings)
- Settings scaffolding for Connected Accounts + Team (placeholders)

## Files Owned by Lead Session (do not touch in support session)
- `src/pages/Campaigns.jsx`
- `src/pages/CampaignView.jsx`
- `src/components/ui/PostMetrics.jsx`
- `src/pages/Dashboard.jsx` (added campaigns widget + analytics)
- `src/pages/Posts.jsx` (calendar elevation)
- `src/App.jsx` (added campaign routes)
- `src/components/layout/Sidebar.jsx` (added Campaigns nav)

## Next Steps (Future Sessions)
1. Content repurposing tracker (mark posts as "repurposed from" another post/album, highlight unused library assets)
2. Deeper analytics — charts/graphs across time for published posts
3. Account system (auth, collaboration, mutual permissions) — later phase
4. Platform API integrations (YouTube, Instagram, TikTok) — final phase

## Decisions Log
- Metrics are manual entry (no API) — per user preference, APIs come last
- Campaign delete is soft-delete on campaigns table; posts are unaffected
- Calendar gap detection is per-week (not per-day) to avoid noise
- PostMetrics is a standalone component to keep PostView.jsx minimal
