import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES } from '../lib/constants'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PLATFORM_COLORS = {
  Instagram: '#e1306c',
  TikTok:    '#010101',
  YouTube:   '#ff0000',
  'Twitter/X': '#1da1f2',
  Facebook:  '#1877f2',
}
const TYPE_COLORS = ['#2a9d8f', '#e76f51', '#f4a261', '#e9c46a', '#264653', '#6366f1']

export default function Analytics() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(12) // months

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: postData }, { data: metricData }] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, type, status, platform, scheduled_date, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('post_metrics')
        .select('post_id, platform, views, likes, comments, saves, shares, recorded_at'),
    ])
    setPosts(postData || [])
    setMetrics(metricData || [])
    setLoading(false)
  }

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading...</div>

  // ── Derived data ───────────────────────────────────────────

  const published = posts.filter(p => p.status === 'published')
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - timeRange + 1, 1)

  // Monthly published posts (last N months)
  const monthlyData = buildMonthlyData(published, timeRange)

  // Weekly cadence (last 12 weeks)
  const weeklyData = buildWeeklyData(posts, 12)

  // Platform breakdown (all posts with platforms)
  const platformCounts = {}
  posts.forEach(p => (p.platform || []).forEach(pl => {
    platformCounts[pl] = (platformCounts[pl] || 0) + 1
  }))
  const platformEntries = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])

  // Post type breakdown
  const typeCounts = {}
  posts.forEach(p => (p.type || []).forEach(t => {
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }))
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])

  // Publishing streak
  const streak = computeStreak(posts)

  // Content velocity: this month vs last month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonthCount = published.filter(p => p.scheduled_date && new Date(p.scheduled_date + 'T00:00:00') >= thisMonthStart).length
  const lastMonthCount = published.filter(p => {
    if (!p.scheduled_date) return false
    const d = new Date(p.scheduled_date + 'T00:00:00')
    return d >= lastMonthStart && d < thisMonthStart
  }).length
  const velocityDiff = thisMonthCount - lastMonthCount
  const velocityPct = lastMonthCount > 0 ? Math.round((velocityDiff / lastMonthCount) * 100) : null

  // Best posting days (published posts only)
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayCounts = Array(7).fill(0)
  published.forEach(p => {
    if (p.scheduled_date) {
      const d = new Date(p.scheduled_date + 'T00:00:00').getDay()
      dayCounts[d]++
    }
  })
  const maxDayCount = Math.max(...dayCounts, 1)

  // Status funnel
  const statusCounts = {}
  Object.keys(POST_STATUSES).forEach(k => statusCounts[k] = 0)
  posts.forEach(p => { if (statusCounts[p.status] !== undefined) statusCounts[p.status]++ })

  // Performance metrics aggregation
  const metricsByPost = {}
  metrics.forEach(m => {
    if (!metricsByPost[m.post_id]) metricsByPost[m.post_id] = { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 }
    metricsByPost[m.post_id].views    += m.views    || 0
    metricsByPost[m.post_id].likes    += m.likes    || 0
    metricsByPost[m.post_id].comments += m.comments || 0
    metricsByPost[m.post_id].saves    += m.saves    || 0
    metricsByPost[m.post_id].shares   += m.shares   || 0
  })

  const totalViews    = Object.values(metricsByPost).reduce((s, m) => s + m.views, 0)
  const totalLikes    = Object.values(metricsByPost).reduce((s, m) => s + m.likes, 0)
  const totalComments = Object.values(metricsByPost).reduce((s, m) => s + m.comments, 0)
  const totalSaves    = Object.values(metricsByPost).reduce((s, m) => s + m.saves, 0)
  const totalShares   = Object.values(metricsByPost).reduce((s, m) => s + m.shares, 0)
  const hasMetrics    = metrics.length > 0

  // Top posts by engagement
  const topPosts = posts
    .filter(p => metricsByPost[p.id])
    .map(p => ({
      ...p,
      engagement: Object.values(metricsByPost[p.id]).reduce((s, v) => s + v, 0),
      metrics: metricsByPost[p.id],
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5)

  return (
    <div className="p-7 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Insights</p>
        <h1 className="font-serif text-3xl text-stone-800">Analytics</h1>
        <p className="text-xs text-stone-400 mt-1">{posts.length} posts total · {published.length} published</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <SummaryCard label="Total Posts" value={posts.length} sub={`${published.length} published`} />
        <SummaryCard label="This Month" value={thisMonthCount} sub="published" />
        <SummaryCard
          label="vs Last Month"
          value={velocityPct !== null ? `${velocityDiff >= 0 ? '+' : ''}${velocityDiff}` : '—'}
          sub={velocityPct !== null ? `${velocityPct >= 0 ? '+' : ''}${velocityPct}%` : 'no prior data'}
          valueColor={velocityDiff > 0 ? '#2a9d8f' : velocityDiff < 0 ? '#e76f51' : '#9ca5b2'}
        />
        <SummaryCard label="Avg / Month" value={monthlyData.length ? Math.round(monthlyData.reduce((s, m) => s + m.count, 0) / monthlyData.length) : 0} sub={`over ${timeRange}mo`} />
        <SummaryCard label="Platforms" value={platformEntries.length} sub="active" />
        <SummaryCard
          label="Publishing Streak"
          value={`${streak}w`}
          sub="consecutive"
          valueColor="#f4a261"
        />
      </div>

      {/* Published over time */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs tracking-widest uppercase text-stone-400">Published Over Time</p>
          <div className="flex gap-1">
            {[3, 6, 12].map(n => (
              <button
                key={n}
                onClick={() => setTimeRange(n)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${timeRange === n ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}
              >
                {n}mo
              </button>
            ))}
          </div>
        </div>
        <BarChart data={monthlyData} color="#2a9d8f" height={140} valueKey="count" labelKey="label" />
      </div>

      {/* Weekly cadence */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-5">Weekly Cadence (last 12 weeks)</p>
        <BarChart data={weeklyData} color="#6366f1" height={100} valueKey="count" labelKey="label" />
        <p className="text-xs text-stone-400 mt-3">
          Avg {weeklyData.length ? (weeklyData.reduce((s, w) => s + w.count, 0) / weeklyData.length).toFixed(1) : 0} posts/week
        </p>
      </div>

      {/* Best posting days */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-5">Best Days to Post</p>
        {published.length === 0 ? (
          <p className="text-sm text-stone-400">No published posts with dates yet.</p>
        ) : (
          <div className="space-y-2">
            {dayLabels.map((label, i) => {
              const count = dayCounts[i]
              const isTop = count === maxDayCount && count > 0
              const barPct = (count / maxDayCount) * 100
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-stone-500 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-4 bg-stone-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: isTop ? '#2a9d8f' : '#d6d3d1',
                      }}
                    />
                  </div>
                  <span className="w-6 text-xs text-stone-500 text-right flex-shrink-0">{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Posting heatmap */}
      <PostingHeatmap published={published} />

      {/* Platform + Type row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Platform breakdown */}
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-5">By Platform</p>
          {platformEntries.length === 0 ? (
            <p className="text-sm text-stone-400">No platform data yet.</p>
          ) : (
            <HorizontalBars entries={platformEntries} colorMap={PLATFORM_COLORS} total={posts.length} />
          )}
        </div>

        {/* Post type breakdown */}
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-5">By Type</p>
          {typeEntries.length === 0 ? (
            <p className="text-sm text-stone-400">No type data yet.</p>
          ) : (
            <HorizontalBars entries={typeEntries} colorList={TYPE_COLORS} total={posts.length} />
          )}
        </div>
      </div>

      {/* Status funnel */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-5">Pipeline Funnel</p>
        <div className="flex items-end gap-3 h-24">
          {Object.entries(POST_STATUSES).map(([key, s]) => {
            const count = statusCounts[key] || 0
            const maxCount = Math.max(...Object.values(statusCounts), 1)
            const pct = (count / maxCount) * 100
            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-stone-600">{count}</span>
                <div className="w-full rounded-t-md" style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: s.color }} />
                <span className="text-[10px] text-stone-400 text-center leading-tight">{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Performance metrics */}
      {hasMetrics && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-5">Total Engagement</p>
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Views',    value: totalViews },
              { label: 'Likes',    value: totalLikes },
              { label: 'Comments', value: totalComments },
              { label: 'Saves',    value: totalSaves },
              { label: 'Shares',   value: totalShares },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-light text-stone-800">{fmtNum(value)}</p>
                <p className="text-xs text-stone-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top posts */}
      {topPosts.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-5">Top Posts by Engagement</p>
          <div className="space-y-3">
            {topPosts.map((post, i) => (
              <div key={post.id} className="flex items-center gap-4">
                <span className="text-xl font-light text-stone-300 w-6 flex-shrink-0">{i + 1}</span>
                <button
                  onClick={() => navigate(`/posts/${post.id}`)}
                  className="flex-1 text-left text-sm text-stone-700 hover:text-teal-700 transition-colors truncate"
                >
                  {post.title || 'Untitled'}
                </button>
                <div className="flex items-center gap-4 flex-shrink-0 text-xs text-stone-400">
                  <span>👁 {fmtNum(post.metrics.views)}</span>
                  <span>♥ {fmtNum(post.metrics.likes)}</span>
                  <span className="font-medium text-stone-600">{fmtNum(post.engagement)} total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasMetrics && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-center text-stone-400">
          <p className="text-sm mb-1">No performance data yet</p>
          <p className="text-xs">Open a published post and add metrics in the Performance section of the side panel.</p>
        </div>
      )}
    </div>
  )
}

// ── Chart components ────────────────────────────────────────

function BarChart({ data, color, height, valueKey, labelKey }) {
  if (!data.length) return <p className="text-sm text-stone-400">No data yet.</p>
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  const barW = Math.max(8, Math.min(40, Math.floor(600 / data.length) - 4))

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max((d[valueKey] / max) * (height - 28), d[valueKey] > 0 ? 4 : 0)
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            {d[valueKey] > 0 && (
              <span className="text-[10px] text-stone-500 leading-none">{d[valueKey]}</span>
            )}
            <div
              className="w-full rounded-t-sm transition-all"
              style={{ height: h || 2, backgroundColor: d[valueKey] > 0 ? color : '#e7e5e4', minHeight: 2 }}
            />
            <span className="text-[9px] text-stone-400 leading-none text-center">{d[labelKey]}</span>
          </div>
        )
      })}
    </div>
  )
}

function HorizontalBars({ entries, colorMap = {}, colorList = [], total }) {
  const max = entries[0]?.[1] || 1
  return (
    <div className="space-y-3">
      {entries.map(([label, count], i) => {
        const color = colorMap[label] || colorList[i % colorList.length] || '#9ca5b2'
        const pct = Math.round((count / total) * 100)
        return (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-stone-600">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-700">{count}</span>
                <span className="text-[10px] text-stone-400 w-8 text-right">{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(count / max) * 100}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryCard({ label, value, sub, valueColor }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <p
        className="text-3xl font-light mb-1"
        style={{ color: valueColor || '#292524' }}
      >
        {value}
      </p>
      <p className="text-xs text-stone-500">{label}</p>
      {sub && <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────

function computeStreak(posts) {
  const published = posts.filter(p => p.status === 'published' && p.scheduled_date)
  if (published.length === 0) return 0
  const getWeek = d => {
    const date = new Date(d + 'T00:00:00')
    const startOfYear = new Date(date.getFullYear(), 0, 1)
    return Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  }
  const weeksWithPosts = new Set(
    published.map(p => `${new Date(p.scheduled_date + 'T00:00:00').getFullYear()}-${getWeek(p.scheduled_date)}`)
  )
  let streak = 0
  const now = new Date()
  for (let w = 0; w < 52; w++) {
    const d = new Date(now)
    d.setDate(now.getDate() - w * 7)
    const key = `${d.getFullYear()}-${getWeek(d.toISOString().split('T')[0])}`
    if (weeksWithPosts.has(key)) streak++
    else if (w > 0) break
  }
  return streak
}

function buildMonthlyData(publishedPosts, months) {
  const now = new Date()
  const result = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const count = publishedPosts.filter(p => {
      const pd = new Date(p.scheduled_date || p.created_at)
      return pd.getFullYear() === y && pd.getMonth() === m
    }).length
    result.push({ label: MONTH_NAMES[m], count, year: y, month: m })
  }
  return result
}

function buildWeeklyData(posts, weeks) {
  const now = new Date()
  const result = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - i * 7 - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const count = posts.filter(p => {
      const pd = new Date(p.scheduled_date || p.created_at)
      return pd >= weekStart && pd < weekEnd
    }).length
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
    result.push({ label, count })
  }
  return result
}

function fmtNum(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return (n || 0).toString()
}

// GitHub-style posting heatmap (last 52 weeks)
function PostingHeatmap({ published }) {
  const now = new Date()
  // Build a map of date -> count
  const dateMap = {}
  published.forEach(p => {
    const d = (p.scheduled_date || p.created_at || '').split('T')[0]
    if (d) dateMap[d] = (dateMap[d] || 0) + 1
  })

  // Build 52 weeks × 7 days grid
  // Start from the Sunday 52 weeks ago
  const startDate = new Date(now)
  startDate.setDate(now.getDate() - now.getDay() - 51 * 7)
  startDate.setHours(0, 0, 0, 0)

  const weeks = []
  for (let w = 0; w < 52; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + w * 7 + d)
      const dateStr = date.toISOString().split('T')[0]
      const count = dateMap[dateStr] || 0
      const isFuture = date > now
      days.push({ date: dateStr, count, isFuture })
    }
    weeks.push(days)
  }

  const maxCount = Math.max(...Object.values(dateMap), 1)

  function getColor(count, isFuture) {
    if (isFuture) return '#f5f5f4'
    if (count === 0) return '#e7e5e4'
    const intensity = Math.min(count / maxCount, 1)
    if (intensity < 0.25) return '#99d4cc'
    if (intensity < 0.5) return '#5bbdb3'
    if (intensity < 0.75) return '#2a9d8f'
    return '#1a6b65'
  }

  const monthLabels = []
  for (let w = 0; w < 52; w += 4) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + w * 7)
    monthLabels.push({ w, label: MONTH_NAMES[d.getMonth()] })
  }

  const totalPosts = Object.values(dateMap).reduce((s, v) => s + v, 0)
  const activeDays = Object.keys(dateMap).length

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs tracking-widest uppercase text-stone-400">Posting Activity (last 12 months)</p>
        <p className="text-xs text-stone-400">{totalPosts} posts · {activeDays} active days</p>
      </div>
      <div className="overflow-x-auto">
        {/* Month labels */}
        <div className="flex mb-1 pl-6">
          {monthLabels.map(({ w, label }) => (
            <div key={w} className="text-[9px] text-stone-400" style={{ width: `${(4 / 52) * 100}%`, minWidth: 28 }}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1 justify-between" style={{ height: 7 * 11 }}>
            {['', 'M', '', 'W', '', 'F', ''].map((l, i) => (
              <div key={i} className="text-[9px] text-stone-300 leading-none" style={{ height: 10, lineHeight: '10px' }}>{l}</div>
            ))}
          </div>
          {/* Cells */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map(({ date, count, isFuture }) => (
                <div
                  key={date}
                  title={`${date}: ${count} post${count !== 1 ? 's' : ''}`}
                  className="rounded-sm cursor-default"
                  style={{ width: 10, height: 10, backgroundColor: getColor(count, isFuture) }}
                />
              ))}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 justify-end">
          <span className="text-[9px] text-stone-400">Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map(i => (
            <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getColor(i > 0 ? i * maxCount : 0, false) }} />
          ))}
          <span className="text-[9px] text-stone-400">More</span>
        </div>
      </div>
    </div>
  )
}
