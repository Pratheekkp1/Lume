const KEY = 'lume_recent_searches'
const MAX = 8

export function getRecentSearches() {
  return JSON.parse(localStorage.getItem(KEY) || '[]')
}

export function recordSearch(query) {
  const q = query.trim()
  if (!q) return
  const existing = getRecentSearches().filter(s => s !== q)
  const updated = [q, ...existing].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(updated))
}

export function removeRecentSearch(query) {
  const updated = getRecentSearches().filter(s => s !== query)
  localStorage.setItem(KEY, JSON.stringify(updated))
}

export function clearRecentSearches() {
  localStorage.removeItem(KEY)
}
