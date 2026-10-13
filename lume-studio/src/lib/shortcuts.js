// Single source for keyboard shortcuts: the global handler reads GOTO_KEYS,
// and both the "?" overlay and Settings › Keyboard Shortcuts render SHORTCUTS.

// Press "g" then one of these keys to jump to a page.
export const GOTO_KEYS = {
  h: { path: '/dashboard',   label: 'Home (Dashboard)' },
  p: { path: '/posts',       label: 'Posts' },
  c: { path: '/posts?view=calendar', label: 'Calendar' },
  l: { path: '/library',     label: 'Library' },
  i: { path: '/ideas',       label: 'Ideas' },
  s: { path: '/inspiration', label: 'Inspiration' },
  n: { path: '/notes',       label: 'Notes' },
  a: { path: '/analytics',   label: 'Analytics' },
  m: { path: '/campaigns',   label: 'Campaigns' },
  b: { path: '/brand',       label: 'Brand Kit' },
  t: { path: '/trash',       label: 'Trash' },
  ',': { path: '/settings',  label: 'Settings' },
}

export const SHORTCUTS = [
  { group: 'Global', items: [
    { keys: ['⌘', 'K'], label: 'Open command palette' },
    { keys: ['/'],      label: 'Focus search' },
    { keys: ['N'],      label: 'New post' },
    { keys: ['?'],      label: 'Show keyboard shortcuts' },
    { keys: ['Esc'],    label: 'Close modal / deselect' },
  ]},
  { group: 'Go to', items: Object.entries(GOTO_KEYS).map(([key, { label }]) => ({
    keys: ['G', key.toUpperCase()],
    label,
  }))},
  { group: 'Post View', items: [
    { keys: ['F'],      label: 'Toggle focus mode (hide side panel)' },
    { keys: ['Enter'],  label: 'Add activity log entry' },
  ]},
  { group: 'Album View', items: [
    { keys: ['←', '→'], label: 'Previous / next photo' },
    { keys: ['F'],      label: 'Toggle favorite (when photo open)' },
    { keys: ['Esc'],    label: 'Close photo' },
  ]},
  { group: 'Sound View', items: [
    { keys: ['Space'],        label: 'Play / pause track' },
    { keys: ['←', '→'],       label: 'Previous / next track' },
    { keys: ['⇧', '←', '→'], label: 'Seek −10s / +10s in current track' },
  ]},
]

// Single-key shortcuts must not fire while the user is typing.
export function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}
