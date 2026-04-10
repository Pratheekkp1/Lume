import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function RepurposeTracker({ postId }) {
  const navigate = useNavigate()
  const [sourcePost, setSourcePost] = useState(null)   // post this was repurposed from
  const [derivatives, setDerivatives] = useState([])   // posts repurposed from this one
  const [expanded, setExpanded] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => { fetchLineage() }, [postId])

  async function fetchLineage() {
    const [{ data: self }, { data: children }] = await Promise.all([
      supabase
        .from('posts')
        .select('repurposed_from_post_id, source:posts!repurposed_from_post_id(id, title, type, status)')
        .eq('id', postId)
        .single(),
      supabase
        .from('posts')
        .select('id, title, type, status')
        .eq('repurposed_from_post_id', postId)
        .is('deleted_at', null),
    ])
    setSourcePost(self?.source || null)
    setDerivatives(children || [])
  }

  async function setSource(sourceId) {
    await supabase.from('posts').update({ repurposed_from_post_id: sourceId }).eq('id', postId)
    setShowPicker(false)
    fetchLineage()
  }

  async function clearSource() {
    await supabase.from('posts').update({ repurposed_from_post_id: null }).eq('id', postId)
    setSourcePost(null)
  }

  const hasAny = sourcePost || derivatives.length > 0

  return (
    <div>
      <button
        onClick={() => setExpanded(p => !p)}
        className="flex items-center justify-between w-full text-[10px] uppercase tracking-widest text-stone-400 mb-2 hover:text-stone-600 transition-colors"
      >
        <span>Repurposing {hasAny ? `(${(sourcePost ? 1 : 0) + derivatives.length})` : ''}</span>
        <span className="normal-case tracking-normal text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Source post */}
          <div>
            <p className="text-[10px] text-stone-400 mb-1.5">Repurposed from</p>
            {sourcePost ? (
              <div className="flex items-center gap-2 px-2.5 py-2 bg-stone-50 rounded-lg border border-stone-100">
                <span className="text-stone-300 text-xs">↑</span>
                <button
                  onClick={() => navigate(`/posts/${sourcePost.id}`)}
                  className="flex-1 text-left text-xs text-teal-700 hover:text-teal-800 transition-colors truncate"
                >
                  {sourcePost.title || 'Untitled'}
                </button>
                <button
                  onClick={clearSource}
                  className="text-stone-300 hover:text-red-400 transition-colors text-sm leading-none flex-shrink-0"
                  title="Remove link"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPicker(true)}
                className="w-full text-left text-xs text-stone-400 hover:text-teal-600 border border-dashed border-stone-200 hover:border-teal-300 rounded-lg px-2.5 py-2 transition-colors"
              >
                + Link source post…
              </button>
            )}
          </div>

          {/* Derivative posts */}
          {derivatives.length > 0 && (
            <div>
              <p className="text-[10px] text-stone-400 mb-1.5">Repurposed as ({derivatives.length})</p>
              <div className="space-y-1">
                {derivatives.map(d => (
                  <div key={d.id} className="flex items-center gap-2 px-2.5 py-2 bg-stone-50 rounded-lg border border-stone-100">
                    <span className="text-stone-300 text-xs">↓</span>
                    <button
                      onClick={() => navigate(`/posts/${d.id}`)}
                      className="flex-1 text-left text-xs text-teal-700 hover:text-teal-800 transition-colors truncate"
                    >
                      {d.title || 'Untitled'}
                    </button>
                    {d.type && (
                      <span className="text-[9px] text-stone-400 flex-shrink-0">{Array.isArray(d.type) ? d.type[0] : d.type}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showPicker && (
        <SourcePickerModal
          postId={postId}
          currentSourceId={sourcePost?.id}
          onPick={setSource}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

function SourcePickerModal({ postId, currentSourceId, onPick, onClose }) {
  const [posts, setPosts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('posts')
        .select('id, title, type, status')
        .is('deleted_at', null)
        .neq('id', postId)
        .order('created_at', { ascending: false })
      setPosts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = posts.filter(p =>
    !search || (p.title || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[70vh]">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-medium text-stone-800 text-sm mb-3">Select source post</h3>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-stone-400 text-sm text-center py-6">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No posts found</p>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-50 transition-colors ${p.id === currentSourceId ? 'bg-teal-50' : ''}`}
              >
                <span className="text-stone-300 text-xs">↑</span>
                <span className="flex-1 text-sm text-stone-700 truncate">{p.title || 'Untitled'}</span>
                {p.type && (
                  <span className="text-[10px] text-stone-400 flex-shrink-0">
                    {Array.isArray(p.type) ? p.type[0] : p.type}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-3 border-t border-stone-100">
          <button onClick={onClose} className="w-full text-sm text-stone-500 py-2 border border-stone-200 rounded-lg hover:border-stone-300 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
