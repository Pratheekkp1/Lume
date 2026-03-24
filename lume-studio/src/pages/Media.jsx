import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { STATUSES } from '../lib/constants'

export default function Media() {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterEvent, setFilterEvent] = useState('all')

  // Album CRUD state
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newEventId, setNewEventId] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit album state
  const [editTarget, setEditTarget] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStatus, setEditStatus] = useState('unedited')
  const [editEventId, setEditEventId] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Manage events modal
  const [showManageEvents, setShowManageEvents] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: albumData, error: albumErr }, { data: eventData }] = await Promise.all([
      supabase
        .from('collections')
        .select('*, photos!collection_id(id, file_size), events(id, name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('id, name, date, location')
        .order('created_at', { ascending: false }),
    ])

    if (!albumErr && albumData) {
      const coverIds = albumData.filter(c => c.cover_photo_id).map(c => c.cover_photo_id)
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
      setAlbums(albumData.map(c => ({
        ...c,
        cover_url: c.cover_photo_id ? coverMap[c.cover_photo_id] || null : null,
        event_name: c.events?.name || null,
      })))
    }

    setEvents(eventData || [])
    setLoading(false)
  }

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent('lume-media-updated'))
  }

  // ── Album CRUD ──────────────────────────────────────────────────────────────

  async function createAlbum() {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('collections').insert({
      name: newName.trim(),
      event_date: newDate || null,
      location: newLocation || null,
      event_id: newEventId || null,
      status: 'unedited',
    })
    if (!error) {
      setShowNew(false)
      setNewName(''); setNewDate(''); setNewLocation(''); setNewEventId('')
      fetchAll()
      notifyUpdated()
    }
    setSaving(false)
  }

  function openEdit(e, album) {
    e.stopPropagation()
    setEditTarget(album)
    setEditName(album.name)
    setEditDate(album.event_date ? album.event_date.slice(0, 10) : '')
    setEditLocation(album.location || '')
    setEditStatus(album.status || 'unedited')
    setEditEventId(album.event_id || '')
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
        event_id: editEventId || null,
      })
      .eq('id', editTarget.id)
    if (!error) {
      setEditTarget(null)
      fetchAll()
      notifyUpdated()
    }
    setSaving(false)
  }

  async function deleteAlbum() {
    if (!editTarget) return
    setDeleting(true)
    await supabase.from('photos').delete().eq('collection_id', editTarget.id)
    const { error } = await supabase.from('collections').delete().eq('id', editTarget.id)
    if (!error) {
      setEditTarget(null)
      fetchAll()
      notifyUpdated()
    }
    setDeleting(false)
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = filterEvent === 'all'
    ? albums
    : filterEvent === 'none'
      ? albums.filter(a => !a.event_id)
      : albums.filter(a => a.event_id === filterEvent)

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-serif text-3xl text-stone-800">Media</h1>
          <p className="text-xs text-stone-400 mt-1">
            {albums.length} album{albums.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + New Album
        </button>
      </div>

      {/* Event filter bar */}
      {events.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterEvent('all')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              filterEvent === 'all'
                ? 'bg-stone-800 text-white border-stone-800'
                : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
          >
            All
          </button>
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => setFilterEvent(filterEvent === ev.id ? 'all' : ev.id)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                filterEvent === ev.id
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'border-stone-200 text-stone-500 hover:border-stone-400'
              }`}
            >
              {ev.name}
            </button>
          ))}
          <button
            onClick={() => setFilterEvent(filterEvent === 'none' ? 'all' : 'none')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              filterEvent === 'none'
                ? 'bg-stone-800 text-white border-stone-800'
                : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
          >
            Ungrouped
          </button>
          <button
            onClick={() => setShowManageEvents(true)}
            className="px-3 py-1 text-xs text-stone-400 hover:text-amber-700 transition-colors"
          >
            Manage Events
          </button>
        </div>
      )}

      {/* Album grid */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl text-stone-200 mb-4">◻</p>
          <p className="text-stone-500 text-sm mb-1">
            {filterEvent !== 'all' ? 'No albums in this group' : 'Your media library is empty'}
          </p>
          <p className="text-stone-400 text-xs">
            {filterEvent !== 'all' ? 'Try a different filter or create a new album.' : 'Create an album to start organizing your shoots.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map(album => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => navigate(`/media/${album.id}`)}
              onEdit={(e) => openEdit(e, album)}
            />
          ))}
        </div>
      )}

      {/* New Album Modal */}
      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={e => e.target === e.currentTarget && setShowNew(false)}
        >
          <div className="bg-white border border-stone-200 rounded-xl w-96 shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-medium text-stone-800 mb-1">New Album</h2>
              <p className="text-xs text-stone-400 mb-5">Give your album a name to get started</p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Name *</label>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createAlbum()}
                    placeholder="e.g. Beach Shoot — Sunset"
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
                  />
                  {newName.trim() && albums.some(a => a.name.toLowerCase() === newName.trim().toLowerCase()) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                      An album with this name already exists — are you sure?
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Event</label>
                  <select
                    value={newEventId}
                    onChange={e => setNewEventId(e.target.value)}
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
                  >
                    <option value="">None</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
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
                onClick={createAlbum}
                disabled={!newName.trim() || saving}
                className="flex-1 bg-stone-800 text-white text-xs font-medium py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Creating...' : 'Create Album'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Album Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={e => e.target === e.currentTarget && setEditTarget(null)}
        >
          <div className="bg-white border border-stone-200 rounded-xl w-96 shadow-xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-medium text-stone-800 mb-1">Edit Album</h2>
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
                  {editName.trim() && albums.some(a => a.id !== editTarget.id && a.name.toLowerCase() === editName.trim().toLowerCase()) && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                      An album with this name already exists — are you sure?
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">Event</label>
                  <select
                    value={editEventId}
                    onChange={e => setEditEventId(e.target.value)}
                    className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
                  >
                    <option value="">None</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
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
                onClick={deleteAlbum}
                disabled={deleting}
                className="w-full border border-red-200 text-red-400 text-xs font-medium py-2 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Album'}
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

      {/* Manage Events Modal */}
      {showManageEvents && (
        <ManageEventsModal
          events={events}
          onClose={() => setShowManageEvents(false)}
          onUpdated={() => { fetchAll(); notifyUpdated() }}
        />
      )}
    </div>
  )
}

// ── Manage Events Modal ───────────────────────────────────────────────────────

function ManageEventsModal({ events, onClose, onUpdated }) {
  const [list, setList] = useState(events)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editLocation, setEditLocation] = useState('')

  async function createEvent() {
    if (!newName.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('events')
      .insert({ name: newName.trim(), date: newDate || null, location: newLocation.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setList(prev => [data, ...prev])
      setNewName(''); setNewDate(''); setNewLocation('')
      onUpdated()
    }
    setSaving(false)
  }

  function startEdit(ev) {
    setEditId(ev.id)
    setEditName(ev.name)
    setEditDate(ev.date || '')
    setEditLocation(ev.location || '')
  }

  async function saveEdit() {
    if (!editName.trim()) return
    const { data, error } = await supabase
      .from('events')
      .update({ name: editName.trim(), date: editDate || null, location: editLocation.trim() || null })
      .eq('id', editId)
      .select()
      .single()
    if (!error && data) {
      setList(prev => prev.map(e => e.id === data.id ? data : e))
      setEditId(null)
      onUpdated()
    }
  }

  async function deleteEvent(id) {
    await supabase.from('events').delete().eq('id', id)
    setList(prev => prev.filter(e => e.id !== id))
    onUpdated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white border border-stone-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-stone-100">
          <h2 className="text-lg font-medium text-stone-800 mb-1">Manage Events</h2>
          <p className="text-xs text-stone-400">Events group your albums by occasion, shoot, or trip.</p>
        </div>

        {/* Create new */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createEvent()}
              placeholder="New event name..."
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="flex-1 border border-stone-200 rounded-md px-3 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-400 transition-colors"
              />
              <input
                type="text"
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                placeholder="Location"
                className="flex-1 border border-stone-200 rounded-md px-3 py-1.5 text-xs text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <button
              onClick={createEvent}
              disabled={!newName.trim() || saving}
              className="self-end bg-stone-800 text-white text-xs font-medium px-4 py-1.5 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-xs text-stone-400 px-6 py-6 text-center">No events yet.</p>
          ) : (
            list.map(ev => (
              <div key={ev.id} className="px-6 py-3 border-b border-stone-50 flex items-center gap-3">
                {editId === ev.id ? (
                  <div className="flex-1 flex flex-col gap-1.5">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      className="w-full border border-stone-200 rounded-md px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="flex-1 border border-stone-200 rounded-md px-2.5 py-1 text-xs text-stone-700 outline-none focus:border-stone-400 transition-colors"
                      />
                      <input
                        value={editLocation}
                        onChange={e => setEditLocation(e.target.value)}
                        placeholder="Location"
                        className="flex-1 border border-stone-200 rounded-md px-2.5 py-1 text-xs text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditId(null)} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
                      <button onClick={saveEdit} className="text-xs text-amber-700 hover:text-amber-800 font-medium transition-colors">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 truncate">{ev.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {ev.date && <span className="text-xs text-stone-400">{ev.date}</span>}
                        {ev.location && <span className="text-xs text-stone-300 truncate">{ev.date ? ' · ' : ''}{ev.location}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(ev)}
                      className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex-shrink-0"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEvent(ev.id)}
                      className="text-xs text-stone-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-stone-100">
          <button
            onClick={onClose}
            className="w-full border border-stone-200 text-stone-500 text-xs font-medium py-2 rounded-md hover:bg-stone-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Album Card ────────────────────────────────────────────────────────────────

function AlbumCard({ album, onClick, onEdit }) {
  const status = STATUSES[album.status] || STATUSES.unedited
  const photoCount = album.photos?.length || 0
  const totalSize = (album.photos || []).reduce((sum, p) => sum + (p.file_size || 0), 0)
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
          {album.cover_url ? (
            <img src={album.cover_url} alt={album.name} className="w-full h-full object-cover" />
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

      <p className="text-sm font-medium text-stone-700 truncate mb-1">{album.name}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: status.color }} />
        <span className="text-xs text-stone-400">{status.label}</span>
        {album.event_name && (
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
            {album.event_name}
          </span>
        )}
        {album.event_date && (
          <span className="text-xs text-stone-300">
            · {new Date(album.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
        {sizeLabel && (
          <span className="text-xs text-stone-300">· {sizeLabel}</span>
        )}
      </div>
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
