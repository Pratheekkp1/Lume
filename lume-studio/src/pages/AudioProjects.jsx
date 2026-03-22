import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { STATUSES } from '../lib/constants'

export default function AudioProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStatus, setEditStatus] = useState('unedited')
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    const { data, error } = await supabase
      .from('audio_projects')
      .select('*, audio_tracks(id)')
      .order('created_at', { ascending: false })
    if (!error && data) setProjects(data)
    setLoading(false)
  }

  async function createProject() {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('audio_projects').insert({
      name: newName.trim(),
      event_date: newDate || null,
      location: newLocation || null,
      status: 'unedited',
    })
    if (!error) {
      setShowNew(false)
      setNewName('')
      setNewDate('')
      setNewLocation('')
      fetchProjects()
    }
    setSaving(false)
  }

  function openEdit(e, project) {
    e.stopPropagation()
    setEditTarget(project)
    setEditName(project.name)
    setEditDate(project.event_date ? project.event_date.slice(0, 10) : '')
    setEditLocation(project.location || '')
    setEditStatus(project.status || 'unedited')
  }

  async function saveEdit() {
    if (!editName.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('audio_projects')
      .update({
        name: editName.trim(),
        event_date: editDate || null,
        location: editLocation || null,
        status: editStatus,
      })
      .eq('id', editTarget.id)
    if (!error) {
      setEditTarget(null)
      fetchProjects()
    }
    setSaving(false)
  }

  async function deleteProject() {
    if (!editTarget) return
    setDeleting(true)
    await supabase.from('audio_tracks').delete().eq('project_id', editTarget.id)
    const { error } = await supabase.from('audio_projects').delete().eq('id', editTarget.id)
    if (!error) {
      setEditTarget(null)
      fetchProjects()
    }
    setDeleting(false)
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Library</p>
          <h1 className="font-serif text-3xl text-stone-800">Music / Audio</h1>
          <p className="text-xs text-stone-400 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + New Project
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-stone-500 text-sm mb-1">No projects yet</p>
          <p className="text-stone-400 text-xs">Create your first audio project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(`/audio/${p.id}`)}
              onEdit={(e) => openEdit(e, p)}
            />
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={e => e.target === e.currentTarget && setShowNew(false)}
        >
          <div className="bg-white border border-stone-200 rounded-xl w-96 shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-medium text-stone-800 mb-1">New Project</h2>
              <p className="text-xs text-stone-400 mb-5">Give your project a name to get started</p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Name *</label>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createProject()}
                    placeholder="e.g. Wedding Reception Playlist"
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
                  />
                  {newName.trim() && projects.some(p => p.name.toLowerCase() === newName.trim().toLowerCase()) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                      A project with this name already exists — are you sure?
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Location</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    placeholder="e.g. Tokyo, Japan"
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 border border-stone-200 text-stone-500 text-xs font-medium py-2 rounded-md hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={!newName.trim() || saving}
                className="flex-1 bg-stone-800 text-white text-xs font-medium py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={e => e.target === e.currentTarget && setEditTarget(null)}
        >
          <div className="bg-white border border-stone-200 rounded-xl w-96 shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-medium text-stone-800 mb-1">Edit Project</h2>
              <p className="text-xs text-stone-400 mb-5">{editTarget.name}</p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Name *</label>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
                  />
                  {editName.trim() && projects.some(p => p.id !== editTarget.id && p.name.toLowerCase() === editName.trim().toLowerCase()) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                      A project with this name already exists — are you sure?
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Location</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
                  >
                    {Object.entries(STATUSES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 pb-4 pt-2 border-t border-stone-100 mt-2">
              <p className="text-xs text-stone-400 mb-2">Danger zone</p>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="w-full border border-red-200 text-red-400 text-xs font-medium py-2 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>

            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 border border-stone-200 text-stone-500 text-xs font-medium py-2 rounded-md hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={!editName.trim() || saving}
                className="flex-1 bg-stone-800 text-white text-xs font-medium py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, onClick, onEdit }) {
  const status = STATUSES[project.status] || STATUSES.unedited
  const trackCount = project.audio_tracks?.length || 0

  return (
    <div className="cursor-pointer group relative" onClick={onClick}>
      <button
        onClick={onEdit}
        className="absolute top-2 left-2 z-10 w-6 h-6 bg-black/20 hover:bg-black/50 text-white rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
      >
        ✎
      </button>

      <div className="relative w-full aspect-[4/3] mb-3">
        <div className="absolute inset-0 bg-stone-200 border border-stone-300 rounded-lg rotate-3 opacity-50" />
        <div className="absolute inset-0 bg-stone-100 border border-stone-300 rounded-lg rotate-1 opacity-70" />
        <div className="absolute inset-0 bg-white border border-stone-200 rounded-lg overflow-hidden shadow-sm group-hover:-translate-y-1 group-hover:shadow-md transition-all duration-200">
          <div className="w-full h-full flex items-center justify-center bg-stone-50">
            <span className="text-4xl text-stone-200">♩</span>
          </div>
          <div className="absolute top-2 right-2 bg-black/25 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded font-mono">
            {trackCount}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: status.color }} />
        </div>
      </div>

      <p className="text-sm font-medium text-stone-700 truncate mb-1">{project.name}</p>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: status.color }} />
        <span className="text-xs text-stone-400">{status.label}</span>
        {project.event_date && (
          <span className="text-xs text-stone-300">
            · {new Date(project.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}
