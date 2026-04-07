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
  const [editTarget, setEditTarget] = useState(null)
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

  async function handleCreate(fields) {
    const { data, error } = await supabase
      .from('audio_projects')
      .insert(fields)
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

  async function handleEdit(fields) {
    const { error } = await supabase.from('audio_projects').update(fields).eq('id', editTarget.id)
    if (!error) {
      setProjects(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...fields } : p))
      setEditTarget(null)
    }
  }

  async function handleDeleteFromEdit() {
    await supabase.from('audio_projects').delete().eq('id', editTarget.id)
    setProjects(prev => prev.filter(p => p.id !== editTarget.id))
    setEditTarget(null)
  }

  const filtered = filterStatus === 'all' ? projects : projects.filter(p => p.status === filterStatus)

  return (
    <div className="p-7">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-serif text-3xl text-stone-800">Sounds</h1>
          <p className="text-xs text-stone-400 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
        >
          + New Sound Project
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
        <div className="max-w-2xl flex flex-col gap-2">
          {filtered.map(project => (
            <AudioCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/sounds/${project.id}`)}
              onEdit={(e) => { e.stopPropagation(); setEditTarget(project) }}
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
      {editTarget && (
        <EditProjectModal
          project={editTarget}
          onSave={handleEdit}
          onDelete={handleDeleteFromEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}

function AudioCard({ project, onClick, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = SOUND_STATUSES[project.status]
  const cats = (project.audio_categories || []).map(ac => ac.category).filter(Boolean)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300 hover:shadow-sm transition-all text-left"
    >
      <span className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-sm text-stone-400 flex-shrink-0 hover:bg-stone-200 transition-colors">♩</span>
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
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="w-5 h-5 rounded text-stone-300 hover:text-stone-600 flex items-center justify-center text-sm transition-colors"
        >
          ⋮
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
            <div className="absolute top-6 right-0 z-20 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[140px]">
              <button
                onClick={(e) => { setMenuOpen(false); onEdit(e) }}
                className="w-full text-left px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Edit Project
              </button>
              <button
                onClick={(e) => { setMenuOpen(false); onDelete(e) }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
              >
                Delete Project
              </button>
            </div>
          </>
        )}
      </div>
    </button>
  )
}

function CreateModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState('idea')
  const [projectDate, setProjectDate] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      status,
      project_date: projectDate || null,
      description: description.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">New Sound Project</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ambient street sounds"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <Field label="Status">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SOUND_STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                  style={status === key
                    ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                    : { borderColor: '#e7e5e4', color: '#78716c' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={projectDate}
              onChange={e => setProjectDate(e.target.value)}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Quick notes or context…"
              rows={2}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none transition-colors"
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving} className="flex-1 bg-teal-500 text-white text-sm py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

function EditProjectModal({ project, onSave, onDelete, onClose }) {
  const [name, setName] = useState(project.name || '')
  const [status, setStatus] = useState(project.status || 'idea')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), status })
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-6">
          <h2 className="font-serif text-xl text-stone-800 mb-1">Edit Sound Project</h2>
          <p className="text-xs text-stone-400 mb-5">{project.name}</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Name</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
              >
                {Object.entries(SOUND_STATUSES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
              <button type="submit" disabled={!name.trim() || saving} className="flex-1 bg-teal-500 text-white text-sm py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
        <div className="px-6 pb-6 pt-2 border-t border-stone-100">
          <p className="text-xs text-stone-400 mb-2">Danger zone</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full border border-red-200 text-red-400 text-xs font-medium py-2 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete Project'}
          </button>
        </div>
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
