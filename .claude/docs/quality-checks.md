# Quality Checks

## Before Submitting Code
- [ ] No hardcoded values that should be constants
- [ ] Supabase errors are handled (check for `error` in response)
- [ ] Storage cleanup on delete (remove files from bucket when deleting DB records)
- [ ] No unused imports or variables
- [ ] Loading states shown during async operations
- [ ] Empty states handled (what does the user see with no data?)

## React-Specific
- [ ] useEffect dependencies are correct (no missing deps, no infinite loops)
- [ ] Event listeners are cleaned up in useEffect return
- [ ] Keys on mapped elements are stable and unique (not array index)
- [ ] State updates don't cause unnecessary re-renders

## UI/UX
- [ ] Consistent color palette (stone for neutral, amber for accent)
- [ ] Status badges use correct colors from constants
- [ ] Clickable elements have hover states
- [ ] Forms have proper validation before submit
- [ ] Destructive actions (delete) have confirmation dialogs

## Data Integrity
- [ ] Foreign key relationships maintained on delete (cascade or cleanup)
- [ ] Many-to-many junction records cleaned up when parent is deleted
- [ ] File paths in storage match what's stored in DB
- [ ] Duplicate detection before creating records

## Performance
- [ ] Large lists are not fetching unnecessary data
- [ ] Images use appropriate sizing
- [ ] Parallel queries where independent (Promise.all)
- [ ] No N+1 query patterns (use joins/nested selects)
