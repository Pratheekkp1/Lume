# Session Wrap-Up Procedure

When the user says "wrap up", "save state", or "running low":

## Steps (do all of this fast, minimal output)
1. Update `.claude/state/project-state.md` with:
   - What was accomplished this session
   - What's in progress / incomplete
   - Any open questions or blockers
   - Update the decisions log if any were made
   - Log any defects found
2. Stage and commit all changes to git with a descriptive message
3. Output this starter prompt for next session:

```
Read .claude/state/project-state.md and pick up where we left off. Compact the conversation first if it's long.
```
