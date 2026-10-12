-- Lume Studio database schema
-- Run once in the Supabase SQL editor on a fresh project.
--
-- Every table carries user_id = auth.uid() by default and row-level security
-- restricts all reads and writes to the signed-in user's own rows, so the app
-- can be deployed publicly without any user seeing another's data. Because
-- user_id defaults to auth.uid(), the client never has to send it.

create extension if not exists pgcrypto;

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Library: events, albums, photos ───────────────────────────────────────
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  date        date,
  location    text,
  created_at  timestamptz not null default now()
);

create table public.collections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null,
  description     text,
  status          text not null default 'unedited',
  event_date      date,
  location        text,
  event_id        uuid references public.events on delete set null,
  cover_photo_id  uuid,  -- FK added after photos
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.photos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  collection_id  uuid references public.collections on delete cascade,
  name           text not null,
  file_path      text not null,
  file_size      bigint,
  media_type     text not null default 'photo' check (media_type in ('photo', 'video')),
  status         text not null default 'unedited',
  notes          text,
  is_favorite    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

alter table public.collections
  add constraint collections_cover_photo_fk
  foreign key (cover_photo_id) references public.photos on delete set null;

-- ── Sound: projects and tracks ────────────────────────────────────────────
create table public.audio_projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  description   text,
  status        text not null default 'idea',
  color         text,
  project_date  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table public.audio_tracks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  project_id   uuid references public.audio_projects on delete cascade,
  name         text not null,
  file_path    text not null,
  file_size    bigint,
  status       text not null default 'unedited',
  notes        text,
  is_favorite  boolean not null default false,
  bpm          integer check (bpm is null or bpm between 1 and 400),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ── Categories (shared by posts, photos and tracks) ───────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  color       text,
  type        text not null default 'post',
  created_at  timestamptz not null default now()
);

create table public.photo_categories (
  photo_id     uuid not null references public.photos on delete cascade,
  category_id  uuid not null references public.categories on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (photo_id, category_id)
);

create table public.audio_categories (
  track_id     uuid not null references public.audio_tracks on delete cascade,
  category_id  uuid not null references public.categories on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (track_id, category_id)
);

-- ── Content pipeline ──────────────────────────────────────────────────────
create table public.content_pillars (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  description  text,
  emoji        text,
  color        text,
  created_at   timestamptz not null default now()
);

create table public.posts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users on delete cascade,
  title                    text not null,
  type                     text,
  status                   text not null default 'idea'
                             check (status in ('idea', 'in_progress', 'ready', 'published')),
  platform                 text[] not null default '{}',
  caption                  text,
  description              text,
  scheduled_date           date,
  live_url                 text,
  pillar_id                uuid references public.content_pillars on delete set null,
  repurposed_from_post_id  uuid references public.posts on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

create table public.post_categories (
  post_id      uuid not null references public.posts on delete cascade,
  category_id  uuid not null references public.categories on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (post_id, category_id)
);

create table public.post_assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  post_id      uuid not null references public.posts on delete cascade,
  file_path    text not null,
  file_type    text,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.post_linked_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  post_id      uuid not null references public.posts on delete cascade,
  photo_id     uuid not null references public.photos on delete cascade,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (post_id, photo_id)
);

create table public.post_linked_tracks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  post_id      uuid not null references public.posts on delete cascade,
  track_id     uuid not null references public.audio_tracks on delete cascade,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (post_id, track_id)
);

-- Per-platform caption / crop overrides for one post
create table public.post_variants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  post_id     uuid not null references public.posts on delete cascade,
  platform    text not null,
  caption     text,
  crop_notes  text,
  created_at  timestamptz not null default now(),
  unique (post_id, platform)
);

create table public.post_metrics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  post_id      uuid not null references public.posts on delete cascade,
  platform     text not null,
  views        integer not null default 0,
  likes        integer not null default 0,
  comments     integer not null default 0,
  saves        integer not null default 0,
  shares       integer not null default 0,
  recorded_at  date not null default current_date,
  created_at   timestamptz not null default now()
);

create table public.post_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  description  text,
  type         text,
  platform     text[] default '{}',
  caption      text,
  status       text,
  created_at   timestamptz not null default now()
);

create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  description  text,
  status       text not null default 'planning',
  start_date   date,
  end_date     date,
  color        text not null default '#6366f1',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.campaign_posts (
  campaign_id  uuid not null references public.campaigns on delete cascade,
  post_id      uuid not null references public.posts on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (campaign_id, post_id)
);

-- ── Planning & brand ──────────────────────────────────────────────────────
-- Key/value store for brand kit sections, notes and caption history
create table public.brand_kit (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);

create table public.hashtag_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  platform    text,
  hashtags    text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.posting_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  platform      text not null,
  frequency     text not null default 'weekly',
  target_count  integer not null default 1 check (target_count > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.ideas (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  title             text not null,
  notes             text,
  status            text not null default 'raw',
  priority          text,
  due_by            date,
  inspiration_url   text,
  promoted_post_id  uuid references public.posts on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.inspiration (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  type         text not null default 'note',
  title        text not null,
  body         text,
  url          text,
  tags         text[] not null default '{}',
  color        text,
  pinned       boolean not null default false,
  is_favorite  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── updated_at triggers ───────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['collections', 'photos', 'audio_projects', 'audio_tracks', 'posts',
                           'brand_kit', 'hashtag_groups', 'posting_goals', 'ideas', 'inspiration']
  loop
    execute format(
      'create trigger %1$s_touch before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ── Row-level security: every table, own rows only ────────────────────────
do $$
declare t text;
begin
  foreach t in array array['events', 'collections', 'photos', 'audio_projects', 'audio_tracks',
                           'categories', 'photo_categories', 'audio_categories', 'content_pillars',
                           'posts', 'post_categories', 'post_assets', 'post_linked_photos',
                           'post_linked_tracks', 'post_variants', 'post_metrics', 'post_templates',
                           'campaigns', 'campaign_posts', 'brand_kit', 'hashtag_groups',
                           'posting_goals', 'ideas', 'inspiration']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create index %1$s_user_idx on public.%1$I (user_id)', t);
  end loop;
end $$;

-- ── Query-path indexes ────────────────────────────────────────────────────
create index photos_collection_idx         on public.photos (collection_id) where deleted_at is null;
create index audio_tracks_project_idx      on public.audio_tracks (project_id) where deleted_at is null;
create index posts_scheduled_idx           on public.posts (user_id, scheduled_date) where deleted_at is null;
create index posts_status_idx              on public.posts (user_id, status) where deleted_at is null;
create index post_metrics_post_idx         on public.post_metrics (post_id, recorded_at);
create index post_linked_photos_post_idx   on public.post_linked_photos (post_id, order_index);
create index post_linked_tracks_post_idx   on public.post_linked_tracks (post_id, order_index);
create index post_assets_post_idx          on public.post_assets (post_id, order_index);

-- ── Storage ───────────────────────────────────────────────────────────────
-- Files live under "<user id>/..." in each bucket. Buckets are public-read so
-- <img>/<audio> tags can load files by URL (paths include a random suffix);
-- only the owner can upload, replace or delete files in their folder.
insert into storage.buckets (id, name, public)
values ('Photos', 'Photos', true), ('Audio', 'Audio', true)
on conflict (id) do nothing;

create policy "owner can upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('Photos', 'Audio') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner can update" on storage.objects for update to authenticated
  using (bucket_id in ('Photos', 'Audio') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner can delete" on storage.objects for delete to authenticated
  using (bucket_id in ('Photos', 'Audio') and (storage.foldername(name))[1] = auth.uid()::text);
