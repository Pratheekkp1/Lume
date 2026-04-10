import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CAMPAIGN_STATUSES = {
  planning:  { label: 'Planning',  color: '#9ca5b2' },
  active:    { label: 'Active',    color: '#2a9d8f' },
  complete:  { label: 'Complete',  color: '#68b5a0' },
  paused:    { label: 'Paused',    color: '#e76f51' },
}

const PALETTE = [
  '#6366f1', '#2a9d8f', '#e76f51', '#f4a261', '#e9c46a',
  '#264653', '#a8dadc', '#e63946', '#457b9d', '#2d6a4f',
]

export default function Campaigns() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { fetchCampaigns() }, [])

  async function fetchCampaigns() {
    const { data: camps } = await supabase
      .from('campaigns')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!camps || camps.length === 0) { setCampaigns([]); setLoading(false); return }

    // Get post counts per campaign
    const { data: links } = await supabase
      .from('campaign_posts')
      .select('campaign_id, post_id, posts(status)')
      .in('campaign_id', camps.map(c => c.id))

    const countMap = {}
    const publishedMap = {}
    for (const l of links || []) {
      countMap[l.campaign_id] = (countMap[l.campaign_id] || 0) + 1
      if (l.posts?.status === 'published') {
        publishedMap[l.campaign_id] = (publishedMap[l.campaign_id] || 0) + 1
      }
    }

    setCampaigns(camps.map(c => ({
      ...c,
      postCount: countMap[c.id] || 0,
      publishedCount: publishedMap[c.id] || 0,
    })))
    setLoading(false)
  }

  async function handleCreate(fields) {
    const { data, error } = await supabase.from('campaigns').insert(fields).select('*').single()
    if (!error && data) {
      setCampaigns(prev => [{ ...data, postCount: 0, publishedCount: 0 }, ...prev])
      setShowCreate(false)
    }
  }

  async function handleDelete() {
    const id = deleteTarget.id
    setDeleteTarget(null)
    setCampaigns(prev => prev.filter(c => c.id !== id))
    await supabase.from('campaigns').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  const filtered = filterStatus === 'all' ? campaigns : campaigns.filter(c => c.status === filterStatus)

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Strategy</p>
          <h1 className="font-serif text-3xl text-stone-800">Campaigns</h1>
          <p className="text-xs text-stone-400 mt-1">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
            filterStatus === 'all' ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-400'
          }`}
        >
          All
        </button>
        {Object.entries(CAMPAIGN_STATUSES).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              filterStatus === key ? 'text-white border-transparent' : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
            style={filterStatus === key ? { backgroundColor: s.color } : {}}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Campaign grid */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-lg mb-1">No campaigns yet</p>
          <p className="text-sm">Group posts into campaigns to plan content series and track progress.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
          >
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onClick={() => navigate(`/campaigns/${c.id}`)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CampaignModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-medium text-stone-800 mb-2">Delete campaign?</h3>
            <p className="text-sm text-stone-500 mb-5">
              "{deleteTarget.name}" will be deleted. Posts inside will not be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="text-sm text-stone-500 px-4 py-2 border border-stone-200 rounded-md hover:border-stone-300 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="text-sm bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign, onClick, onDelete }) {
  const status = CAMPAIGN_STATUSES[campaign.status] || CAMPAIGN_STATUSES.planning
  const pct = campaign.postCount > 0 ? Math.round((campaign.publishedCount / campaign.postCount) * 100) : 0

  function formatDate(d) {
    if (!d) return null
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div
      onClick={onClick}
      className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 hover:shadow-sm transition cursor-pointer group relative"
    >
      {/* Color bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: campaign.color }} />

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none"
        title="Delete campaign"
      >
        ×
      </button>

      <div className="mt-2">
        {/* Status badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: status.color + '25', color: status.color }}
          >
            {status.label}
          </span>
        </div>

        <h3 className="font-medium text-stone-800 text-sm leading-snug mb-1">{campaign.name}</h3>

        {campaign.description && (
          <p className="text-xs text-stone-400 leading-relaxed mb-3 line-clamp-2">{campaign.description}</p>
        )}

        {/* Date range */}
        {(campaign.start_date || campaign.end_date) && (
          <p className="text-[10px] text-stone-400 mb-3">
            {formatDate(campaign.start_date)} {campaign.start_date && campaign.end_date ? '→' : ''} {formatDate(campaign.end_date)}
          </p>
        )}

        {/* Progress */}
        <div className="mt-auto pt-3 border-t border-stone-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-stone-400">{campaign.publishedCount} / {campaign.postCount} published</span>
            <span className="text-xs font-medium text-stone-500">{pct}%</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: campaign.color }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function CampaignModal({ initial = {}, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '')
  const [description, setDescription] = useState(initial.description || '')
  const [status, setStatus] = useState(initial.status || 'planning')
  const [startDate, setStartDate] = useState(initial.start_date || '')
  const [endDate, setEndDate] = useState(initial.end_date || '')
  const [color, setColor] = useState(initial.color || PALETTE[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      color,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-medium text-stone-800 mb-5">New Campaign</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Summer Drop, Brand Deal X"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What's this campaign about?"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
              >
                {Object.entries(CAMPAIGN_STATUSES).map(([k, s]) => (
                  <option key={k} value={k}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition ${color === c ? 'border-stone-700 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="text-sm text-stone-500 px-4 py-2 border border-stone-200 rounded-md hover:border-stone-300 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="text-sm bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export { CAMPAIGN_STATUSES, PALETTE }
