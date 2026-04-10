import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES } from '../lib/constants'
import { CAMPAIGN_STATUSES, PALETTE } from './Campaigns'

export default function CampaignView() {
  const { campaignId } = useParams()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showAddPosts, setShowAddPosts] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { fetchAll() }, [campaignId])

  async function fetchAll() {
    const [{ data: camp }, { data: links }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase
        .from('campaign_posts')
        .select('post_id, posts(id, title, status, platform, scheduled_date, type)')
        .eq('campaign_id', campaignId),
    ])
    setCampaign(camp)
    setPosts((links || []).map(l => l.posts).filter(Boolean))
    setLoading(false)
  }

  async function handleUpdate(fields) {
    const { error } = await supabase.from('campaigns').update(fields).eq('id', campaignId)
    if (!error) {
      setCampaign(prev => ({ ...prev, ...fields }))
      setEditing(false)
    }
  }

  async function handleDelete() {
    await supabase.from('campaigns').update({ deleted_at: new Date().toISOString() }).eq('id', campaignId)
    navigate('/campaigns')
  }

  async function removePost(postId) {
    setPosts(prev => prev.filter(p => p.id !== postId))
    await supabase.from('campaign_posts').delete().eq('campaign_id', campaignId).eq('post_id', postId)
  }

  async function addPosts(newPostIds) {
    const rows = newPostIds.map(pid => ({ campaign_id: campaignId, post_id: pid }))
    await supabase.from('campaign_posts').upsert(rows, { ignoreDuplicates: true })
    setShowAddPosts(false)
    fetchAll()
  }

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading...</div>
  if (!campaign) return <div className="p-7 text-stone-400 text-sm">Campaign not found.</div>

  const status = CAMPAIGN_STATUSES[campaign.status] || CAMPAIGN_STATUSES.planning
  const publishedCount = posts.filter(p => p.status === 'published').length
  const pct = posts.length > 0 ? Math.round((publishedCount / posts.length) * 100) : 0

  function formatDate(d) {
    if (!d) return null
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="p-7 max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate('/campaigns')} className="text-xs text-stone-400 hover:text-stone-600 transition-colors mb-5 flex items-center gap-1">
        ← All Campaigns
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: campaign.color }} />
          <div>
            <h1 className="font-serif text-3xl text-stone-800 mb-1">{campaign.name}</h1>
            {campaign.description && <p className="text-sm text-stone-500 mb-2">{campaign.description}</p>}
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: status.color + '25', color: status.color }}
              >
                {status.label}
              </span>
              {(campaign.start_date || campaign.end_date) && (
                <span className="text-xs text-stone-400">
                  {formatDate(campaign.start_date)} {campaign.start_date && campaign.end_date ? '→' : ''} {formatDate(campaign.end_date)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-stone-500 px-3 py-1.5 border border-stone-200 rounded-md hover:border-stone-300 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-400 px-3 py-1.5 border border-red-200 rounded-md hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-stone-500">Campaign Progress</span>
          <span className="text-xs text-stone-400">{publishedCount} of {posts.length} posts published</span>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: campaign.color }}
          />
        </div>
        {/* Status breakdown */}
        <div className="flex gap-4 flex-wrap">
          {Object.entries(POST_STATUSES).map(([key, s]) => {
            const count = posts.filter(p => p.status === key).length
            if (count === 0) return null
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-stone-400">{s.label}: {count}</span>
              </div>
            )
          })}
          {posts.length === 0 && <span className="text-xs text-stone-400">No posts yet</span>}
        </div>
      </div>

      {/* Posts section */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs tracking-widest uppercase text-stone-400">Posts ({posts.length})</p>
        <button
          onClick={() => setShowAddPosts(true)}
          className="text-xs text-teal-600 hover:text-teal-700 border border-teal-200 px-3 py-1.5 rounded-md hover:border-teal-300 transition-colors"
        >
          + Add Posts
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 bg-white border border-stone-200 rounded-xl text-stone-400">
          <p className="text-sm mb-1">No posts in this campaign</p>
          <p className="text-xs">Add existing posts to track them here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => {
            const ps = POST_STATUSES[post.status]
            return (
              <div
                key={post.id}
                className="bg-white border border-stone-200 rounded-lg px-4 py-3 flex items-center gap-4 group hover:border-stone-300 transition"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ps?.color || '#ccc' }} />
                <button
                  onClick={() => navigate(`/posts/${post.id}`)}
                  className="flex-1 text-left text-sm text-stone-700 hover:text-teal-700 transition-colors truncate"
                >
                  {post.title || 'Untitled'}
                </button>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {post.type && <span className="text-[10px] text-stone-400">{post.type}</span>}
                  {ps && (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: ps.color + '25', color: ps.color }}
                    >
                      {ps.label}
                    </span>
                  )}
                  {post.scheduled_date && (
                    <span className="text-[10px] text-stone-400">
                      {new Date(post.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {post.platform?.length > 0 && (
                    <span className="text-[10px] text-stone-400">{post.platform.join(', ')}</span>
                  )}
                  <button
                    onClick={() => removePost(post.id)}
                    className="text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none"
                    title="Remove from campaign"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditCampaignModal
          campaign={campaign}
          onSave={handleUpdate}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Add posts modal */}
      {showAddPosts && (
        <AddPostsModal
          campaignId={campaignId}
          existingPostIds={posts.map(p => p.id)}
          onAdd={addPosts}
          onClose={() => setShowAddPosts(false)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-medium text-stone-800 mb-2">Delete campaign?</h3>
            <p className="text-sm text-stone-500 mb-5">
              "{campaign.name}" will be deleted. Posts inside will not be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-stone-500 px-4 py-2 border border-stone-200 rounded-md hover:border-stone-300 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="text-sm bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditCampaignModal({ campaign, onSave, onClose }) {
  const [name, setName] = useState(campaign.name || '')
  const [description, setDescription] = useState(campaign.description || '')
  const [status, setStatus] = useState(campaign.status || 'planning')
  const [startDate, setStartDate] = useState(campaign.start_date || '')
  const [endDate, setEndDate] = useState(campaign.end_date || '')
  const [color, setColor] = useState(campaign.color || PALETTE[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), description: description.trim() || null, status, start_date: startDate || null, end_date: endDate || null, color })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-medium text-stone-800 mb-5">Edit Campaign</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
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
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="text-sm text-stone-500 px-4 py-2 border border-stone-200 rounded-md hover:border-stone-300 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="text-sm bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddPostsModal({ campaignId, existingPostIds, onAdd, onClose }) {
  const [allPosts, setAllPosts] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('posts')
        .select('id, title, status, type')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      setAllPosts((data || []).filter(p => !existingPostIds.includes(p.id)))
      setLoading(false)
    }
    load()
  }, [])

  function toggle(id) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const filtered = allPosts.filter(p =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-stone-100">
          <h3 className="font-medium text-stone-800 mb-3">Add Posts to Campaign</h3>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-stone-400 text-sm text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-8">No posts available</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(post => {
                const ps = POST_STATUSES[post.status]
                const checked = selected.has(post.id)
                return (
                  <button
                    key={post.id}
                    onClick={() => toggle(post.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${checked ? 'bg-teal-50 border border-teal-200' : 'hover:bg-stone-50 border border-transparent'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${checked ? 'bg-teal-500 border-teal-500' : 'border-stone-300'}`}>
                      {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                    </span>
                    <span className="flex-1 text-sm text-stone-700 truncate">{post.title || 'Untitled'}</span>
                    {post.type && <span className="text-[10px] text-stone-400">{post.type}</span>}
                    {ps && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ps.color + '25', color: ps.color }}>
                        {ps.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-400">{selected.size} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm text-stone-500 px-4 py-2 border border-stone-200 rounded-md hover:border-stone-300 transition-colors">Cancel</button>
            <button
              onClick={() => onAdd([...selected])}
              disabled={selected.size === 0}
              className="text-sm bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors"
            >
              Add {selected.size > 0 ? selected.size : ''} Post{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
