import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getProfile, deriveInitials } from '../../lib/profile'

const TYPE_META = {
  collection: { label: 'Album', icon: '◻', pathFn: (id) => `/media/${id}` },
  photo:      { label: 'Photo', icon: '◻', pathFn: (_id, extra) => `/media/${extra}` },
  post:       { label: 'Post',  icon: '▷', pathFn: (id) => `/posts/${id}` },
  audio:      { label: 'Sound', icon: '♩', pathFn: (id) => `/sounds/${id}` },
}

export default function Topbar() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(getProfile)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function onProfileUpdate(e) { setProfile(e.detail) }
    window.addEventListener('lume-profile-updated', onProfileUpdate)
    return () => window.removeEventListener('lume-profile-updated', onProfileUpdate)
  }, [])

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(() => runSearch(q), 220)
  }, [query])

  async function runSearch(q) {
    setSearching(true)
    const like = `%${q}%`
    const [
      { data: posts },
      { data: collections },
      { data: photos },
      { data: audioProjects },
    ] = await Promise.all([
      supabase.from('posts').select('id, title').ilike('title', like).limit(4),
      supabase.from('collections').select('id, name').ilike('name', like).limit(4),
      supabase.from('photos').select('id, name, collection_id').ilike('name', like).limit(4),
      supabase.from('audio_projects').select('id, name').ilike('name', like).limit(4),
    ])

    const grouped = []

    if (posts?.length) {
      grouped.push({ groupLabel: 'Posts', items: posts.map(r => ({ type: 'post', id: r.id, name: r.title, extra: null })) })
    }
    if (collections?.length) {
      grouped.push({ groupLabel: 'Albums', items: collections.map(r => ({ type: 'collection', id: r.id, name: r.name, extra: null })) })
    }
    if (photos?.length) {
      grouped.push({ groupLabel: 'Photos', items: photos.map(r => ({ type: 'photo', id: r.id, name: r.name, extra: r.collection_id })) })
    }
    if (audioProjects?.length) {
      grouped.push({ groupLabel: 'Sounds', items: audioProjects.map(r => ({ type: 'audio', id: r.id, name: r.name, extra: null })) })
    }

    setResults(grouped)
    setOpen(true)
    setSearching(false)
  }

  function handleSelect(item) {
    const meta = TYPE_META[item.type]
    navigate(meta.pathFn(item.id, item.extra))
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const totalResults = results.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <header className="h-13 bg-stone-100 border-b border-stone-200 flex items-center px-4 gap-4 flex-shrink-0">
      <span
        className="font-serif italic text-amber-700 text-xl cursor-pointer flex-shrink-0"
        onClick={() => navigate('/dashboard')}
      >
        lume.
      </span>

      {/* Search */}
      <div className="relative flex-1 max-w-xs mx-auto" ref={containerRef}>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none">⌕</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search…"
          className="w-full bg-white border border-stone-200 rounded-md py-1.5 pl-6 pr-3 text-xs text-stone-700 placeholder-stone-400 outline-none focus:border-amber-600 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 text-xs transition-colors"
          >
            ✕
          </button>
        )}

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
            {searching ? (
              <p className="text-xs text-stone-400 px-4 py-3">Searching…</p>
            ) : totalResults === 0 ? (
              <p className="text-xs text-stone-400 px-4 py-3">No results for "{query}"</p>
            ) : (
              results.map((group) => (
                <div key={group.groupLabel}>
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 px-4 pt-3 pb-1.5">{group.groupLabel}</p>
                  {group.items.map((item) => {
                    const meta = TYPE_META[item.type]
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelect(item)}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-stone-50 transition-colors group"
                      >
                        <span className="text-stone-300 text-xs flex-shrink-0">{meta.icon}</span>
                        <span className="text-xs text-stone-700 truncate flex-1">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium cursor-pointer flex-shrink-0 transition-colors"
          style={{ backgroundColor: profile.avatarColor }}
          onClick={() => navigate('/settings')}
          title={profile.displayName || 'Profile'}
        >
          {(profile.initials || deriveInitials(profile.displayName) || '?').slice(0, 2)}
        </div>
      </div>
    </header>
  )
}
