# Project State

## Support Session Progress

### Completed features (support session — do not conflict)

#### 1. Brand Kit page (`/brand`)
- **File created**: `lume-studio/src/pages/Brand.jsx`
- **Route added**: `App.jsx` — `/brand`
- **Nav added**: `Sidebar.jsx` — "Brand" link with ◈ icon, between Library and Recent
- **4 tabs**: Colors (swatch palettes with hex color pickers), Tone of Voice (auto-save textarea), Caption Blocks (reusable CTA snippets with copy), Hashtags (named groups with per-tag management and one-click copy)
- **Supabase tables needed**: `brand_kit` (key/value upsert), `hashtag_groups`

#### 2. Hashtag Manager
- Built as the 4th tab inside Brand Kit (`Brand.jsx`)
- Named groups with optional platform tag, space-separated bulk tag entry, one-click copy all
- Full CRUD via `hashtag_groups` table

#### 3. Publishing workflow UI stubs (PostView)
- **File modified**: `lume-studio/src/pages/PostView.jsx`
- Added `PublishSection` component (defined at bottom of file)
- Renders per-platform accordion cards when `post.platform` is non-empty
- Each card: "Connect account" button → "Coming soon" modal with explanation
- Expandable requirements checklist per platform (Instagram, TikTok, YouTube, Twitter/X, Facebook)
- No API calls, no OAuth — stubs only

#### 4. Goals & Cadence Tracker
- **File modified**: `lume-studio/src/pages/Settings.jsx`
- New `GoalsSection` — set weekly targets per platform, view this-week progress bars, streak counter
- Streak calculated by walking backwards through published posts week by week
- **Supabase table needed**: `posting_goals` (platform, frequency, target_count)

#### 5. Connected Accounts & Team stubs (Settings)
- **File modified**: `lume-studio/src/pages/Settings.jsx`
- `ConnectedAccountsSection` — polished list of all platforms, all showing "Coming soon" state with amber callout
- `TeamSection` — 4 feature cards (invite, permissions, comments, shared projects) with "Coming soon" callout, all greyed out

### Files touched by support session
- `lume-studio/src/pages/Brand.jsx` (NEW)
- `lume-studio/src/pages/PostView.jsx`
- `lume-studio/src/pages/Settings.jsx`
- `lume-studio/src/App.jsx`
- `lume-studio/src/components/layout/Sidebar.jsx`

### Files NOT touched (lead session owns)
- `Dashboard.jsx`
- `Posts.jsx`
- Any Campaigns/Series files

### Supabase tables to create (SQL)
```sql
-- Brand Kit key-value store
create table brand_kit (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Hashtag groups
create table hashtag_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text,
  hashtags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Posting goals
create table posting_goals (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  frequency text not null default 'weekly',
  target_count integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
