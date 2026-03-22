import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, POST_TYPES, PLATFORMS } from '../lib/constants'

export default function Posts() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { fetchPosts() }, [])

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select('id, title, type, status, platform, created_at, post_categories(category:categories(id,name,color))')
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  async function handleCreate(fields) {
    const { data, error } = await supabase.from('posts').insert(fields).select('id, title, type, status, platform, created_at').single()
    if (!error && data) {
      setPosts(prev => [data, ...prev])
      setShowCreate(false)
      navigate(`/posts/${data.id}`)
    }
  }

  async function handleDelete() {
    await supabase.from('posts').delete().eq('id', deleteTarget.id)
    setPosts(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const filtered = filterStatus === 'all' ? posts : posts.filter(p => p.status === filterStatus)

  return (
    <div className="p-7 max-w-4xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Library</p>
          <h1 className="font-serif text-3xl text-stone-800">All Posts</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          + New Post
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
            filterStatus === 'all'
              ? 'bg-stone-800 text-white border-stone-800'
              : 'border-stone-200 text-stone-500 hover:border-stone-400'
          }`}
        >
          All
        </button>
        {Object.entries(POST_STATUSES).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              filterStatus === key
                ? 'text-white border-transparent'
                : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
            style={filterStatus === key ? { backgroundColor: s.color } : {}}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-4xl mb-4">▷</p>
          <p className="text-sm font-medium mb-1">No posts</p>
          <p className="text-xs">Create a post to start planning content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => navigate(`/posts/${post.id}`)}
              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(post) }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <PostModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function PostCard({ post, onClick, onDelete }) {
  const status = POST_STATUSES[post.status]
  const cats = (post.post_categories || []).map(pc => pc.category).filter(Boolean)

  return (
    <button
      onClick={onClick}
      className="group relative text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: (status?.color || '#b0a090') + '30', color: status?.color || '#b0a090' }}
        >
          {status?.label || post.status}
        </span>
        {post.platform && (
          <span className="text-[10px] text-stone-400">{post.platform}</span>
        )}
      </div>

      <p className="text-sm font-medium text-stone-700 truncate mb-0.5">{post.title}</p>

      {post.type && (
        <p className="text-xs text-stone-400">{post.type}</p>
      )}

      {cats.length > 0 && (
        <div className="flex gap-1 mt-2">
          {cats.slice(0, 6).map(cat => (
            <span key={cat.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          ))}
        </div>
      )}

      {/* Hover delete */}
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 w-5 h-5 rounded bg-white/90 text-stone-300 hover:text-red-500 items-center justify-center text-xs shadow-sm transition-colors hidden group-hover:flex"
        title="Delete"
      >
        ✕
      </button>
    </button>
  )
}

function PostModal({ initial = {}, onSave, onClose }) {
  const [title, setTitle] = useState(initial.title || '')
  const [type, setType] = useState(initial.type || '')
  const [platform, setPlatform] = useState(initial.platform || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), type: type || null, platform: platform || null, status: initial.status || 'idea' })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">New Post</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Lisbon sunset reel"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(type === t ? '' : t)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${type === t ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Platform">
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button key={p} type="button" onClick={() => setPlatform(platform === p ? '' : p)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${platform === p ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? 'Saving…' : 'Create'}
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
        <h2 className="font-serif text-xl text-stone-800 mb-2">Delete post?</h2>
        <p className="text-sm text-stone-500 mb-6">
          "<span className="font-medium text-stone-700">{name}</span>" and all its assets will be permanently deleted.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">Delete</button>
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
