import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const METRIC_FIELDS = [
  { key: 'views',    label: 'Views' },
  { key: 'likes',    label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'saves',    label: 'Saves' },
  { key: 'shares',   label: 'Shares' },
]

export default function PostMetrics({ postId, platforms }) {
  const [metrics, setMetrics] = useState([]) // one row per platform
  const [editing, setEditing] = useState(null) // platform string being edited
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const hasPlatforms = platforms && platforms.length > 0

  useEffect(() => {
    if (hasPlatforms) fetchMetrics()
  }, [postId, JSON.stringify(platforms)])

  async function fetchMetrics() {
    const { data } = await supabase
      .from('post_metrics')
      .select('*')
      .eq('post_id', postId)
      .order('recorded_at', { ascending: false })
    // Keep only the most recent entry per platform
    const seen = new Set()
    const latest = []
    for (const row of data || []) {
      if (!seen.has(row.platform)) { seen.add(row.platform); latest.push(row) }
    }
    setMetrics(latest)
  }

  function startEdit(platform) {
    const existing = metrics.find(m => m.platform === platform)
    setDraft({
      views:    existing?.views    ?? '',
      likes:    existing?.likes    ?? '',
      comments: existing?.comments ?? '',
      saves:    existing?.saves    ?? '',
      shares:   existing?.shares   ?? '',
    })
    setEditing(platform)
  }

  async function saveMetric() {
    setSaving(true)
    const existing = metrics.find(m => m.platform === editing)
    const row = {
      post_id:  postId,
      platform: editing,
      views:    parseInt(draft.views)    || 0,
      likes:    parseInt(draft.likes)    || 0,
      comments: parseInt(draft.comments) || 0,
      saves:    parseInt(draft.saves)    || 0,
      shares:   parseInt(draft.shares)   || 0,
      recorded_at: new Date().toISOString().split('T')[0],
    }

    if (existing) {
      await supabase.from('post_metrics').update(row).eq('id', existing.id)
      setMetrics(prev => prev.map(m => m.platform === editing ? { ...m, ...row, id: existing.id } : m))
    } else {
      const { data } = await supabase.from('post_metrics').insert(row).select().single()
      if (data) setMetrics(prev => [...prev, data])
    }

    setSaving(false)
    setEditing(null)
  }

  function totalFor(field) {
    return metrics.reduce((sum, m) => sum + (m[field] || 0), 0)
  }

  if (!hasPlatforms) return null

  return (
    <div>
      <button
        onClick={() => setExpanded(p => !p)}
        className="flex items-center justify-between w-full text-[10px] uppercase tracking-widest text-stone-400 mb-2 hover:text-stone-600 transition-colors"
      >
        <span>Performance</span>
        <span className="normal-case tracking-normal text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Summary row if any data exists */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 p-3 bg-stone-50 rounded-lg">
              {METRIC_FIELDS.slice(0, 3).map(f => (
                <div key={f.key} className="text-center">
                  <p className="text-sm font-medium text-stone-700">{fmtNum(totalFor(f.key))}</p>
                  <p className="text-[10px] text-stone-400">{f.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Per-platform breakdown */}
          {platforms.map(platform => {
            const m = metrics.find(x => x.platform === platform)
            const isEditing = editing === platform

            return (
              <div key={platform} className="border border-stone-100 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-stone-50">
                  <span className="text-xs font-medium text-stone-600">{platform}</span>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(platform)}
                      className="text-[10px] text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      {m ? 'Update' : 'Add'}
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="p-3 space-y-2">
                    {METRIC_FIELDS.map(f => (
                      <div key={f.key} className="flex items-center gap-2">
                        <label className="text-[10px] text-stone-400 w-16 flex-shrink-0">{f.label}</label>
                        <input
                          type="number"
                          min="0"
                          value={draft[f.key]}
                          onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="flex-1 text-xs border border-stone-200 rounded px-2 py-1 focus:outline-none focus:border-teal-400"
                          placeholder="0"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setEditing(null)}
                        className="flex-1 text-[10px] text-stone-400 border border-stone-200 rounded py-1 hover:border-stone-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveMetric}
                        disabled={saving}
                        className="flex-1 text-[10px] bg-teal-500 text-white rounded py-1 hover:bg-teal-600 disabled:opacity-40 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : m ? (
                  <div className="grid grid-cols-5 px-3 py-2 gap-1">
                    {METRIC_FIELDS.map(f => (
                      <div key={f.key} className="text-center">
                        <p className="text-xs font-medium text-stone-600">{fmtNum(m[f.key] || 0)}</p>
                        <p className="text-[9px] text-stone-400">{f.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-300 px-3 py-2 italic">No data yet</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function fmtNum(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}
