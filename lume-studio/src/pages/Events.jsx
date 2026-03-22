import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { fetchEvents() }, [])

  async function fetchEvents() {
    const { data } = await supabase
      .from('events')
      .select('id, name, date, location, cover_image, created_at')
      .order('created_at', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  function notifySidebar() {
    window.dispatchEvent(new CustomEvent('lume-events-updated'))
  }

  async function handleCreate(fields) {
    const { data, error } = await supabase.from('events').insert(fields).select().single()
    if (!error && data) {
      setEvents(prev => [data, ...prev])
      notifySidebar()
      setShowCreate(false)
      navigate(`/events/${data.id}`)
    }
  }

  async function handleEdit(fields) {
    const { data, error } = await supabase
      .from('events')
      .update(fields)
      .eq('id', editTarget.id)
      .select()
      .single()
    if (!error && data) {
      setEvents(prev => prev.map(e => e.id === data.id ? data : e))
      notifySidebar()
      setEditTarget(null)
    }
  }

  async function handleDelete() {
    await supabase.from('events').delete().eq('id', deleteTarget.id)
    setEvents(prev => prev.filter(e => e.id !== deleteTarget.id))
    notifySidebar()
    setDeleteTarget(null)
  }

  return (
    <div className="p-7 max-w-4xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Studio</p>
          <h1 className="font-serif text-3xl text-stone-800">Events</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + New Event
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-4xl mb-4">◈</p>
          <p className="text-sm font-medium mb-1">No events yet</p>
          <p className="text-xs">Create an event to organise your shoots, trips, and sessions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {events.map(ev => (
            <EventCard
              key={ev.id}
              event={ev}
              onClick={() => navigate(`/events/${ev.id}`)}
              onEdit={(e) => { e.stopPropagation(); setEditTarget(ev) }}
              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(ev) }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <EventModal
          title="New Event"
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editTarget && (
        <EventModal
          title="Edit Event"
          initial={editTarget}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
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

function EventCard({ event, onClick, onEdit, onDelete }) {
  const dateStr = event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <button
      onClick={onClick}
      className="group relative text-left bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-stone-300 hover:shadow-sm transition-all"
    >
      {/* Cover image or placeholder */}
      <div className="aspect-video bg-stone-100 overflow-hidden">
        {event.cover_image ? (
          <img src={event.cover_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl text-stone-200">◈</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-stone-700 truncate">{event.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {dateStr && <span className="text-xs text-stone-400">{dateStr}</span>}
          {event.location && (
            <>
              {dateStr && <span className="text-stone-200 text-xs">·</span>}
              <span className="text-xs text-stone-400 truncate">{event.location}</span>
            </>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
        <button
          onClick={onEdit}
          className="w-6 h-6 rounded bg-white/90 text-stone-500 hover:text-stone-800 flex items-center justify-center text-xs shadow-sm transition-colors"
          title="Edit"
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded bg-white/90 text-stone-400 hover:text-red-500 flex items-center justify-center text-xs shadow-sm transition-colors"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </button>
  )
}

function EventModal({ title, initial = {}, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '')
  const [date, setDate] = useState(initial.date || '')
  const [location, setLocation] = useState(initial.location || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), date: date || null, location: location.trim() || null })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Summer Road Trip"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
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
              placeholder="e.g. Lisbon, Portugal"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? 'Saving…' : 'Save'}
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
        <h2 className="font-serif text-xl text-stone-800 mb-2">Delete event?</h2>
        <p className="text-sm text-stone-500 mb-6">
          "<span className="font-medium text-stone-700">{name}</span>" will be deleted. Collections and posts inside won't be deleted — just unlinked from this event.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">
            Delete
          </button>
        </div>
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
