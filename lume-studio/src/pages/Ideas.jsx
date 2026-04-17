import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const IDEA_STATUSES = {
  raw:        { label: 'Raw',        color: '#9ca5b2' },
  developing: { label: 'Developing', color: '#2a9d8f' },
  ready:      { label: 'Ready',      color: '#e76f51' },
  promoted:   { label: 'Promoted',   color: '#68b5a0' },
}

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'High',   dotClass: 'bg-red-500' },
  { value: 'normal', label: 'Normal', dotClass: 'bg-stone-400' },
  { value: 'low',    label: 'Low',    dotClass: 'bg-stone-300' },
]

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 }

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest first' },
  { value: 'due_date', label: 'Due date (soonest)' },
  { value: 'priority', label: 'Priority (high → low)' },
  { value: 'title',    label: 'Title A–Z' },
]

function formatDueDate(dateStr) {
  if (!dateStr) return null
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number)
  const due = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue = due < today
  const formatted = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return { formatted, isOverdue }
}

function applySort(ideas, sortBy) {
  const arr = [...ideas]
  if (sortBy === 'newest') {
    arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  } else if (sortBy === 'due_date') {
    arr.sort((a, b) => {
      if (!a.due_by && !b.due_by) return 0
      if (!a.due_by) return 1
      if (!b.due_by) return -1
      return new Date(a.due_by) - new Date(b.due_by)
    })
  } else if (sortBy === 'priority') {
    arr.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.normal
      const pb = PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.normal
      return pa - pb
    })
  } else if (sortBy === 'title') {
    arr.sort((a, b) => a.title.localeCompare(b.title))
  }
  return arr
}

