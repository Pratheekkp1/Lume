import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const IDEA_STATUSES = {
  raw:        { label: 'Raw',        color: '#9ca5b2' },
  developing: { label: 'Developing', color: '#2a9d8f' },
  ready:      { label: 'Ready',      color: '#e76f51' },
  promoted:   { label: 'Promoted',   color: '#68b5a0' },
}

export default function Ideas() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [promoteTarget, setPromoteTarget] = useState(null)

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

  const filtered = filterStatus === 'all' ? ideas : ideas.filter(i => i.status === filterStatus)

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Creative</p>
          <h1 className="font-serif text-3xl text-stone-800">Ideas</h1>
          <p className="text-xs text-stone-400 mt-1">{ideas.length} idea{ideas.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
        >
          + Capture Idea
        </button>
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

      {/* Ideas grid */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
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

function IdeaCard({ idea, onEdit, onDelete, onPromote, onStatusChange }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const s = IDEA_STATUSES[idea.status] || IDEA_STATUSES.raw
  const isPromoted = idea.status === 'promoted'

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition group flex flex-col gap-3">
      {/* Status + menu row */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(p => !p)}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors"
            style={{ backgroundColor: s.color + '25', color: s.color }}
          >
            {s.label} ▾
          </button>
          {showStatusMenu && (
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
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-xs text-stone-400 hover:text-stone-600 px-1.5 py-0.5 rounded transition-colors">Edit</button>
          <button onClick={onDelete} className="text-stone-300 hover:text-red-400 text-lg leading-none transition-colors">×</button>
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-stone-800 leading-snug">{idea.title}</p>

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
      <button
        onClick={onPromote}
        className={`mt-auto text-xs py-1.5 rounded-md border transition-colors w-full ${
          isPromoted
            ? 'border-stone-100 text-stone-400 bg-stone-50'
            : 'border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300'
        }`}
      >
        {isPromoted ? '✓ Promoted to post' : '→ Promote to post'}
      </button>
    </div>
  )
}

function IdeaModal({ initial = {}, onSave, onClose }) {
  const [title, setTitle] = useState(initial.title || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [url, setUrl] = useState(initial.inspiration_url || '')
  const [status, setStatus] = useState(initial.status || 'raw')
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
