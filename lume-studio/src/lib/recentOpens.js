const KEY = 'lume_recent_opens'

export function recordOpen(type, id) {
  const existing = JSON.parse(localStorage.getItem(KEY) || '[]')
  const filtered = existing.filter(item => !(item.type === type && item.id === id))
  const updated = [{ type, id, openedAt: new Date().toISOString() }, ...filtered].slice(0, 30)
  localStorage.setItem(KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('lume-recents-updated'))
}

export function getRecentOpens() {
  return JSON.parse(localStorage.getItem(KEY) || '[]')
}
