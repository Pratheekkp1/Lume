# Lume Studio

Personal creative management platform for organizing photos, videos, audio, and content posts.

## Project Docs
@.claude/docs/tech-stack.md
@.claude/docs/workflow.md
@.claude/docs/quality-checks.md
@.claude/docs/common-mistakes.md

## Session Continuity
@.claude/state/project-state.md

## Quick Reference
- **Dev server**: `cd lume-studio && npm run dev`
- **Build**: `cd lume-studio && npm run build`
- **Lint**: `cd lume-studio && npm run lint`
- **Supabase config**: `lume-studio/src/lib/supabase.js`
- **Constants/enums**: `lume-studio/src/lib/constants.js`

## Key Rules
1. Always read the state file at session start
2. Plan before implementing non-trivial features
3. Update state file at session end
4. Follow quality checks before considering work done
5. Use sub-agents for specialized tasks (see `.claude/agents/`)