export default function Ideas() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [promoteTarget, setPromoteTarget] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'kanban'

  useEffect(() => { fetchIdeas() }, [])

  async function fetchIdeas() {
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })
    setIdeas(data || [])
    setLoading(false)
  }

  async function handleCreate(fields) {
    const { data, error } = await supabase.from('ideas').insert(fields).select('*').single()
    if (!error && data) {
      setIdeas(prev => [data, ...prev])
      setShowCreate(false)
    }
  }

  async function handleUpdate(id, fields) {
    const { error } = await supabase.from('ideas').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) {
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i))
      setEditTarget(null)
    }
  }

  async function handleDelete(id) {
    setIdeas(prev => prev.filter(i => i.id !== id))
    await supabase.from('ideas').delete().eq('id', id)
  }

  async function handlePromote(idea) {
    // Create a new post from this idea
    const { data: post, error } = await supabase
      .from('posts')
      .insert({ title: idea.title, description: idea.notes || null, status: 'idea' })
      .select('id')
      .single()
    if (!error && post) {
      await supabase.from('ideas').update({
        status: 'promoted',
        promoted_post_id: post.id,
        updated_at: new Date().toISOString()
      }).eq('id', idea.id)
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status: 'promoted', promoted_post_id: post.id } : i))
      setPromoteTarget(null)
      navigate(`/posts/${post.id}`)
    }
  }

  async function bulkStatusChange(status) {
    const ids = [...selectedIds]
    setIdeas(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, status } : i))
    setSelectedIds(new Set())
    await supabase.from('ideas').update({ status, updated_at: new Date().toISOString() }).in('id', ids)
  }

  async function bulkDelete() {
    const ids = [...selectedIds]
    setIdeas(prev => prev.filter(i => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
    await supabase.from('ideas').delete().in('id', ids)
  }

  const baseFiltered = (filterStatus === 'all' ? ideas : ideas.filter(i => i.status === filterStatus))
    .filter(i => !search.trim() || i.title.toLowerCase().includes(search.toLowerCase()) || (i.notes || '').toLowerCase().includes(search.toLowerCase()))

  const filtered = applySort(baseFiltered, sortBy)

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Creative</p>
          <h1 className="font-serif text-3xl text-stone-800">Ideas</h1>
          <p className="text-xs text-stone-400 mt-1">
            {ideas.length} idea{ideas.length !== 1 ? 's' : ''}
            {(() => {
              const today = new Date(); today.setHours(0,0,0,0)
              const overdue = ideas.filter(i => i.due_by && new Date(i.due_by + 'T00:00:00') < today && i.status !== 'promoted').length
              return overdue > 0 ? <span className="ml-2 text-red-500 font-medium">{overdue} overdue</span> : null
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-stone-200 rounded-md overflow-hidden">
            {[['grid','⊞'],['kanban','⊟']].map(([mode, icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={mode.charAt(0).toUpperCase() + mode.slice(1) + ' view'}
                className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === mode ? 'bg-teal-500 text-white' : 'text-stone-500 hover:bg-stone-50'}`}
              >{icon}</button>
            ))}
          </div>
          <button
            onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()) }}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${selectMode ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
          <button
            onClick={() => {
              const lines = ideas.map(i => {
                const status = IDEA_STATUSES[i.status]?.label || i.status
                const priority = i.priority && i.priority !== 'normal' ? ` [${i.priority}]` : ''
                const due = i.due_by ? ` — due ${i.due_by}` : ''
                return [`## ${i.title}${priority}`, `Status: ${status}${due}`, i.notes ? i.notes : ''].filter(Boolean).join('\n')
              })
              const md = `# Ideas\n\nExported ${new Date().toLocaleDateString()}\n\n---\n\n` + lines.join('\n\n---\n\n')
              const blob = new Blob([md], { type: 'text/markdown' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `ideas-${new Date().toISOString().split('T')[0]}.md`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors"
            title="Export all ideas as Markdown"
          >
            ↓ .md
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
          >
            + Capture Idea
          </button>
        </div>
      </div>

      {/* Search + Sort row */}
      <div className="flex items-center gap-3 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ideas…"
          className="w-full max-w-xs text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400 text-stone-700 placeholder-stone-300"
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400 text-stone-600 bg-white"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${filterStatus === 'all' ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}
        >
          All ({ideas.length})
        </button>
        {Object.entries(IDEA_STATUSES).map(([key, s]) => {
          const count = ideas.filter(i => i.status === key).length
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${filterStatus === key ? 'text-white border-transparent' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}
              style={filterStatus === key ? { backgroundColor: s.color } : {}}
            >
              {s.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs">
          <span className="text-stone-600 font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <select
              onChange={e => { if (e.target.value) bulkStatusChange(e.target.value) }}
              className="text-xs border border-stone-200 rounded px-2 py-1 bg-white text-stone-500 focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>Change status…</option>
              {Object.entries(IDEA_STATUSES).filter(([k]) => k !== 'promoted').map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
            <button onClick={bulkDelete} className="text-red-400 hover:text-red-600 px-2 py-1 border border-stone-200 rounded transition-colors">Delete</button>
          </div>
        </div>
      )}

      {/* Ideas grid / kanban */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-lg mb-1">No ideas yet</p>
          <p className="text-sm mb-4">Capture inspiration before it becomes a post.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
          >
            Capture your first idea
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ── Kanban ── */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(IDEA_STATUSES).map(([statusKey, statusMeta]) => {
            const colIdeas = applySort(
              ideas.filter(i => i.status === statusKey).filter(i => !search.trim() || i.title.toLowerCase().includes(search.toLowerCase())),
              sortBy
            )
            return (
              <div key={statusKey} className="flex-shrink-0 w-64">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusMeta.color }} />
                  <span className="text-xs font-medium text-stone-600">{statusMeta.label}</span>
                  <span className="ml-auto text-xs text-stone-400">{colIdeas.length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {colIdeas.map(idea => {
                    const pri = PRIORITY_OPTIONS.find(p => p.value === (idea.priority || 'normal'))
                    const due = idea.due_by ? formatDueDate(idea.due_by) : null
                    return (
                      <div
                        key={idea.id}
                        className="bg-white border border-stone-200 rounded-lg p-3 hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer group"
                        onClick={() => setEditTarget(idea)}
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${pri?.dotClass || 'bg-stone-400'}`} />
                          <p className="text-xs font-medium text-stone-700 leading-snug flex-1">{idea.title}</p>
                        </div>
                        {idea.notes && (
                          <p className="text-[10px] text-stone-400 truncate ml-4 mb-1.5">{idea.notes}</p>
                        )}
                        {due && (
                          <p className={`text-[10px] ml-4 ${due.isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
                            {due.isOverdue ? '⚠ ' : ''}Due {due.formatted}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                          {Object.entries(IDEA_STATUSES).filter(([k]) => k !== statusKey && k !== 'promoted').map(([k, s]) => (
                            <button
                              key={k}
                              onClick={e => { e.stopPropagation(); handleUpdate(idea.id, { status: k }) }}
                              className="text-[9px] px-1.5 py-0.5 rounded border border-stone-200 text-stone-400 hover:text-stone-700 transition-colors"
                              title={`Move to ${s.label}`}
                            >
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {colIdeas.length === 0 && (
                    <div className="border border-dashed border-stone-200 rounded-lg py-6 text-center">
                      <p className="text-[10px] text-stone-300">No ideas</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-stone-400 text-sm py-8 text-center">No ideas match your filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onEdit={() => setEditTarget(idea)}
              onDelete={() => handleDelete(idea.id)}
              onPromote={() => idea.promoted_post_id ? navigate(`/posts/${idea.promoted_post_id}`) : setPromoteTarget(idea)}
              onStatusChange={(status) => handleUpdate(idea.id, { status })}
              selectMode={selectMode}
              selected={selectedIds.has(idea.id)}
              onSelect={() => setSelectedIds(prev => {
                const next = new Set(prev)
                next.has(idea.id) ? next.delete(idea.id) : next.add(idea.id)
                return next
              })}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <IdeaModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}

      {/* Edit modal */}
      {editTarget && (
        <IdeaModal
          initial={editTarget}
          onSave={fields => handleUpdate(editTarget.id, fields)}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Promote confirm */}
      {promoteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-medium text-stone-800 mb-2">Promote to post?</h3>
            <p className="text-sm text-stone-500 mb-5">
              A new post will be created from "<span className="font-medium">{promoteTarget.title}</span>" and you'll be taken to edit it.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPromoteTarget(null)} className="text-sm text-stone-500 px-4 py-2 border border-stone-200 rounded-md hover:border-stone-300 transition-colors">Cancel</button>
              <button onClick={() => handlePromote(promoteTarget)} className="text-sm bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 transition-colors">Promote</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IdeaCard({ idea, onEdit, onDelete, onPromote, onStatusChange, selectMode, selected, onSelect }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const s = IDEA_STATUSES[idea.status] || IDEA_STATUSES.raw
  const isPromoted = idea.status === 'promoted'
  const priority = PRIORITY_OPTIONS.find(p => p.value === (idea.priority || 'normal')) || PRIORITY_OPTIONS[1]
  const dueInfo = formatDueDate(idea.due_by)

  function handleCardClick() {
    if (selectMode) {
      onSelect()
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white border rounded-xl p-4 hover:shadow-sm transition group flex flex-col gap-3 relative ${
        selectMode ? 'cursor-pointer' : ''
      } ${
        selected ? 'border-teal-400 ring-2 ring-teal-100' : 'border-stone-200 hover:border-stone-300'
      }`}
    >
      {/* Checkbox (select mode) */}
      {selectMode && (
        <div className="absolute top-3 left-3 z-10">
          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected ? 'bg-teal-500 border-teal-500' : 'bg-white border-stone-300'}`}>
            {selected && <span className="text-white text-[10px] leading-none">✓</span>}
          </div>
        </div>
      )}

      {/* Status + priority + menu row */}
      <div className={`flex items-center justify-between ${selectMode ? 'pl-6' : ''}`}>
        <div className="flex items-center gap-2">
          {/* Priority dot */}
          <span
            className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${priority.dotClass}`}
            title={`Priority: ${priority.label}`}
          />
          {/* Status badge */}
          <div className="relative">
            <button
              onClick={e => { if (selectMode) { e.stopPropagation(); return; } setShowStatusMenu(p => !p) }}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors"
              style={{ backgroundColor: s.color + '25', color: s.color }}
            >
              {s.label} {!selectMode && '▾'}
            </button>
            {showStatusMenu && !selectMode && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                {Object.entries(IDEA_STATUSES).map(([key, st]) => key !== 'promoted' && (
                  <button
                    key={key}
                    onClick={() => { onStatusChange(key); setShowStatusMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                    {st.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {!selectMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="text-xs text-stone-400 hover:text-stone-600 px-1.5 py-0.5 rounded transition-colors">Edit</button>
            <button onClick={onDelete} className="text-stone-300 hover:text-red-400 text-lg leading-none transition-colors">×</button>
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-stone-800 leading-snug">{idea.title}</p>

      {/* Due date */}
      {dueInfo && (
        <p className={`text-xs ${dueInfo.isOverdue ? 'text-red-500' : 'text-stone-500'}`}>
          {dueInfo.isOverdue ? '⚠ overdue · ' : 'Due '}{dueInfo.formatted}
        </p>
      )}

      {/* Notes */}
      {idea.notes && (
        <p className="text-xs text-stone-500 leading-relaxed line-clamp-3">{idea.notes}</p>
      )}

      {/* Inspiration URL */}
      {idea.inspiration_url && (
        <a
          href={idea.inspiration_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[10px] text-teal-600 hover:text-teal-700 truncate transition-colors"
        >
          🔗 {idea.inspiration_url.replace(/^https?:\/\//, '').split('/')[0]}
        </a>
      )}

      {/* Promote button */}
      {!selectMode && (
        <button
          onClick={e => { e.stopPropagation(); onPromote() }}
          className={`mt-auto text-xs py-1.5 rounded-md border transition-colors w-full ${
            isPromoted
              ? 'border-stone-100 text-stone-400 bg-stone-50'
              : 'border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300'
          }`}
        >
          {isPromoted ? '✓ Promoted to post' : '→ Promote to post'}
        </button>
      )}
    </div>
  )
}

function IdeaModal({ initial = {}, onSave, onClose }) {
  const [title, setTitle] = useState(initial.title || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [url, setUrl] = useState(initial.inspiration_url || '')
  const [status, setStatus] = useState(initial.status || 'raw')
  const [priority, setPriority] = useState(initial.priority || 'normal')
  const [dueBy, setDueBy] = useState(initial.due_by || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      notes: notes.trim() || null,
      inspiration_url: url.trim() || null,
      status,
      priority,
      due_by: dueBy || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-medium text-stone-800 mb-5">{initial.id ? 'Edit Idea' : 'Capture Idea'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What's the idea?"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Details, angles, hooks, references…"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Inspiration URL</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://…"
              type="url"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Priority + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400 bg-white text-stone-700"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Due date</label>
              <input
                type="date"
                value={dueBy}
                onChange={e => setDueBy(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400 text-stone-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">Status</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(IDEA_STATUSES).filter(([k]) => k !== 'promoted').map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className="text-xs px-3 py-1 rounded-full border transition-colors"
                  style={status === key
                    ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                    : { borderColor: '#e7e5e4', color: '#78716c' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="text-sm text-stone-500 px-4 py-2 border border-stone-200 rounded-md hover:border-stone-300 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !title.trim()} className="text-sm bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Capture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
