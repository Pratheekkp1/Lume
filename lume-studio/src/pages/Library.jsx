import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { STATUSES, SOUND_STATUSES } from '../lib/constants'
import { softDelete, ENTITY_TYPES } from '../lib/trash'

export default function Library() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [albums, setAlbums] = useState([])
  const [soundProjects, setSoundProjects] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all')
  const [filterEvent, setFilterEvent] = useState('all')

  // Album CRUD state
  const [showNewAlbum, setShowNewAlbum] = useState(false)
  const [editAlbumTarget, setEditAlbumTarget] = useState(null)
  const [showManageEvents, setShowManageEvents] = useState(false)

  // Sound project CRUD state
  const [showNewSound, setShowNewSound] = useState(false)
  const [editSoundTarget, setEditSoundTarget] = useState(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [albumResult, soundResult, eventResult] = await Promise.all([
      supabase
        .from('collections')
        .select('*, photos!collection_id(id, file_size), events(id, name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('audio_projects')
        .select('id, name, status, created_at, description, project_date, audio_categories(category:categories(id,name,color))')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('id, name, date, location')
        .order('created_at', { ascending: false }),
    ])

    // Process albums with cover photos
    if (!albumResult.error && albumResult.data) {
      const coverIds = albumResult.data.filter(c => c.cover_photo_id).map(c => c.cover_photo_id)
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
      setAlbums(albumResult.data.map(c => ({
        ...c,
        cover_url: c.cover_photo_id ? coverMap[c.cover_photo_id] || null : null,
        event_name: c.events?.name || null,
      })))
    }

    setSoundProjects(soundResult.data || [])
    setEvents(eventResult.data || [])
    setLoading(false)
  }

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent('lume-media-updated'))
  }

  // ── Album CRUD ──────────────────────────────────────────────────────────────

  async function createAlbum(fields) {
    const { error } = await supabase.from('collections').insert(fields)
    if (!error) {
      setShowNewAlbum(false)
      fetchAll()
      notifyUpdated()
    }
  }

  async function saveAlbumEdit(fields) {
    const { error } = await supabase.from('collections').update(fields).eq('id', editAlbumTarget.id)
    if (!error) {
      setEditAlbumTarget(null)
      fetchAll()
      notifyUpdated()
    }
  }

  async function deleteAlbum() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setAlbums(prev => prev.filter(a => a.id !== target.id))
    await softDelete(ENTITY_TYPES.COLLECTION, target.id, target.name)
  }

  // ── Sound CRUD ──────────────────────────────────────────────────────────────

  async function createSound(fields) {
    const { data, error } = await supabase
      .from('audio_projects')
      .insert(fields)
      .select('id, name, status, created_at')
      .single()
    if (!error && data) {
      setShowNewSound(false)
      setSoundProjects(prev => [data, ...prev])
      navigate(`/sounds/${data.id}`)
    }
  }

  async function saveSoundEdit(fields) {
    const { error } = await supabase.from('audio_projects').update(fields).eq('id', editSoundTarget.id)
    if (!error) {
      setSoundProjects(prev => prev.map(p => p.id === editSoundTarget.id ? { ...p, ...fields } : p))
      setEditSoundTarget(null)
    }
  }

  async function deleteSound() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setSoundProjects(prev => prev.filter(p => p.id !== target.id))
    await softDelete(ENTITY_TYPES.AUDIO_PROJECT, target.id, target.name)
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const showAlbums = typeFilter === 'all' || typeFilter === 'albums'
  const showSounds = typeFilter === 'all' || typeFilter === 'sounds'

  const filteredAlbums = filterEvent === 'all'
    ? albums
    : filterEvent === 'none'
      ? albums.filter(a => !a.event_id)
      : albums.filter(a => a.event_id === filterEvent)

  const totalCount = albums.length + soundProjects.length

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-serif text-3xl text-stone-800">Library</h1>
          <p className="text-xs text-stone-400 mt-1">
            {albums.length} album{albums.length !== 1 ? 's' : ''} · {soundProjects.length} sound project{soundProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showAlbums && (
            <button
              onClick={() => setShowNewAlbum(true)}
              className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
            >
              + New Album
            </button>
          )}
          {showSounds && (
            <button
              onClick={() => setShowNewSound(true)}
              className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
            >
              + New Sound Project
            </button>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'albums', label: 'Albums' },
          { key: 'sounds', label: 'Sound Projects' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => { setTypeFilter(f.key); setFilterEvent('all') }}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              typeFilter === f.key
                ? 'bg-teal-500 text-white border-teal-500'
                : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Event filter — only when albums visible */}
      {showAlbums && events.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-stone-300 mr-1">Event</span>
          <button
            onClick={() => setFilterEvent('all')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
              filterEvent === 'all'
                ? 'bg-stone-700 text-white border-stone-700'
                : 'border-stone-200 text-stone-400 hover:border-stone-400'
            }`}
          >
            All
          </button>
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => setFilterEvent(filterEvent === ev.id ? 'all' : ev.id)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                filterEvent === ev.id
                  ? 'bg-stone-700 text-white border-stone-700'
                  : 'border-stone-200 text-stone-400 hover:border-stone-400'
              }`}
            >
              {ev.name}
            </button>
          ))}
          <button
            onClick={() => setFilterEvent(filterEvent === 'none' ? 'all' : 'none')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
              filterEvent === 'none'
                ? 'bg-stone-700 text-white border-stone-700'
                : 'border-stone-200 text-stone-400 hover:border-stone-400'
            }`}
          >
            Ungrouped
          </button>
          <button
            onClick={() => setShowManageEvents(true)}
            className="px-2.5 py-0.5 text-[11px] text-stone-400 hover:text-teal-700 transition-colors"
          >
            Manage Events
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : totalCount === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-4xl mb-4">◻</p>
          <p className="text-sm font-medium mb-1">Your library is empty</p>
          <p className="text-xs">Create an album or sound project to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Albums section */}
          {showAlbums && filteredAlbums.length > 0 && (
            <div>
              {typeFilter === 'all' && (
                <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">Albums</h2>
              )}
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredAlbums.map(album => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => navigate(`/media/${album.id}`)}
                    onEdit={(e) => { e.stopPropagation(); setEditAlbumTarget(album) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sound Projects section */}
          {showSounds && soundProjects.length > 0 && (
            <div>
              {typeFilter === 'all' && (
                <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3">Sound Projects</h2>
              )}
              <div className="max-w-2xl flex flex-col gap-2">
                {soundProjects.map(project => (
                  <SoundCard
                    key={project.id}
                    project={project}
                    onClick={() => navigate(`/sounds/${project.id}`)}
                    onEdit={(e) => { e.stopPropagation(); setEditSoundTarget(project) }}
                    onDelete={(e) => { e.stopPropagation(); setDeleteTarget({ ...project, _type: 'sound' }) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty states for filtered views */}
          {showAlbums && filteredAlbums.length === 0 && albums.length > 0 && (
            <p className="text-sm text-stone-400 text-center py-8">No albums match this filter.</p>
          )}
          {showAlbums && albums.length === 0 && (
            <div className="text-center py-12 text-stone-400">
              <p className="text-3xl mb-3">◻</p>
              <p className="text-sm font-medium mb-1">No albums yet</p>
              <p className="text-xs">Create an album to start organizing your shoots.</p>
            </div>
          )}
          {showSounds && soundProjects.length === 0 && (
            <div className="text-center py-12 text-stone-400">
              <p className="text-3xl mb-3">♩</p>
              <p className="text-sm font-medium mb-1">No sound projects yet</p>
              <p className="text-xs">Start organizing your music and audio.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}

      {showNewAlbum && (
        <CreateAlbumModal
          events={events}
          albums={albums}
          onSave={createAlbum}
          onClose={() => setShowNewAlbum(false)}
        />
      )}

      {editAlbumTarget && (
        <EditAlbumModal
          album={editAlbumTarget}
          events={events}
          albums={albums}
          onSave={saveAlbumEdit}
          onDelete={() => { setDeleteTarget({ ...editAlbumTarget, _type: 'album' }); setEditAlbumTarget(null) }}
          onClose={() => setEditAlbumTarget(null)}
        />
      )}

      {showNewSound && (
        <CreateSoundModal
          onSave={createSound}
          onClose={() => setShowNewSound(false)}
        />
      )}

      {editSoundTarget && (
        <EditSoundModal
          project={editSoundTarget}
          onSave={saveSoundEdit}
          onDelete={() => { setDeleteTarget({ ...editSoundTarget, _type: 'sound' }); setEditSoundTarget(null) }}
          onClose={() => setEditSoundTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          type={deleteTarget._type === 'album' ? 'album' : 'sound project'}
          onConfirm={deleteTarget._type === 'album' ? deleteAlbum : deleteSound}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

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

// ── Album Card ────────────────────────────────────────────────────────────────

function AlbumCard({ album, onClick, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = STATUSES[album.status] || STATUSES.unedited
  const photoCount = album.photos?.length || 0
  const totalSize = (album.photos || []).reduce((sum, p) => sum + (p.file_size || 0), 0)
  const sizeLabel = fmtBytes(totalSize)

  return (
    <div className="cursor-pointer group relative" onClick={onClick}>
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="w-6 h-6 bg-black/25 hover:bg-black/50 text-white rounded flex items-center justify-center text-xs backdrop-blur-sm transition-colors"
        >
          ⋮
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
            <div className="absolute top-7 left-0 z-20 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[120px]">
              <button
                onClick={(e) => { setMenuOpen(false); onEdit(e) }}
                className="w-full text-left px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Edit Album
              </button>
            </div>
          </>
        )}
      </div>

      <div className="relative w-full aspect-[4/3] mb-3">
        <div className="absolute inset-0 bg-stone-200 border border-stone-300 rounded-lg rotate-3 opacity-50" />
        <div className="absolute inset-0 bg-stone-100 border border-stone-300 rounded-lg rotate-1 opacity-70" />
        <div className="absolute inset-0 bg-white border border-stone-200 rounded-lg overflow-hidden shadow-sm group-hover:-translate-y-1 group-hover:shadow-md transition duration-200">
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
          <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">
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

// ── Sound Card ────────────────────────────────────────────────────────────────

function SoundCard({ project, onClick, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = SOUND_STATUSES[project.status]
  const cats = (project.audio_categories || []).map(ac => ac.category).filter(Boolean)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300 hover:shadow-sm transition text-left"
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

// ── Create Album Modal ────────────────────────────────────────────────────────

function CreateAlbumModal({ events, albums, onSave, onClose }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState('unedited')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      event_date: date || null,
      location: location || null,
      event_id: eventId || null,
      status,
      description: description.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">New Album</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Beach Shoot — Sunset"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
            {name.trim() && albums.some(a => a.name.toLowerCase() === name.trim().toLowerCase()) && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-teal-600">
                <span className="w-3.5 h-3.5 rounded-full bg-teal-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                An album with this name already exists — are you sure?
              </div>
            )}
          </Field>
          <Field label="Status">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUSES).map(([key, s]) => (
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
          <Field label="Event">
            <select
              value={eventId}
              onChange={e => setEventId(e.target.value)}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
            >
              <option value="">None</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Tokyo, Japan"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
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

// ── Edit Album Modal ──────────────────────────────────────────────────────────

function EditAlbumModal({ album, events, albums, onSave, onDelete, onClose }) {
  const [name, setName] = useState(album.name)
  const [date, setDate] = useState(album.event_date ? album.event_date.slice(0, 10) : '')
  const [location, setLocation] = useState(album.location || '')
  const [status, setStatus] = useState(album.status || 'unedited')
  const [eventId, setEventId] = useState(album.event_id || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      event_date: date || null,
      location: location || null,
      status,
      event_id: eventId || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-6">
          <h2 className="font-serif text-xl text-stone-800 mb-1">Edit Album</h2>
          <p className="text-xs text-stone-400 mb-5">{album.name}</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Name">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
              />
              {name.trim() && albums.some(a => a.id !== album.id && a.name.toLowerCase() === name.trim().toLowerCase()) && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-teal-600">
                  <span className="w-3.5 h-3.5 rounded-full bg-teal-400 text-white flex items-center justify-center text-[9px] flex-shrink-0 mt-px">!</span>
                  An album with this name already exists — are you sure?
                </div>
              )}
            </Field>
            <Field label="Event">
              <select
                value={eventId}
                onChange={e => setEventId(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
              >
                <option value="">None</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
              />
            </Field>
            <Field label="Location">
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
              >
                {Object.entries(STATUSES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </Field>
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
            onClick={onDelete}
            className="w-full border border-red-200 text-red-400 text-xs font-medium py-2 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
          >
            Delete Album
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Sound Modal ────────────────────────────────────────────────────────

function CreateSoundModal({ onSave, onClose }) {
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

// ── Edit Sound Modal ──────────────────────────────────────────────────────────

function EditSoundModal({ project, onSave, onDelete, onClose }) {
  const [name, setName] = useState(project.name || '')
  const [status, setStatus] = useState(project.status || 'idea')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), status })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-6">
          <h2 className="font-serif text-xl text-stone-800 mb-1">Edit Sound Project</h2>
          <p className="text-xs text-stone-400 mb-5">{project.name}</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Name">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400 transition-colors"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
              >
                {Object.entries(SOUND_STATUSES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </Field>
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
            onClick={onDelete}
            className="w-full border border-red-200 text-red-400 text-xs font-medium py-2 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmDelete({ name, type, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-2">Delete {type}?</h2>
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
              className="self-end bg-teal-500 text-white text-xs font-medium px-4 py-1.5 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Adding…' : 'Add Event'}
            </button>
          </div>
        </div>

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
                      <button onClick={saveEdit} className="text-xs text-teal-700 hover:text-teal-800 font-medium transition-colors">Save</button>
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

// ── Shared ────────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">{label}</label>
      {children}
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
