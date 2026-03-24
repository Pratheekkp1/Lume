# Common Mistakes to Avoid

## Supabase
- **Wrong bucket name**: Photos bucket is capital "Photos", Audio is capital "Audio"
- **Missing storage cleanup**: When deleting a photo/track record, MUST also delete from storage bucket
- **Forgetting junction tables**: Deleting a photo? Also delete from `photo_categories` and `post_linked_photos`
- **Not checking for errors**: Always destructure `{ data, error }` and handle error case

## React
- **Missing useEffect cleanup**: If you add an event listener or interval, return a cleanup function
- **Stale closures**: When using state in callbacks passed to event listeners, use refs or re-register
- **Infinite re-render loops**: Don't set state unconditionally inside useEffect without proper deps

## Routing
- **Old route names**: The app migrated from `/collections` -> `/media`, `/audio` -> `/sounds`, `/events` -> removed. Redirects exist in App.jsx but don't create new links to old routes
- **Parameter naming**: Albums use `:albumId`, sound projects use `:projectId`, posts use `:postId`

## Styling
- **Don't mix styling approaches**: Use Tailwind classes only, not inline styles or CSS modules
- **Color consistency**: Always use the status color functions from constants.js, don't hardcode colors for statuses

## State Management
- **Cross-component communication**: Use `window.dispatchEvent(new CustomEvent(...))` pattern that's already established, don't introduce a new pattern
- **Local storage**: Profile data is in localStorage via `lib/profile.js` — don't duplicate this

## File Uploads
- **Duplicate detection**: Check if file already exists before uploading (by name)
- **File path format**: Storage paths follow `{parentId}/{filename}` pattern
- **Accepted types**: Photos accept image/* and video/*, Audio accepts audio/*
