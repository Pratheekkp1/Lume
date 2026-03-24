# Workflow Rules

## Session Start
1. Read the state file: `.claude/state/project-state.md`
2. Pick up where the last session left off
3. Check open questions before starting new work

## Development Flow
1. **Plan first** — Use the planner agent before writing code for any non-trivial feature
2. **Read before editing** — Always read existing code before modifying
3. **Small changes** — Prefer incremental changes over large rewrites
4. **Test after changes** — Run `npm run dev` to verify changes work

## Code Style
- Functional React components only (no class components)
- Hooks for all state management
- Tailwind CSS for styling (no CSS files, no inline styles object)
- Color palette: stone (neutral), amber (accent/active), status-specific colors
- Import order: react/libraries -> components -> lib/utils

## File Organization
```
lume-studio/src/
├── pages/          # One file per route
├── components/
│   ├── layout/     # Sidebar, Topbar
│   └── ui/         # Reusable components (uploaders, players)
├── lib/            # Supabase client, constants, utilities
└── App.jsx         # Router & layout wrapper
```

## Supabase Patterns
- Always handle errors from Supabase calls
- Use `.select()` to specify columns (don't fetch everything)
- Clean up storage files when deleting database records
- Use `Promise.all` for parallel independent queries

## Git
- Commit after completing a logical unit of work
- Descriptive commit messages focused on "why"
- Don't commit node_modules, dist, or .env files

## State File Updates
- Update `.claude/state/project-state.md` at the end of each session
- Record: what was done, what's next, any open questions
- Keep decisions log updated with rationale
