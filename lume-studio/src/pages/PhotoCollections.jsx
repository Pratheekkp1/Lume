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
  const navigate = useNavigate()

  useEffect(() => {
    fetchCollections()
  }, [])

  async function fetchCollections() {
    const { data, error } = await supabase
      .from('collections')
      .select('*, photos(id)')
      .order('created_at', { ascending: false })
    if (!error) setCollections(data || [])
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
    }
    setSaving(false)
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Library</p>
          <h1 className="font-serif text-3xl text-stone-800">Photo Collections</h1>
          <p className="text-xs text-stone-400 mt-1">{collections.length} collections</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-amber-700 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + New Collection
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-stone-400 text-sm">Loading...</div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-4">◻</div>
          <p className="text-stone-500 text-sm mb-1">No collections yet</p>
          <p className="text-stone-400 text-xs">Create your first collection to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {collections.map(c => (
            <CollectionCard
              key={c.id}
              collection={c}
              onClick={() => navigate(`/photos/${c.id}`)}
            />
          ))}
        </div>
      )}

      {/* New Collection Modal */}
      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && setShowNew(false)}
        >
          <div className="bg-stone-50 border border-stone-200 rounded-xl w-96 p-6 shadow-xl">
            <h2 className="font-serif text-xl text-stone-800 mb-1">New Collection</h2>
            <p className="text-xs text-stone-400 mb-5">Give your collection a name to get started</p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-400 mb-1 block">Name *</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createCollection()}
                  placeholder="e.g. Wedding — Mia & Tom"
                  className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-amber-600 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-400 mb-1 block">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-600 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-400 mb-1 block">Location</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  placeholder="e.g. Tokyo, Japan"
                  className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-amber-600 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 border border-stone-200 text-stone-500 text-xs font-medium py-2 rounded-md hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCollection}
                disabled={!newName.trim() || saving}
                className="flex-1 bg-amber-700 text-white text-xs font-medium py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? 'Creating...' : 'Create Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CollectionCard({ collection, onClick }) {
  const status = STATUSES[collection.status] || STATUSES.unedited
  const photoCount = collection.photos?.length || 0

  return (
    <div className="cursor-pointer group" onClick={onClick}>
      <div className="relative w-full aspect-[4/3] mb-3">
        <div className="absolute inset-0 bg-stone-200 rounded-lg rotate-3 opacity-40" />
        <div className="absolute inset-0 bg-stone-300 rounded-lg rotate-1 opacity-60" />
        <div className="absolute inset-0 bg-stone-100 border border-stone-200 rounded-lg overflow-hidden shadow-sm group-hover:-translate-y-1 group-hover:shadow-md transition-all duration-200">
          {collection.cover_url ? (
            <img src={collection.cover_url} alt={collection.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
              <span className="text-3xl text-stone-300">◻</span>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded font-mono">
            {photoCount}
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-700 truncate">{collection.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: status.color }} />
          <span className="text-xs text-stone-400">{status.label}</span>
          {collection.event_date && (
            <span className="text-xs text-stone-300 ml-1">
              · {new Date(collection.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}