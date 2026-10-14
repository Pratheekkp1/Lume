// Browsers word a failed dynamic import differently; these cover Chrome,
// Firefox and Safari, plus Vite's own preload error.
const PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
]

export function isStaleChunkError(error) {
  const message = String(error?.message || error || '')
  return PATTERNS.some(p => p.test(message))
}
