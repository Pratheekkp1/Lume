// First path segment → page name shown in the browser tab / app switcher.
const TITLES = {
  dashboard: 'Dashboard',
  posts: 'Posts',
  library: 'Library',
  media: 'Album',
  sounds: 'Sound project',
  search: 'Search',
  brand: 'Brand Kit',
  analytics: 'Analytics',
  inspiration: 'Inspiration',
  settings: 'Settings',
  campaigns: 'Campaigns',
  ideas: 'Ideas',
  notes: 'Notes',
  trash: 'Trash',
}

export function titleForPath(pathname, search = '') {
  const [first, second] = pathname.split('/').filter(Boolean)
  let name = TITLES[first]
  if (first === 'posts' && second) name = 'Post'
  if (first === 'campaigns' && second) name = 'Campaign'
  if (first === 'posts' && !second && new URLSearchParams(search).get('view') === 'calendar') name = 'Calendar'
  return name ? `${name} · Lume` : 'Lume Studio'
}
