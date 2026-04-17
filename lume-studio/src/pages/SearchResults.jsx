import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, STATUSES, SOUND_STATUSES } from '../lib/constants'
import { recordSearch } from '../lib/recentSearches'

const SECTION_CONFIG = {
  posts: { label: 'Projects', icon: '▷', pathFn: (r) => `/posts/${r.id}` },
  collections: { label: 'Albums', icon: '◻', pathFn: (r) => `/media/${r.id}` },
  photos: { label: 'Photos', icon: '◻', pathFn: (r) => `/media/${r.collection_id}` },
  audioProjects: { label: 'Sound Projects', icon: '♩', pathFn: (r) => `/sounds/${r.id}` },
  audioTracks: { label: 'Tracks', icon: '♩', pathFn: (r) => `/sounds/${r.project_id}` },
  ideas: { label: 'Ideas', icon: '✦', pathFn: () => `/ideas`, nameFn: (r) => r.title },
}

export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const q = searchParams.get('q') || ''
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('all')

  useEffect(() => {
    if (q.trim()) {
      recordSearch(q.trim())
      runFullSearch(q.trim())
    } else {
      setResults(null)
    }
  }, [q])

  async function runFullSearch(query) {
    setLoading(true)
    const like = `%${query}%`

    // Search posts: title, caption, notes
    // Search collections: name, description
    // Search photos: name, notes
    // Search audio_projects: name, description
    // Search audio_tracks: name, notes
    // Also search categories by name, then find linked items

    const [posts, collections, photos, audioProjects, audioTracks, categories, ideas] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, caption, status, type, platform, created_at, post_categories(category:categories(id,name,color))')
        .is('deleted_at', null)
        .or(`title.ilike.${like},caption.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('collections')
        .select('id, name, description, status, created_at')
        .is('deleted_at', null)
        .or(`name.ilike.${like},description.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('photos')
        .select('id, name, notes, collection_id, status, created_at')
        .is('deleted_at', null)
        .or(`name.ilike.${like},notes.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('audio_projects')
        .select('id, name, description, status, created_at')
        .is('deleted_at', null)
        .or(`name.ilike.${like},description.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('audio_tracks')
        .select('id, name, notes, project_id, status, created_at')
        .is('deleted_at', null)
        .or(`name.ilike.${like},notes.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('categories')
        .select('id, name, color, type')
        .ilike('name', like)
        .limit(10),
      supabase
        .from('ideas')
        .select('id, title, notes, status')
        .or(`title.ilike.${like},notes.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // For category matches, find linked items
    const catIds = (categories.data || []).map(c => c.id)
    let catPosts = [], catPhotos = [], catTracks = []

    if (catIds.length > 0) {
      const [cpRes, cphRes, ctRes] = await Promise.all([
        supabase.from('post_categories').select('post_id').in('category_id', catIds),
        supabase.from('photo_categories').select('photo_id').in('category_id', catIds),
        supabase.from('audio_categories').select('track_id').in('category_id', catIds),
      ])

      const postIds = [...new Set((cpRes.data || []).map(r => r.post_id))]
      const photoIds = [...new Set((cphRes.data || []).map(r => r.photo_id))]
      const trackIds = [...new Set((ctRes.data || []).map(r => r.track_id))]

      const [cpData, cphData, ctData] = await Promise.all([
        postIds.length > 0
          ? supabase.from('posts').select('id, title, caption, status, type, platform, created_at, post_categories(category:categories(id,name,color))').in('id', postIds).is('deleted_at', null)
          : Promise.resolve({ data: [] }),
        photoIds.length > 0
          ? supabase.from('photos').select('id, name, notes, collection_id, status, created_at').in('id', photoIds).is('deleted_at', null)
          : Promise.resolve({ data: [] }),
        trackIds.length > 0
          ? supabase.from('audio_tracks').select('id, name, notes, project_id, status, created_at').in('id', trackIds).is('deleted_at', null)
          : Promise.resolve({ data: [] }),
      ])

      catPosts = cpData.data || []
      catPhotos = cphData.data || []
      catTracks = ctData.data || []
    }

    // Merge and deduplicate
    const mergedPosts = dedup([...(posts.data || []), ...catPosts], 'id')
    const mergedPhotos = dedup([...(photos.data || []), ...catPhotos], 'id')
    const mergedTracks = dedup([...(audioTracks.data || []), ...catTracks], 'id')

    setResults({
      posts: mergedPosts,
      collections: collections.data || [],
      photos: mergedPhotos,
      audioProjects: audioProjects.data || [],
      audioTracks: mergedTracks,
      categories: categories.data || [],
      ideas: ideas.data || [],
    })
    setLoading(false)
  }

  function dedup(arr, key) {
    const seen = new Set()
    return arr.filter(item => {
      if (seen.has(item[key])) return false
      seen.add(item[key])
      return true
    })
  }

  function getStatusBadge(status, type) {
    const map = type === 'post' ? POST_STATUSES : type === 'audio' ? SOUND_STATUSES : STATUSES
    const info = map[status]
    if (!info) return null
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
        style={{ backgroundColor: info.color }}
      >
        {info.label}
      </span>
    )
  }

  function highlight(text, query) {
    if (!text || !query) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-teal-100 text-teal-900 rounded-sm px-0.5">{part}</mark> : part
    )
  }

  const totalCount = results
    ? results.posts.length + results.collections.length + results.photos.length + results.audioProjects.length + results.audioTracks.length + (results.ideas?.length || 0)
    : 0

  const sections = results ? [
    { key: 'posts', data: results.posts },
    { key: 'collections', data: results.collections },
    { key: 'photos', data: results.photos },
    { key: 'audioProjects', data: results.audioProjects },
    { key: 'audioTracks', data: results.audioTracks },
    { key: 'ideas', data: results.ideas || [] },
  ].filter(s => s.data.length > 0) : []

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-medium text-stone-800">
          {q ? <>Search results for "<span className="text-teal-700">{q}</span>"</> : 'Search'}
        </h1>
        {results && !loading && (
          <p className="text-xs text-stone-400 mt-1">
            {totalCount} {totalCount === 1 ? 'result' : 'results'} found
            {results.categories.length > 0 && (
              <> · includes matches from {results.categories.length} {results.categories.length === 1 ? 'category' : 'categories'}</>
            )}
          </p>
        )}
      </div>

      {/* Section filter tabs */}
      {sections.length > 1 && (
        <div className="flex gap-1 mb-5 flex-wrap">
          <button
            onClick={() => setActiveSection('all')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              activeSection === 'all' ? 'bg-teal-100 text-teal-800' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            All ({totalCount})
          </button>
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                activeSection === s.key ? 'bg-teal-100 text-teal-800' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {SECTION_CONFIG[s.key].label} ({s.data.length})
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-stone-400 py-12 justify-center">
          <span className="animate-pulse">Searching…</span>
        </div>
      )}

      {/* No query */}
      {!q && !loading && (
        <p className="text-sm text-stone-400 py-12 text-center">Enter a search query to find posts, albums, photos, sounds, and more.</p>
      )}

      {/* No results */}
      {results && !loading && totalCount === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-stone-500">No results found for "{q}"</p>
          <p className="text-xs text-stone-400 mt-1">Try a different search term or check the spelling</p>
        </div>
      )}

      {/* Results */}
      {results && !loading && sections
        .filter(s => activeSection === 'all' || activeSection === s.key)
        .map(section => {
          const config = SECTION_CONFIG[section.key]
          return (
            <div key={section.key} className="mb-6">
              <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span>{config.icon}</span>
                {config.label}
                <span className="text-stone-300">({section.data.length})</span>
              </h2>
              <div className="space-y-1">
                {section.data.map(item => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    section={section.key}
                    config={config}
                    query={q}
                    highlight={highlight}
                    getStatusBadge={getStatusBadge}
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          )
        })
      }
    </div>
  )
}

function ResultRow({ item, section, config, query, highlight, getStatusBadge, navigate }) {
  const name = item.title || item.name
  const subtitle = item.caption || item.description || item.notes || null
  const statusType = section === 'posts' ? 'post' : (section === 'audioProjects' || section === 'audioTracks') ? 'audio' : 'media'
  const categories = item.post_categories?.map(pc => pc.category).filter(Boolean) || []

  return (
    <button
      onClick={() => navigate(config.pathFn(item))}
      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-stone-50 transition-colors group"
    >
      <span className="text-stone-300 text-sm mt-0.5 flex-shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-800 group-hover:text-teal-700 transition-colors truncate">
            {highlight(name, query)}
          </span>
          {item.status && getStatusBadge(item.status, statusType)}
          {categories.map(cat => (
            <span key={cat.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: cat.color }}>
              {cat.name}
            </span>
          ))}
        </div>
        {subtitle && (
          <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">
            {highlight(subtitle, query)}
          </p>
        )}
      </div>
      <span className="text-[10px] text-stone-300 mt-1 flex-shrink-0">
        {new Date(item.created_at).toLocaleDateString()}
      </span>
    </button>
  )
}
