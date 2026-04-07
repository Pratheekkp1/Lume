const KEY = 'lume_profile'

export const AVATAR_COLORS = [
  '#2a9d8f', // teal
  '#2d3748', // charcoal
  '#1a202c', // ink
  '#e76f51', // coral
  '#6b7a8d', // slate
  '#1b6960', // deep teal
  '#4a5568', // dark slate
  '#b2452e', // deep coral
]

const DEFAULTS = {
  displayName: '',
  initials: '',
  email: '',
  avatarColor: '#2a9d8f',
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
