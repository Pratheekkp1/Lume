import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SOUND_STATUSES } from '../lib/constants'

export default function Sounds() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    const { data } = await supabase
      .from('audio_projects')
      .select('id, name, status, created_at, audio_categories(category:categories(id,name,color))')
      .order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  async function handleCreate(name) {
    const { data, error } = await supabase
      .from('audio_projects')
      .insert({ name: name.trim(), status: 'idea' })
      .select('id, name, status, created_at')
      .single()
    if (!error && data) {
      setProjects(prev => [data, ...prev])
      setShowCreate(false)
      navigate(`/sounds/${data.id}`)
    }
  }

  async function handleDelete() {
    await supabase.from('audio_projects').delete().eq('id', deleteTarget.id)
    setProjects(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const filtered = filterStatus === 'all' ? projects : projects.filter(p => p.status === filterStatus)

  return (
    <div className="p-7 max-w-4xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-stone-800">Sounds</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + New Sound Project
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
            filterStatus === 'all' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'
          }`}
        >
          All
        </button>
        {Object.entries(SOUND_STATUSES).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className="px-3 py-1 rounded-full text-xs border transition-colors"
            style={filterStatus === key
              ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
              : { borderColor: '#e7e5e4', color: '#78716c' }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-4xl mb-4">♩</p>
          <p className="text-sm font-medium mb-1">No sound projects yet</p>
          <p className="text-xs">Start organizing your music and audio.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(project => (
            <AudioCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/sounds/${project.id}`)}
              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(project) }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function AudioCard({ project, onClick, onDelete }) {
  const status = SOUND_STATUSES[project.status]
  const cats = (project.audio_categories || []).map(ac => ac.category).filter(Boolean)

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300 hover:shadow-sm transition-all text-left"
    >
      <span className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-sm text-stone-400 flex-shrink-0 group-hover:bg-stone-200 transition-colors">♩</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 truncate">{project.name}</p>
        {cats.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {cats.slice(0, 5).map(cat => (
              <span key={cat.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
            ))}
          </div>
        )}
      </div>
      {status && (
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color + '30', color: status.color }}
        >
          {status.label}
        </span>
      )}
      <span className="text-xs text-stone-300 flex-shrink-0 hidden sm:block">
        {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
      <button
        onClick={onDelete}
        className="w-5 h-5 rounded text-stone-300 hover:text-red-400 items-center justify-center text-xs transition-colors hidden group-hover:flex"
        title="Delete"
      >
        ✕
      </button>
    </button>
  )
}

function CreateModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave(name)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">New Sound Project</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Ambient street sounds"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-2">Delete sound project?</h2>
        <p className="text-sm text-stone-500 mb-6">
          "<span className="font-medium text-stone-700">{name}</span>" will be permanently deleted.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}
