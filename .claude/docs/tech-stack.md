# Tech Stack

## Frontend
- **React 19.2.0** — UI framework (functional components, hooks only)
- **Vite 7.3.1** — Build tool & dev server
- **React Router DOM 7.13.1** — Client-side routing
- **Tailwind CSS 3.4.19** — Utility-first styling
- **react-dropzone 15.0.0** — File upload (drag & drop)

## Backend & Data
- **Supabase** — PostgreSQL database + file storage
- **Supabase JS Client 2.99.1** — Direct client queries (no REST API layer)
- No authentication — personal-use tool with anonymous public access

## Storage Buckets
- `Photos` (capital P) — Photo & video files
- `Audio` — Audio files

## Dev Tools
- ESLint with React hooks plugin
- PostCSS & Autoprefixer

## Architecture Patterns
- Component-level `useState` (no global state library)
- Custom events via `window.dispatchEvent()` for cross-component updates
- Direct Supabase queries in components (no abstraction layer)
- `Promise.all` for parallel data fetching
- Optimistic UI updates on uploads

## Database Tables
| Table | Purpose |
|-------|---------|
| `collections` | Photo/video albums (name, status, event_date, location, cover_photo_id) |
| `photos` | Individual media items (collection_id FK, status, notes, is_favorite, media_type) |
| `posts` | Content pipeline (title, type, status, platform) |
| `post_assets` | Direct uploads to posts (file_path, file_type, order_index) |
| `post_linked_photos` | Many-to-many posts <-> photos |
| `post_linked_tracks` | Many-to-many posts <-> audio_tracks |
| `audio_projects` | Sound project containers (name, status) |
| `audio_tracks` | Individual tracks (project_id FK, status, notes, is_favorite) |
| `categories` | Tagging system (type: photo/post/audio_track, color, name) |
| `photo_categories` / `post_categories` / `audio_categories` | Many-to-many joins |
| `events` | Groups albums by occasion/trip |

## Status Enums
- **Photos/Collections:** unedited -> culling -> editing -> retouching -> delivered
- **Posts:** idea -> in_progress -> ready -> published
- **Audio:** idea -> in_progress -> done
