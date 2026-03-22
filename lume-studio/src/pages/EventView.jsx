import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, AUDIO_STATUSES } from '../lib/constants'
import { recordOpen } from '../lib/recentOpens'

const TABS = ['Photos', 'Posts', 'Audio']

export default function EventView() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'Photos'

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  // Tab data
  const [collections, setCollections] = useState([])
  const [posts, setPosts] = useState([])
  const [audioProjects, setAudioProjects] = useState([])

  // Modals
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showCreateAudio, setShowCreateAudio] = useState(false)

  useEffect(() => {
    fetchEvent()
    recordOpen('event', eventId)
  }, [eventId])

  useEffect(() => {
    if (event) fetchTabData(activeTab)
  }, [activeTab, event])

  async function fetchEvent() {
    const { data } = await supabase.from('events').select('*').eq('id', eventId).single()
    setEvent(data)
    setLoading(false)
  }

  async function fetchTabData(tab) {
    if (tab === 'Photos') {
      const { data } = await supabase
        .from('collections')
        .select('id, name, created_at, status, cover_photo_id, photos!collection_id(id)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
      setCollections(data || [])
    } else if (tab === 'Posts') {
      const { data } = await supabase
        .from('posts')
        .select('id, title, type, status, platform, created_at, post_categories(category:categories(id,name,color))')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
      setPosts(data || [])
    } else if (tab === 'Audio') {
      const { data } = await supabase
        .from('audio_projects')
        .select('id, name, status, created_at, audio_categories(category:categories(id,name,color))')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
      setAudioProjects(data || [])
    }
  }

  function setTab(tab) {
    setSearchParams({ tab })
  }

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading…</div>
  if (!event) return <div className="p-7 text-stone-400 text-sm">Event not found.</div>

  const dateStr = event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-7 pt-7 pb-0 border-b border-stone-200 bg-white">
        <button
          onClick={() => navigate('/events')}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors mb-3 inline-flex items-center gap-1"
        >
          ← Events
        </button>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="font-serif text-3xl text-stone-800">{event.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
              {dateStr && <span>{dateStr}</span>}
              {dateStr && event.location && <span>·</span>}
              {event.location && <span>{event.location}</span>}
            </div>
          </div>
          <div className="flex gap-2 pb-4">
            {activeTab === 'Photos' && (
              <button
                onClick={() => setShowAddCollection(true)}
                className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
              >
                + Collection
              </button>
            )}
            {activeTab === 'Posts' && (
              <button
                onClick={() => setShowCreatePost(true)}
                className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
              >
                + Post
              </button>
            )}
            {activeTab === 'Audio' && (
              <button
                onClick={() => setShowCreateAudio(true)}
                className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
              >
                + Audio
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`px-4 py-2 text-sm border-b-2 transition-all ${
                activeTab === tab
                  ? 'text-amber-700 border-amber-700 font-medium'
                  : 'text-stone-400 border-transparent hover:text-stone-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-7">
        {activeTab === 'Photos' && (
          <PhotosTab
            collections={collections}
            eventId={eventId}
            showAddCollection={showAddCollection}
            setShowAddCollection={setShowAddCollection}
            onCollectionCreated={(c) => { setCollections(prev => [c, ...prev]); setShowAddCollection(false) }}
            onNavigate={navigate}
          />
        )}
        {activeTab === 'Posts' && (
          <PostsTab
            posts={posts}
            eventId={eventId}
            showCreate={showCreatePost}
            setShowCreate={setShowCreatePost}
            onCreated={(p) => { setPosts(prev => [p, ...prev]); setShowCreatePost(false) }}
            onNavigate={navigate}
          />
        )}
        {activeTab === 'Audio' && (
          <AudioTab
            audioProjects={audioProjects}
            eventId={eventId}
            showCreate={showCreateAudio}
            setShowCreate={setShowCreateAudio}
            onCreated={(a) => { setAudioProjects(prev => [a, ...prev]); setShowCreateAudio(false) }}
            onNavigate={navigate}
          />
        )}
      </div>
    </div>
  )
}

// ─── Photos Tab ────────────────────────────────────────────────────────────────

function PhotosTab({ collections, eventId, showAddCollection, setShowAddCollection, onCollectionCreated, onNavigate }) {
  async function handleCreate(fields) {
    const { data, error } = await supabase
      .from('collections')
      .insert({ ...fields, event_id: eventId })
      .select()
      .single()
    if (!error && data) onCollectionCreated(data)
  }

  if (collections.length === 0 && !showAddCollection) {
    return (
      <EmptyState
        icon="◻"
        label="No photo collections"
        sub="Add a collection to organise photos from this event."
        action="+ Add Collection"
        onAction={() => setShowAddCollection(true)}
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {collections.map(col => {
          const photoCount = (col.photos || []).length
          return (
            <button
              key={col.id}
              onClick={() => onNavigate(`/photos/${col.id}`)}
              className="group text-left bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-stone-300 hover:shadow-sm transition-all"
            >
              <div className="aspect-video bg-stone-100 flex items-center justify-center">
                <span className="text-3xl text-stone-200">◻</span>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-stone-700 truncate">{col.name}</p>
                <p className="text-xs text-stone-400 mt-0.5">{photoCount} photo{photoCount !== 1 ? 's' : ''}</p>
              </div>
            </button>
          )
        })}
      </div>

      {showAddCollection && (
        <CollectionModal
          title="New Collection"
          onSave={handleCreate}
          onClose={() => setShowAddCollection(false)}
        />
      )}
    </>
  )
}

function CollectionModal({ title, onSave, onClose }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim() })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Collection name"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Posts Tab ─────────────────────────────────────────────────────────────────

function PostsTab({ posts, eventId, showCreate, setShowCreate, onCreated, onNavigate }) {
  async function handleCreate(fields) {
    const { data, error } = await supabase
      .from('posts')
      .insert({ ...fields, event_id: eventId })
      .select()
      .single()
    if (!error && data) onCreated(data)
  }

  if (posts.length === 0 && !showCreate) {
    return (
      <EmptyState
        icon="▷"
        label="No posts"
        sub="Create a post to track content being made for this event."
        action="+ New Post"
        onAction={() => setShowCreate(true)}
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {posts.map(post => {
          const status = POST_STATUSES[post.status]
          const cats = (post.post_categories || []).map(pc => pc.category).filter(Boolean)
          return (
            <button
              key={post.id}
              onClick={() => onNavigate(`/posts/${post.id}`)}
              className="group text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: status?.color + '30', color: status?.color }}
                >
                  {status?.label || post.status}
                </span>
                {post.platform && (
                  <span className="text-[10px] text-stone-400">{post.platform}</span>
                )}
              </div>
              <p className="text-sm font-medium text-stone-700 truncate mb-1">{post.title}</p>
              {post.type && <p className="text-xs text-stone-400">{post.type}</p>}
              {cats.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {cats.slice(0, 5).map(cat => (
                    <span key={cat.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {showCreate && (
        <PostModal
          title="New Post"
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  )
}

// ─── Audio Tab ─────────────────────────────────────────────────────────────────

function AudioTab({ audioProjects, eventId, showCreate, setShowCreate, onCreated, onNavigate }) {
  async function handleCreate(fields) {
    const { data, error } = await supabase
      .from('audio_projects')
      .insert({ ...fields, event_id: eventId })
      .select()
      .single()
    if (!error && data) onCreated(data)
  }

  if (audioProjects.length === 0 && !showCreate) {
    return (
      <EmptyState
        icon="♩"
        label="No audio"
        sub="Track music, ambient recordings, or any audio tied to this event."
        action="+ New Audio"
        onAction={() => setShowCreate(true)}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {audioProjects.map(ap => {
          const status = AUDIO_STATUSES[ap.status]
          const cats = (ap.audio_categories || []).map(ac => ac.category).filter(Boolean)
          return (
            <button
              key={ap.id}
              onClick={() => onNavigate(`/audio/${ap.id}`)}
              className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300 hover:shadow-sm transition-all text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-sm text-stone-400 flex-shrink-0">♩</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-700 truncate">{ap.name}</p>
                {cats.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {cats.slice(0, 5).map(cat => (
                      <span key={cat.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
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
            </button>
          )
        })}
      </div>

      {showCreate && (
        <AudioModal
          title="New Audio"
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  )
}

// ─── Shared Modals ─────────────────────────────────────────────────────────────

import { POST_TYPES, PLATFORMS } from '../lib/constants'

function PostModal({ title, initial = {}, onSave, onClose }) {
  const [postTitle, setPostTitle] = useState(initial.title || '')
  const [type, setType] = useState(initial.type || '')
  const [platform, setPlatform] = useState(initial.platform || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!postTitle.trim()) return
    setSaving(true)
    await onSave({ title: postTitle.trim(), type: type || null, platform: platform || null, status: 'idea' })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title">
            <input
              autoFocus
              value={postTitle}
              onChange={e => setPostTitle(e.target.value)}
              placeholder="e.g. Lisbon sunset reel"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(type === t ? '' : t)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    type === t
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Platform">
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(platform === p ? '' : p)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    platform === p
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!postTitle.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AudioModal({ title, initial = {}, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), status: 'idea' })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Ambient street sounds"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function EmptyState({ icon, label, sub, action, onAction }) {
  return (
    <div className="text-center py-16 text-stone-400">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-sm font-medium text-stone-500 mb-1">{label}</p>
      <p className="text-xs mb-5">{sub}</p>
      <button
        onClick={onAction}
        className="text-xs border border-stone-300 text-stone-500 px-4 py-2 rounded-md hover:bg-stone-100 transition-colors"
      >
        {action}
      </button>
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
