import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchTrashed, restoreItem, permanentDelete, ENTITY_TYPES } from '../lib/trash'

const TYPE_CONFIG = {
  posts:         { label: 'Posts',         icon: '▷', type: ENTITY_TYPES.POST,          nameFn: r => r.title,  pathFn: r => `/posts/${r.id}` },
  collections:   { label: 'Albums',        icon: '◻', type: ENTITY_TYPES.COLLECTION,    nameFn: r => r.name,   pathFn: r => `/media/${r.id}` },
  audioProjects: { label: 'Sound Projects', icon: '♩', type: ENTITY_TYPES.AUDIO_PROJECT, nameFn: r => r.name,   pathFn: r => null },
  photos:        { label: 'Photos',         icon: '◻', type: ENTITY_TYPES.PHOTO,         nameFn: r => r.name,   pathFn: r => r.collection_id ? `/media/${r.collection_id}` : null },
  audioTracks:   { label: 'Tracks',         icon: '♩', type: ENTITY_TYPES.AUDIO_TRACK,   nameFn: r => r.name,   pathFn: r => null },
}

export default function Trash() {
  const navigate = useNavigate()
  const [trashed, setTrashed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [activeType, setActiveType] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const data = await fetchTrashed()
    setTrashed(data)
    setLoading(false)
  }

  async function handleRestore(entityType, item) {
    setRestoringId(item.id)
    await restoreItem(entityType, item.id, item.deleted_at)
    setTrashed(prev => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, v.filter(r => r.id !== item.id)])
      ),
    }))
    setRestoringId(null)
  }

  async function handlePermanentDelete(entityType, item) {
    if (!window.confirm(`Permanently delete "${TYPE_CONFIG[Object.keys(TYPE_CONFIG).find(k => TYPE_CONFIG[k].type === entityType)]?.nameFn(item)}"? This cannot be undone.`)) return
    setDeletingId(item.id)
    await permanentDelete(entityType, item.id)
    setTrashed(prev => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, v.filter(r => r.id !== item.id)])
      ),
    }))
    setDeletingId(null)
  }

  async function handleEmptyTrash() {
    setConfirmPurge(false)
    setLoading(true)
    for (const [key, items] of Object.entries(trashed || {})) {
      const config = TYPE_CONFIG[key]
      if (!config) continue
      for (const item of items) {
        await permanentDelete(config.type, item.id)
      }
    }
    await load()
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  function daysUntilPurge(dateStr) {
    if (!dateStr) return null
    const deleted = new Date(dateStr)
    const purge = new Date(deleted.getTime() + 30 * 86400000)
    const remaining = Math.ceil((purge - Date.now()) / 86400000)
    return remaining > 0 ? remaining : 0
  }

  const totalCount = trashed
    ? Object.values(trashed).reduce((sum, arr) => sum + arr.length, 0)
    : 0

  const sections = trashed
    ? Object.entries(TYPE_CONFIG)
        .map(([key, config]) => ({ key, config, items: trashed[key] || [] }))
        .filter(s => s.items.length > 0)
    : []

  const displayedSections = activeType === 'all'
    ? sections
    : sections.filter(s => s.key === activeType)

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate(-1)} className="text-stone-400 hover:text-stone-600 transition-colors text-sm">←</button>
            <h1 className="text-lg font-medium text-stone-800">Trash</h1>
          </div>
          <p className="text-xs text-stone-400">
            {loading ? 'Loading…' : `${totalCount} item${totalCount !== 1 ? 's' : ''} · Deleted items are automatically purged after 30 days`}
          </p>
        </div>
        {totalCount > 0 && !loading && (
          <div className="flex items-center gap-2">
            {confirmPurge ? (
              <>
                <span className="text-xs text-red-600">Empty all trash?</span>
                <button
                  onClick={handleEmptyTrash}
                  className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-md hover:bg-red-600 transition-colors"
                >
                  Yes, empty
                </button>
                <button
                  onClick={() => setConfirmPurge(false)}
                  className="text-xs bg-stone-100 text-stone-600 px-3 py-1.5 rounded-md hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmPurge(true)}
                className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
              >
                Empty Trash
              </button>
            )}
          </div>
        )}
      </div>

      {/* Type filter tabs */}
      {sections.length > 1 && (
        <div className="flex gap-1 mb-5 flex-wrap">
          <button
            onClick={() => setActiveType('all')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${activeType === 'all' ? 'bg-stone-700 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
          >
            All ({totalCount})
          </button>
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveType(s.key)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${activeType === s.key ? 'bg-stone-700 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
            >
              {s.config.label} ({s.items.length})
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="text-stone-400 text-sm animate-pulse">Loading trash…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && totalCount === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🗑</p>
          <p className="text-sm font-medium text-stone-600">Trash is empty</p>
          <p className="text-xs text-stone-400 mt-1">Deleted items appear here for 30 days before being permanently removed.</p>
        </div>
      )}

      {/* Sections */}
      {!loading && displayedSections.map(({ key, config, items }) => (
        <div key={key} className="mb-8">
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>{config.icon}</span>
            {config.label}
            <span className="text-stone-300">({items.length})</span>
          </h2>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {items.map((item, i) => {
              const name = config.nameFn(item)
              const days = daysUntilPurge(item.deleted_at)
              const isRestoring = restoringId === item.id
              const isDeleting = deletingId === item.id

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? 'border-t border-stone-100' : ''}`}
                >
                  <span className="text-stone-300 text-sm flex-shrink-0">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 truncate">{name}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      Deleted {timeAgo(item.deleted_at)}
                      {days !== null && (
                        <span className={days <= 3 ? 'text-red-400 ml-1' : 'ml-1'}>
                          · {days === 0 ? 'purges today' : `${days}d until purge`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(config.type, item)}
                      disabled={isRestoring || isDeleting}
                      className="text-xs text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
                    >
                      {isRestoring ? '…' : 'Restore'}
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(config.type, item)}
                      disabled={isRestoring || isDeleting}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-200 px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
                    >
                      {isDeleting ? '…' : 'Delete forever'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
