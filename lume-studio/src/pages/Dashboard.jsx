import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES } from '../lib/constants'
import { getProfile } from '../lib/profile'

const CAMPAIGN_STATUSES = {
  planning: { label: 'Planning', color: '#9ca5b2' },
  active:   { label: 'Active',   color: '#2a9d8f' },
  complete: { label: 'Complete', color: '#68b5a0' },
  paused:   { label: 'Paused',   color: '#e76f51' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [pipeline, setPipeline] = useState({})
  const [recentPosts, setRecentPosts] = useState([])
  const [upcomingPosts, setUpcomingPosts] = useState([])
  const [activity, setActivity] = useState([])
  const [libraryCounts, setLibraryCounts] = useState({ collections: 0, photos: 0, audioProjects: 0, tracks: 0 })
  const [storageBytes, setStorageBytes] = useState({ photos: 0, audio: 0 })
  const [activeCampaigns, setActiveCampaigns] = useState([])
  const [weekPosts, setWeekPosts] = useState([])
  const [todayPosts, setTodayPosts] = useState([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [readyIdeasCount, setReadyIdeasCount] = useState(0)
  const [staleDraftsCount, setStaleDraftsCount] = useState(0)
  const [publishedThisMonth, setPublishedThisMonth] = useState(0)
  const [ideasCount, setIdeasCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const profile = getProfile()
  const greeting = getGreeting()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

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
      { data: campaignData },
      { data: todayScheduled },
      { data: overduePosts },
      { data: readyIdeas },
      { data: staleDrafts },
      { count: publishedCount },
      { count: allIdeasCount },
      weekResult,
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
      supabase.from('campaigns').select('id, name, status, color, start_date, end_date').is('deleted_at', null).in('status', ['planning', 'active']).order('created_at', { ascending: false }).limit(4),
      supabase.from('posts').select('id, title').is('deleted_at', null).eq('scheduled_date', today),
      supabase.from('posts').select('id').is('deleted_at', null).lt('scheduled_date', today).neq('status', 'published'),
      supabase.from('ideas').select('id').eq('status', 'ready'),
      supabase.from('posts').select('id').is('deleted_at', null).eq('status', 'in_progress').lt('updated_at', sevenDaysAgo),
      supabase.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'published').gte('updated_at', monthStart),
      supabase.from('ideas').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('id, title, status, platform, scheduled_date')
        .is('deleted_at', null)
        .gte('scheduled_date', (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0] })())
        .lte('scheduled_date', (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 6); return d.toISOString().split('T')[0] })())
        .order('scheduled_date'),
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

    setWeekPosts(weekResult.data || [])
    setActiveCampaigns(campaignData || [])
    setTodayPosts(todayScheduled || [])
    setOverdueCount((overduePosts || []).length)
    setReadyIdeasCount((readyIdeas || []).length)
    setStaleDraftsCount((staleDrafts || []).length)
    setPublishedThisMonth(publishedCount || 0)
    setIdeasCount(allIdeasCount || 0)

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
          {/* Today's Scheduled Posts Banner */}
          {todayPosts.length > 0 && (
            <div className="mb-6 flex items-center gap-3 flex-wrap bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
              <span className="text-xs font-semibold text-teal-700 flex-shrink-0">
                {todayPosts.length} post{todayPosts.length !== 1 ? 's' : ''} scheduled today
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {todayPosts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/posts/${p.id}`)}
                    className="text-[11px] font-medium bg-teal-100 hover:bg-teal-200 text-teal-800 px-2.5 py-1 rounded-full transition-colors truncate max-w-[160px]"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Week Strip */}
          <WeekStrip weekPosts={weekPosts} navigate={navigate} />

          {/* Quick Actions */}
          <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
            {/* Stat chips */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-stone-100 rounded-full px-3 py-1.5">
                <span className="text-xs font-semibold text-stone-700">{publishedThisMonth}</span>
                <span className="text-xs text-stone-400">published this month</span>
              </div>
              <div className="flex items-center gap-1.5 bg-stone-100 rounded-full px-3 py-1.5">
                <span className="text-xs font-semibold text-stone-700">{ideasCount}</span>
                <span className="text-xs text-stone-400">total ideas</span>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
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
              <button
                onClick={() => navigate('/campaigns')}
                className="border border-stone-200 text-stone-500 text-xs font-medium px-4 py-2.5 rounded-md hover:border-stone-300 hover:text-stone-700 transition"
              >
                Campaigns
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="border border-stone-200 text-stone-500 text-xs font-medium px-4 py-2.5 rounded-md hover:border-stone-300 hover:text-stone-700 transition"
              >
                Analytics
              </button>
            </div>
          </div>

          {/* Needs Attention */}
          {(overdueCount > 0 || readyIdeasCount > 0 || staleDraftsCount > 0) && (
            <div className="mb-6">
              <p className="text-xs tracking-widest uppercase text-stone-400 mb-3">Needs Attention</p>
              <div className="flex flex-wrap gap-3">
                {overdueCount > 0 && (
                  <button
                    onClick={() => navigate('/posts?status=ready')}
                    className="flex-1 min-w-[160px] text-left px-4 py-3 bg-white rounded-xl border border-stone-200 border-l-4 border-l-amber-400 hover:shadow-sm transition"
                  >
                    <p className="text-sm font-semibold text-amber-700">{overdueCount} overdue</p>
                    <p className="text-xs text-stone-400 mt-0.5">Past scheduled date, not published</p>
                  </button>
                )}
                {readyIdeasCount > 0 && (
                  <button
                    onClick={() => navigate('/ideas')}
                    className="flex-1 min-w-[160px] text-left px-4 py-3 bg-white rounded-xl border border-stone-200 border-l-4 border-l-teal-400 hover:shadow-sm transition"
                  >
                    <p className="text-sm font-semibold text-teal-700">{readyIdeasCount} idea{readyIdeasCount !== 1 ? 's' : ''} ready to promote</p>
                    <p className="text-xs text-stone-400 mt-0.5">Ideas marked as ready</p>
                  </button>
                )}
                {staleDraftsCount > 0 && (
                  <button
                    onClick={() => navigate('/posts?status=in_progress')}
                    className="flex-1 min-w-[160px] text-left px-4 py-3 bg-white rounded-xl border border-stone-200 border-l-4 border-l-stone-400 hover:shadow-sm transition"
                  >
                    <p className="text-sm font-semibold text-stone-600">{staleDraftsCount} stale draft{staleDraftsCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-stone-400 mt-0.5">In progress, not updated in 7+ days</p>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active Campaigns */}
          {activeCampaigns.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs tracking-widest uppercase text-stone-400">Active Campaigns</p>
                <button onClick={() => navigate('/campaigns')} className="text-xs text-teal-600 hover:text-teal-700 transition-colors">View all →</button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {activeCampaigns.map(c => {
                  const cs = CAMPAIGN_STATUSES[c.status] || CAMPAIGN_STATUSES.planning
                  function fmtDate(d) {
                    if (!d) return null
                    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                      className="text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition relative overflow-hidden group"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: c.color }} />
                      <div className="mt-1">
                        <p className="text-xs font-medium text-stone-700 truncate mb-1">{c.name}</p>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cs.color + '25', color: cs.color }}>
                          {cs.label}
                        </span>
                        {(c.start_date || c.end_date) && (
                          <p className="text-[10px] text-stone-400 mt-1.5">
                            {fmtDate(c.start_date)}{c.start_date && c.end_date ? ' → ' : ''}{fmtDate(c.end_date)}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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

function WeekStrip({ weekPosts, navigate }) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay())

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs tracking-widest uppercase text-stone-400">This Week</p>
        <button onClick={() => navigate('/posts?view=calendar')} className="text-xs text-teal-600 hover:text-teal-700 transition-colors">Full calendar →</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const d = new Date(sunday)
          d.setDate(sunday.getDate() + i)
          const dateStr = d.toISOString().split('T')[0]
          const dayPosts = weekPosts.filter(p => p.scheduled_date === dateStr)
          const isToday = dateStr === todayStr
          return (
            <div
              key={day}
              className={`rounded-xl p-2 border min-h-[72px] flex flex-col gap-1 ${isToday ? 'border-teal-300 bg-teal-50' : 'border-stone-200 bg-white'}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[10px] font-medium ${isToday ? 'text-teal-600' : 'text-stone-400'}`}>{day}</span>
                <span className={`text-xs ${isToday ? 'text-teal-700 font-semibold' : 'text-stone-400'}`}>{d.getDate()}</span>
              </div>
              {dayPosts.slice(0, 3).map(p => {
                const s = POST_STATUSES[p.status]
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/posts/${p.id}`)}
                    className="text-left w-full text-[10px] px-1.5 py-0.5 rounded truncate transition-colors hover:opacity-80"
                    style={{ backgroundColor: (s?.color || '#9ca5b2') + '25', color: s?.color || '#9ca5b2' }}
                    title={p.title}
                  >
                    {p.title}
                  </button>
                )
              })}
              {dayPosts.length > 3 && (
                <span className="text-[10px] text-stone-400 px-1">+{dayPosts.length - 3} more</span>
              )}
            </div>
          )
        })}
      </div>
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
