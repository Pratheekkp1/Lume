import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES } from '../lib/constants'
import { getProfile } from '../lib/profile'

export default function Dashboard() {
  const navigate = useNavigate()
  const [pipeline, setPipeline] = useState({})
  const [recentPosts, setRecentPosts] = useState([])
  const [upcomingPosts, setUpcomingPosts] = useState([])
  const [activity, setActivity] = useState([])
  const [libraryCounts, setLibraryCounts] = useState({ collections: 0, photos: 0, audioProjects: 0, tracks: 0 })
  const [storageBytes, setStorageBytes] = useState({ photos: 0, audio: 0 })
  const [loading, setLoading] = useState(true)

  const profile = getProfile()
  const greeting = getGreeting()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const today = new Date().toISOString().split('T')[0]

    const [
      { data: posts },
      { data: scheduled },
      { count: collectionCount },
      { count: photoCount },
      { count: audioProjectCount },
      { count: trackCount },
      { data: photoSizes },
      { data: trackSizes },
      { data: recentAlbums },
      { data: recentTracks },
    ] = await Promise.all([
      supabase.from('posts').select('id, title, type, status, platform, caption, created_at, updated_at').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('posts').select('id, title, status, platform, scheduled_date').is('deleted_at', null).gte('scheduled_date', today).order('scheduled_date', { ascending: true }).limit(10),
      supabase.from('collections').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('photos').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('audio_projects').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('audio_tracks').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('photos').select('file_size').is('deleted_at', null),
      supabase.from('audio_tracks').select('file_size').is('deleted_at', null),
      supabase.from('collections').select('id, name, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
      supabase.from('audio_tracks').select('id, name, created_at, project_id').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    ])

    // Pipeline counts
    const counts = {}
    for (const key of Object.keys(POST_STATUSES)) counts[key] = 0
    ;(posts || []).forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++ })
    setPipeline(counts)

    setRecentPosts((posts || []).slice(0, 6))
    setUpcomingPosts(scheduled || [])

    // Build activity feed from recent items across types
    const activityItems = []
    ;(posts || []).slice(0, 5).forEach(p => activityItems.push({
      type: 'post', id: p.id, name: p.title, date: p.created_at, path: `/posts/${p.id}`
    }))
    ;(recentAlbums || []).forEach(a => activityItems.push({
      type: 'album', id: a.id, name: a.name, date: a.created_at, path: `/media/${a.id}`
    }))
    ;(recentTracks || []).forEach(t => activityItems.push({
      type: 'track', id: t.id, name: t.name, date: t.created_at, path: `/sounds/${t.project_id}`
    }))
    activityItems.sort((a, b) => new Date(b.date) - new Date(a.date))
    setActivity(activityItems.slice(0, 8))

    setLibraryCounts({
      collections: collectionCount || 0,
      photos: photoCount || 0,
      audioProjects: audioProjectCount || 0,
      tracks: trackCount || 0,
    })

    setStorageBytes({
      photos: (photoSizes || []).reduce((sum, r) => sum + (r.file_size || 0), 0),
      audio:  (trackSizes || []).reduce((sum, r) => sum + (r.file_size || 0), 0),
    })

    setLoading(false)
  }

  const totalStorage = storageBytes.photos + storageBytes.audio
  const totalPosts = Object.values(pipeline).reduce((s, n) => s + n, 0)

  return (
    <div className="p-7">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Home</p>
        <h1 className="font-serif text-3xl text-stone-800">
          {greeting}{profile.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}
        </h1>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="mb-8 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/posts?create=true')}
              className="bg-teal-500 text-white text-xs font-medium px-5 py-2.5 rounded-md hover:bg-teal-600 transition-colors"
            >
              + New Post
            </button>
            <button
              onClick={() => navigate('/library')}
              className="border border-stone-200 text-stone-500 text-xs font-medium px-4 py-2.5 rounded-md hover:border-stone-300 hover:text-stone-700 transition"
            >
              Browse Library
            </button>
            <button
              onClick={() => navigate('/posts?view=calendar')}
              className="border border-stone-200 text-stone-500 text-xs font-medium px-4 py-2.5 rounded-md hover:border-stone-300 hover:text-stone-700 transition"
            >
              Calendar
            </button>
          </div>

          {/* Top row: Pipeline + Upcoming */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Content Pipeline */}
            <div className="lg:col-span-2">
              <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Content Pipeline</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(POST_STATUSES).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => navigate(`/posts?status=${key}`)}
                    className="text-left bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 hover:shadow-sm transition group"
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
              {totalPosts > 0 && (
                <div className="mt-3 h-2 bg-stone-100 rounded-full overflow-hidden flex">
                  {Object.entries(POST_STATUSES).map(([key, s]) => {
                    const pct = ((pipeline[key] || 0) / totalPosts) * 100
                    if (pct === 0) return null
                    return (
                      <div
                        key={key}
                        className="h-full transition"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                        title={`${s.label}: ${pipeline[key]}`}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Scheduled */}
            <div>
              <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Upcoming</p>
              <div className="bg-white border border-stone-200 rounded-xl p-4 min-h-[180px]">
                {upcomingPosts.length === 0 ? (
                  <p className="text-stone-400 text-sm">No scheduled posts.</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingPosts.slice(0, 5).map(post => {
                      const status = POST_STATUSES[post.status]
                      const dateStr = formatScheduledDate(post.scheduled_date)
                      return (
                        <button
                          key={post.id}
                          onClick={() => navigate(`/posts/${post.id}`)}
                          className="w-full text-left flex items-start gap-3 hover:bg-stone-50 rounded-lg p-1.5 -m-1.5 transition-colors"
                        >
                          <div className="flex-shrink-0 text-center w-10">
                            <p className="text-xs text-stone-400 leading-tight">{dateStr.month}</p>
                            <p className="text-lg font-light text-stone-700 leading-tight">{dateStr.day}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700 truncate">{post.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {status && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: status.color + '30', color: status.color }}>
                                  {status.label}
                                </span>
                              )}
                              {post.platform?.length > 0 && (
                                <span className="text-[10px] text-stone-400">{post.platform.join(', ')}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom row: Recent Activity + Library/Storage */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Recent Activity</p>
              {activity.length === 0 ? (
                <p className="text-stone-400 text-sm">No recent activity.</p>
              ) : (
                <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                  {activity.map((item, i) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-4 py-3 px-4 text-left hover:bg-stone-50 transition-colors ${i !== 0 ? 'border-t border-stone-100' : ''}`}
                    >
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs flex-shrink-0 ${
                        item.type === 'post' ? 'bg-teal-50 text-teal-600' :
                        item.type === 'album' ? 'bg-stone-100 text-stone-500' :
                        'bg-violet-50 text-violet-500'
                      }`}>
                        {item.type === 'post' ? '▷' : item.type === 'album' ? '◻' : '♪'}
                      </span>
                      <span className="flex-1 text-sm text-stone-700 truncate">{item.name}</span>
                      <span className="text-[10px] text-stone-300 flex-shrink-0 capitalize">{item.type}</span>
                      <span className="text-[10px] text-stone-300 flex-shrink-0">{timeAgo(item.date)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Library & Storage */}
            <div>
              <p className="text-xs tracking-widest uppercase text-stone-400 mb-4">Library</p>
              <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <LibraryStat label="Albums" count={libraryCounts.collections} onClick={() => navigate('/library')} />
                  <LibraryStat label="Photos" count={libraryCounts.photos} onClick={() => navigate('/library')} />
                  <LibraryStat label="Projects" count={libraryCounts.audioProjects} onClick={() => navigate('/library')} />
                  <LibraryStat label="Tracks" count={libraryCounts.tracks} onClick={() => navigate('/library')} />
                </div>

                {totalStorage > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-stone-400">Storage</span>
                      <span className="text-xs font-medium text-stone-600">{fmtBytes(totalStorage)}</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden flex mb-2">
                      {storageBytes.photos > 0 && (
                        <div
                          className="h-full bg-stone-400 transition"
                          style={{ width: `${(storageBytes.photos / totalStorage) * 100}%` }}
                        />
                      )}
                      {storageBytes.audio > 0 && (
                        <div
                          className="h-full bg-stone-300 transition"
                          style={{ width: `${(storageBytes.audio / totalStorage) * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="flex gap-4">
                      <StorageLegend color="bg-stone-400" label="Photos" bytes={storageBytes.photos} />
                      <StorageLegend color="bg-stone-300" label="Audio" bytes={storageBytes.audio} />
                    </div>
                    {totalStorage > 500 * 1024 * 1024 && (
                      <div className="mt-3 p-2 bg-coral-50 border border-coral-200 rounded-lg">
                        <p className="text-xs text-coral-700">Storage is above 500 MB. Consider reviewing old albums or unused uploads.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatScheduledDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return { month: months[d.getMonth()], day: d.getDate() }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
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
    <button onClick={onClick} className="group text-left">
      <span className="text-xl font-light text-stone-700 group-hover:text-stone-900 transition-colors">{count}</span>
      <p className="text-xs text-stone-400">{label}</p>
    </button>
  )
}
