import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getRecentOpens } from '../lib/recentOpens'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [storageBytes, setStorageBytes] = useState({ photos: 0, audio: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const recentOpens = getRecentOpens().slice(0, 10)
    const collectionIds = recentOpens.filter(r => r.type === 'collection').map(r => r.id)
    const postIds       = recentOpens.filter(r => r.type === 'post').map(r => r.id)
    const audioIds      = recentOpens.filter(r => r.type === 'audio').map(r => r.id)

    const queries = [
      supabase.from('collections').select('*', { count: 'exact', head: true }),
      supabase.from('photos').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('audio_projects').select('*', { count: 'exact', head: true }),
      supabase.from('audio_tracks').select('*', { count: 'exact', head: true }),
      supabase.from('photos').select('file_size'),
      supabase.from('audio_tracks').select('file_size'),
    ]

    if (recentOpens.length > 0) {
      queries.push(
        collectionIds.length > 0
          ? supabase.from('collections').select('id, name, created_at, status, photos!collection_id(file_size)').in('id', collectionIds)
          : Promise.resolve({ data: [] }),
        postIds.length > 0
          ? supabase.from('posts').select('id, title, status, created_at').in('id', postIds)
          : Promise.resolve({ data: [] }),
        audioIds.length > 0
          ? supabase.from('audio_projects').select('id, name, created_at, status, audio_tracks(file_size)').in('id', audioIds)
          : Promise.resolve({ data: [] }),
      )
    } else {
      queries.push(
        supabase.from('collections').select('id, name, created_at, status, photos!collection_id(file_size)').order('created_at', { ascending: false }).limit(3),
        supabase.from('posts').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('audio_projects').select('id, name, created_at, status, audio_tracks(file_size)').order('created_at', { ascending: false }).limit(3),
      )
    }

    const [
      { count: collectionCount },
      { count: photoCount },
      { count: postCount },
      { count: audioCount },
      { count: trackCount },
      { data: photoSizes },
      { data: trackSizes },
      { data: fetchedCollections },
      { data: fetchedPosts },
      { data: fetchedAudio },
    ] = await Promise.all(queries)

    setStats({
      collections: collectionCount || 0,
      photos: photoCount || 0,
      posts: postCount || 0,
      audioProjects: audioCount || 0,
      tracks: trackCount || 0,
    })

    setStorageBytes({
      photos: (photoSizes || []).reduce((sum, r) => sum + (r.file_size || 0), 0),
      audio:  (trackSizes  || []).reduce((sum, r) => sum + (r.file_size || 0), 0),
    })

    const sumSizes = (rows) => (rows || []).reduce((s, r) => s + (r.file_size || 0), 0)
    const byId = {}

    ;(fetchedCollections || []).forEach(r => {
      byId[`collection-${r.id}`] = { ...r, type: 'collection', path: `/collections/${r.id}`, totalSize: sumSizes(r.photos) }
    })
    ;(fetchedPosts || []).forEach(r => {
      byId[`post-${r.id}`] = { ...r, type: 'post', name: r.title, path: `/posts/${r.id}` }
    })
    ;(fetchedAudio || []).forEach(r => {
      byId[`audio-${r.id}`] = { ...r, type: 'audio', path: `/audio/${r.id}`, totalSize: sumSizes(r.audio_tracks) }
    })

    let merged
    if (recentOpens.length > 0) {
      merged = recentOpens
        .map(o => byId[`${o.type}-${o.id}`])
        .filter(Boolean)
        .slice(0, 10)
    } else {
      merged = Object.values(byId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
    }

    setRecent(merged)
    setLoading(false)
  }

  const TYPE_META = {
    collection: { label: 'Collection',    icon: '◻', color: '#a8a29e' },
    post:       { label: 'Post',           icon: '▷', color: '#a8a29e' },
    audio:      { label: 'Audio Project',  icon: '♩', color: '#a8a29e' },
  }

  const totalStorage = storageBytes.photos + storageBytes.audio

  return (
    <div className="p-7 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Overview</p>
        <h1 className="font-serif text-3xl text-stone-800">Dashboard</h1>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Collections"
              icon="◻"
              primary={stats.collections}
              primaryWord="collection"
              secondary={stats.photos}
              secondaryWord="photo"
              onClick={() => navigate('/collections')}
            />
            <StatCard
              label="Posts"
              icon="▷"
              primary={stats.posts}
              primaryWord="post"
              secondary={stats.photos}
              secondaryWord="photo"
              onClick={() => navigate('/posts')}
            />
            <StatCard
              label="Music / Audio"
              icon="♩"
              primary={stats.audioProjects}
              primaryWord="project"
              secondary={stats.tracks}
              secondaryWord="track"
              onClick={() => navigate('/audio')}
            />
          </div>

          {/* Storage usage */}
          {totalStorage > 0 && (
            <div className="mb-8 bg-white border border-stone-200 rounded-xl p-5">
              <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Storage Used</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden flex">
                  {storageBytes.photos > 0 && (
                    <div
                      className="h-full bg-stone-400 transition-all"
                      style={{ width: `${(storageBytes.photos / totalStorage) * 100}%` }}
                    />
                  )}
                  {storageBytes.audio > 0 && (
                    <div
                      className="h-full bg-stone-300 transition-all"
                      style={{ width: `${(storageBytes.audio / totalStorage) * 100}%` }}
                    />
                  )}
                </div>
                <span className="text-xs text-stone-500 font-medium flex-shrink-0">{fmtBytes(totalStorage)}</span>
              </div>
              <div className="flex gap-5">
                <StorageLegend color="bg-stone-400" label="Photos" bytes={storageBytes.photos} />
                <StorageLegend color="bg-stone-300" label="Audio" bytes={storageBytes.audio} />
              </div>
            </div>
          )}

          {/* Quick shortcuts */}
          <div className="mb-8">
            <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Quick Access</p>
            <div className="grid grid-cols-3 gap-3">
              <ShortcutCard icon="◻" label="Collections" sub="Browse all collections" onClick={() => navigate('/collections')} />
              <ShortcutCard icon="▷" label="All Posts"   sub="Browse & manage content" onClick={() => navigate('/posts')} />
              <ShortcutCard icon="♩" label="All Audio"   sub="Browse audio projects"   onClick={() => navigate('/audio')} />
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Recently Opened</p>
            {recent.length === 0 ? (
              <p className="text-stone-400 text-sm">Nothing yet — open a collection or project to see it here.</p>
            ) : (
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                {recent.map((item, i) => {
                  const meta = TYPE_META[item.type]
                  if (!meta) return null
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-4 py-3 px-4 text-left hover:bg-stone-50 transition-colors group ${i !== 0 ? 'border-t border-stone-100' : ''}`}
                    >
                      <span className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-xs text-stone-400 flex-shrink-0 group-hover:bg-stone-200 transition-colors">
                        {meta.icon}
                      </span>
                      <span className="flex-1 text-sm text-stone-700 truncate">{item.name || item.title}</span>
                      {item.totalSize > 0 && (
                        <span className="text-xs text-stone-300 flex-shrink-0 hidden sm:block">{fmtBytes(item.totalSize)}</span>
                      )}
                      <span className="text-xs text-stone-300 flex-shrink-0 hidden sm:block">{meta.label}</span>
                      <span className="text-xs text-stone-300 flex-shrink-0 w-24 text-right">
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function fmtBytes(bytes) {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function StorageLegend({ color, label, bytes }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-xs text-stone-400">{label}</span>
      <span className="text-xs text-stone-300">{fmtBytes(bytes)}</span>
    </div>
  )
}

function ShortcutCard({ icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition-all group flex items-center gap-3"
    >
      <span className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-sm text-stone-400 flex-shrink-0 group-hover:bg-stone-200 transition-colors">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-700 truncate">{label}</p>
        <p className="text-xs text-stone-400 truncate">{sub}</p>
      </div>
    </button>
  )
}

function StatCard({ label, icon, primary, primaryWord, secondary, secondaryWord, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs text-stone-400">{label}</span>
        <span className="text-base text-stone-200 group-hover:text-stone-300 transition-colors">{icon}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-3xl font-light text-stone-800">{primary}</span>
        <span className="text-xs text-stone-400">{primary === 1 ? primaryWord : `${primaryWord}s`}</span>
      </div>
      <p className="text-xs text-stone-300">{secondary} {secondary === 1 ? secondaryWord : `${secondaryWord}s`}</p>
    </button>
  )
}
