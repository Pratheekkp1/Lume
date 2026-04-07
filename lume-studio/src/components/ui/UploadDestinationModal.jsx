import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function UploadDestinationModal({ mode, fileCount, onSelect, onCancel }) {
  // mode: 'album' | 'project' | 'both'
  const navigate = useNavigate()
  const [albums, setAlbums] = useState([])
  const [projects, setProjects] = useState([])
  const [search, setSearch] = useState('')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [creating, setCreating] = useState(null) // 'album' | 'project' | null
  const [newName, setNewName] = useState('')

  const needsAlbum = mode === 'album' || mode === 'both'
  const needsProject = mode === 'project' || mode === 'both'

  useEffect(() => {
    async function fetch() {
      const promises = []
      if (needsAlbum) promises.push(supabase.from('collections').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }))
      else promises.push(Promise.resolve({ data: [] }))
      if (needsProject) promises.push(supabase.from('audio_projects').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }))
      else promises.push(Promise.resolve({ data: [] }))

      const [albumRes, projectRes] = await Promise.all(promises)
      setAlbums(albumRes.data || [])
      setProjects(projectRes.data || [])
    }
    fetch()
  }, [])

  async function handleCreate(type) {
    if (!newName.trim()) return
    if (type === 'album') {
      const { data } = await supabase.from('collections').insert({ name: newName.trim(), status: 'unedited' }).select().single()
      if (data) {
        setAlbums(prev => [data, ...prev])
        setSelectedAlbum(data.id)
      }
    } else {
      const { data } = await supabase.from('audio_projects').insert({ name: newName.trim(), status: 'idea' }).select().single()
      if (data) {
        setProjects(prev => [data, ...prev])
        setSelectedProject(data.id)
      }
    }
    setCreating(null)
    setNewName('')
  }

  function handleConfirm() {
    if (needsAlbum && !selectedAlbum) return
    if (needsProject && !selectedProject) return
    onSelect({ albumId: selectedAlbum, projectId: selectedProject })
  }

  const canConfirm = (!needsAlbum || selectedAlbum) && (!needsProject || selectedProject)

  function filterList(list) {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(item => item.name.toLowerCase().includes(q))
  }

  function renderList(items, selectedId, onItemSelect, type) {
    const filtered = filterList(items)
    return (
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {filtered.map(item => (
          <button
            key={item.id}
            onClick={() => onItemSelect(item.id)}
            className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedId === item.id
                ? 'bg-teal-50 border border-teal-200 text-stone-800'
                : 'hover:bg-stone-50 text-stone-600'
            }`}
          >
            {item.name}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-stone-400 px-3 py-2">No matches</p>
        )}
        {creating === type ? (
          <div className="flex gap-2 px-1 mt-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate(type)}
              placeholder={type === 'album' ? 'Album name...' : 'Project name...'}
              className="flex-1 text-sm px-2 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
            />
            <button onClick={() => handleCreate(type)} className="text-xs px-2 py-1.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
              Add
            </button>
            <button onClick={() => { setCreating(null); setNewName('') }} className="text-xs px-2 py-1.5 text-stone-400 hover:text-stone-600">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(type)}
            className="text-left px-3 py-2 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
          >
            + Create new {type === 'album' ? 'album' : 'audio collection'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-base font-serif text-stone-800">
            Choose destination for {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </h3>
        </div>

        <div className="px-6 pb-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full text-sm px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
          />
        </div>

        <div className="px-6 pb-4 space-y-4">
          {needsAlbum && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2 uppercase tracking-wider">
                {mode === 'both' ? 'Photos & Videos' : 'Upload to Album'}
              </p>
              {renderList(albums, selectedAlbum, setSelectedAlbum, 'album')}
            </div>
          )}
          {needsProject && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2 uppercase tracking-wider">
                {mode === 'both' ? 'Audio Files' : 'Upload to Audio Collection'}
              </p>
              {renderList(projects, selectedProject, setSelectedProject, 'project')}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 text-sm py-2 border border-stone-200 text-stone-500 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 text-sm py-2 rounded-lg transition-colors ${
              canConfirm
                ? 'bg-teal-500 text-white hover:bg-teal-600'
                : 'bg-stone-100 text-stone-300 cursor-not-allowed'
            }`}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  )
}
