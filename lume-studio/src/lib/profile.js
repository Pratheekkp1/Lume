const KEY = 'lume_profile'

export const AVATAR_COLORS = [
  '#92400e', // amber
  '#44403c', // stone
  '#1e3a5f', // navy
  '#115e59', // teal
  '#7f1d1d', // rose
  '#3b0764', // violet
  '#14532d', // green
  '#0c4a6e', // sky
]

const DEFAULTS = {
  displayName: '',
  initials: '',
  email: '',
  avatarColor: '#92400e',
}

export function getProfile() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveProfile(data) {
  const updated = { ...getProfile(), ...data }
  localStorage.setItem(KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('lume-profile-updated', { detail: updated }))
}

export function deriveInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
