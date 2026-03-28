import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES } from '../lib/constants'

export default function Dashboard() {
  const navigate = useNavigate()
  const [pipeline, setPipeline] = useState({})
  const [recentPosts, setRecentPosts] = useState([])
  const [libraryCounts, setLibraryCounts] = useState({ collections: 0, photos: 0, audioProjects: 0 })
  const [storageBytes, setStorageBytes] = useState({ photos: 0, audio: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [
      { data: posts },
      { count: collectionCount },
      { count: photoCount },
      { count: audioCount },
      { data: photoSizes },
      { data: trackSizes },
    ] = await Promise.all([
      supabase.from('posts').select('id, title, type, status, platform, created_at').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('collections').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('photos').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('audio_projects').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('photos').select('file_size').is('deleted_at', null),
      supabase.from('audio_tracks').select('file_size').is('deleted_at', null),
    ])

    // Pipeline counts
    const counts = {}
    for (const key of Object.keys(POST_STATUSES)) counts[key] = 0
    ;(posts || []).forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++ })
    setPipeline(counts)

    setRecentPosts((posts || []).slice(0, 8))

    setLibraryCounts({
      collections: collectionCount || 0,
      photos: photoCount || 0,
      audioProjects: audioCount || 0,
    })

    setStorageBytes({
      photos: (photoSizes || []).reduce((sum, r) => sum + (r.file_size || 0), 0),
      audio:  (trackSizes || []).reduce((sum, r) => sum + (r.file_size || 0), 0),
    })

    setLoading(false)
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
          {/* Content Pipeline */}
          <div className="mb-8">
            <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Content Pipeline</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(POST_STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => navigate(`/posts?status=${key}`)}
                  className="text-left bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-stone-400">{s.label}</span>
                  </div>
                  <span className="text-3xl font-light text-stone-800">{pipeline[key] || 0}</span>
                  <p className="text-xs text-stone-300 mt-1">{pipeline[key] === 1 ? 'post' : 'posts'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Quick Actions</p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => navigate('/posts?create=true')}
                className="bg-stone-800 text-white text-xs font-medium px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity"
              >
                + New Post
              </button>
              <button
                onClick={() => navigate('/media')}
                className="border border-stone-200 text-stone-500 text-xs font-medium px-4 py-2.5 rounded-md hover:border-stone-300 hover:text-stone-700 transition-all"
              >
                Browse Media
              </button>
              <button
                onClick={() => navigate('/sounds')}
                className="border border-stone-200 text-stone-500 text-xs font-medium px-4 py-2.5 rounded-md hover:border-stone-300 hover:text-stone-700 transition-all"
              >
                Sounds
              </button>
            </div>
          </div>

          {/* Recent Posts */}
          <div className="mb-8">
            <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Recent Posts</p>
            {recentPosts.length === 0 ? (
              <p className="text-stone-400 text-sm">No posts yet — create one to get started.</p>
            ) : (
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                {recentPosts.map((post, i) => {
                  const status = POST_STATUSES[post.status]
                  return (
                    <button
                      key={post.id}
                      onClick={() => navigate(`/posts/${post.id}`)}
                      className={`w-full flex items-center gap-4 py-3 px-4 text-left hover:bg-stone-50 transition-colors group ${i !== 0 ? 'border-t border-stone-100' : ''}`}
                    >
                      <span className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-xs text-stone-400 flex-shrink-0 group-hover:bg-stone-200 transition-colors">
                        ▷
                      </span>
                      <span className="flex-1 text-sm text-stone-700 truncate">{post.title}</span>
                      {post.type && (
                        <span className="text-xs text-stone-300 flex-shrink-0 hidden sm:block">{post.type}</span>
                      )}
                      {post.platform && (
                        <span className="text-xs text-stone-300 flex-shrink-0 hidden sm:block">{post.platform}</span>
                      )}
                      {status && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: status.color + '30', color: status.color }}
                        >
                          {status.label}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Library Summary */}
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Library</p>
            <div className="flex items-center gap-6 mb-4">
              <LibraryStat
                label="Albums"
                count={libraryCounts.collections}
                onClick={() => navigate('/media')}
              />
              <LibraryStat
                label="Photos"
                count={libraryCounts.photos}
                onClick={() => navigate('/media')}
              />
              <LibraryStat
                label="Sounds"
                count={libraryCounts.audioProjects}
                onClick={() => navigate('/sounds')}
              />
            </div>

            {totalStorage > 0 && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden flex">
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
                  <span className="text-xs text-stone-400 flex-shrink-0">{fmtBytes(totalStorage)}</span>
                </div>
                <div className="flex gap-4">
                  <StorageLegend color="bg-stone-400" label="Photos" bytes={storageBytes.photos} />
                  <StorageLegend color="bg-stone-300" label="Sounds" bytes={storageBytes.audio} />
                </div>
              </>
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

function LibraryStat({ label, count, onClick }) {
  return (
    <button onClick={onClick} className="group">
      <span className="text-xl font-light text-stone-700 group-hover:text-stone-900 transition-colors">{count}</span>
      <p className="text-xs text-stone-400">{label}</p>
    </button>
  )
}
