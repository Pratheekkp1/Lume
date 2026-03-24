import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { STATUSES } from '../lib/constants'

export default function PhotoCollections() {
  const [collections, setCollections] = useState([])
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

  useEffect(() => { fetchCollections() }, [])

  async function fetchCollections() {
    const { data, error } = await supabase
      .from('collections')
      .select('*, photos!collection_id(id, file_size)')
      .order('created_at', { ascending: false })
    if (!error && data) {
      const coverIds = data.filter(c => c.cover_photo_id).map(c => c.cover_photo_id)
      let coverMap = {}
      if (coverIds.length > 0) {
        const { data: coverPhotos } = await supabase
          .from('photos')
          .select('id, file_path')
          .in('id', coverIds)
        if (coverPhotos) {
          coverPhotos.forEach(p => {
            coverMap[p.id] = supabase.storage.from('Photos').getPublicUrl(p.file_path).data.publicUrl
          })
        }
      }
      setCollections(data.map(c => ({
        ...c,
        cover_url: c.cover_photo_id ? coverMap[c.cover_photo_id] || null : null,
      })))
    }
    setLoading(false)
  }

  async function createCollection() {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('collections').insert({
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
      fetchCollections()
      window.dispatchEvent(new CustomEvent('lume-collections-updated'))
    }
    setSaving(false)
  }

  function openEdit(e, collection) {
    e.stopPropagation()
    setEditTarget(collection)
    setEditName(collection.name)
    setEditDate(collection.event_date ? collection.event_date.slice(0, 10) : '')
    setEditLocation(collection.location || '')
    setEditStatus(collection.status || 'unedited')
  }

  async function saveEdit() {
    if (!editName.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('collections')
      .update({
        name: editName.trim(),
        event_date: editDate || null,
        location: editLocation || null,
        status: editStatus,
      })
      .eq('id', editTarget.id)
    if (!error) {
      setEditTarget(null)
      fetchCollections()
      window.dispatchEvent(new CustomEvent('lume-collections-updated'))
    }
    setSaving(false)
  }

  async function deleteCollection() {
    if (!editTarget) return
    setDeleting(true)
    // delete photos records first
    await supabase.from('photos').delete().eq('collection_id', editTarget.id)
    // then delete collection
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', editTarget.id)
    if (!error) {
      setEditTarget(null)
      fetchCollections()
      window.dispatchEvent(new CustomEvent('lume-collections-updated'))
    }
    setDeleting(false)
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Library</p>
          <h1 className="font-serif text-3xl text-stone-800">Collections</h1>
          <p className="text-xs text-stone-400 mt-1">
            {collections.length} collection{collections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + New Collection
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-stone-500 text-sm mb-1">No collections yet</p>
          <p className="text-stone-400 text-xs">Create your first collection to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {collections.map(c => (
            <CollectionCard
              key={c.id}
              collection={c}
              onClick={() => navigate(`/collections/${c.id}`)}
              onEdit={(e) => openEdit(e, c)}
            />
          ))}
        </div>
      )}

      {/* New Collection Modal */}
      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={e => e.target === e.currentTarget && setShowNew(false)}
        >
          <div className="bg-white border border-stone-200 rounded-xl w-96 shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-medium text-stone-800 mb-1">New Collection</h2>
              <p className="text-xs text-stone-400 mb-5">Give your collection a name to get started</p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Name *</label>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createCollection()}
                    placeholder="e.g. Wedding — Mia & Tom"
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
                  />
                  {newName.trim() && collections.some(c => c.name.toLowerCase() === newName.trim().toLowerCase()) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                      A collection with this name already exists — are you sure?
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
                onClick={createCollection}
                disabled={!newName.trim() || saving}
                className="flex-1 bg-stone-800 text-white text-xs font-medium py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Creating...' : 'Create Collection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Collection Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={e => e.target === e.currentTarget && setEditTarget(null)}
        >
          <div className="bg-white border border-stone-200 rounded-xl w-96 shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-medium text-stone-800 mb-1">Edit Collection</h2>
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
                  {editName.trim() && collections.some(c => c.id !== editTarget.id && c.name.toLowerCase() === editName.trim().toLowerCase()) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                      A collection with this name already exists — are you sure?
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

            {/* Delete zone */}
            <div className="px-6 pb-4 pt-2 border-t border-stone-100 mt-2">
              <p className="text-xs text-stone-400 mb-2">Danger zone</p>
              <button
                onClick={deleteCollection}
                disabled={deleting}
                className="w-full border border-red-200 text-red-400 text-xs font-medium py-2 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Collection'}
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

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function CollectionCard({ collection, onClick, onEdit }) {
  const status = STATUSES[collection.status] || STATUSES.unedited
  const photoCount = collection.photos?.length || 0
  const totalSize = (collection.photos || []).reduce((sum, p) => sum + (p.file_size || 0), 0)
  const sizeLabel = fmtBytes(totalSize)

  return (
    <div className="cursor-pointer group relative" onClick={onClick}>
      {/* Edit button */}
      <button
        onClick={onEdit}
        className="absolute top-2 left-2 z-10 w-6 h-6 bg-black/20 hover:bg-black/50 text-white rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
      >
        ✎
      </button>

      {/* Stacked card effect */}
      <div className="relative w-full aspect-[4/3] mb-3">
        <div className="absolute inset-0 bg-stone-200 border border-stone-300 rounded-lg rotate-3 opacity-50" />
        <div className="absolute inset-0 bg-stone-100 border border-stone-300 rounded-lg rotate-1 opacity-70" />
        <div className="absolute inset-0 bg-white border border-stone-200 rounded-lg overflow-hidden shadow-sm group-hover:-translate-y-1 group-hover:shadow-md transition-all duration-200">
          {collection.cover_url ? (
            <img src={collection.cover_url} alt={collection.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-50">
              <span className="text-3xl text-stone-200">◻</span>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-black/25 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded font-mono">
            {photoCount}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: status.color }} />
        </div>
      </div>

      <p className="text-sm font-medium text-stone-700 truncate mb-1">{collection.name}</p>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: status.color }} />
        <span className="text-xs text-stone-400">{status.label}</span>
        {collection.event_date && (
          <span className="text-xs text-stone-300">
            · {new Date(collection.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
        {sizeLabel && (
          <span className="text-xs text-stone-300">· {sizeLabel}</span>
        )}
      </div>
    </div>
  )
}