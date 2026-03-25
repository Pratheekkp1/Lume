# Plan: Auto-Save Notes (Task 1.1)

## Summary
Replace manual Save buttons on notes fields with debounced auto-save (500ms). Show "Saved" indicator. Applies to AlbumView, SoundView, PostView.

## Files
- **NEW** `src/hooks/useDebouncedSave.js` — shared hook
- `src/pages/AlbumView.jsx` — lines 172-178 (saveNotes), 628-634 (Save button)
- `src/pages/SoundView.jsx` — lines 241-247 (saveNotes), 550-556 (Save button)
- `src/pages/PostView.jsx` — lines 785-809 (DescriptionEditor, already saves on blur, add debounce while typing)

## Steps
1. Create useDebouncedSave hook
2. Update AlbumView
3. Update SoundView
4. Update PostView DescriptionEditor

## Edge Cases
- Flush pending save when switching items or closing panel
- Save function must capture correct entity ID via useCallback
