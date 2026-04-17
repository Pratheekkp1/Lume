import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

/*
  Supabase table required — deliver SQL in chat, not here.
*/

const CARD_TYPES = [
  { key: 'note', label: 'Note', icon: '📝' },
  { key: 'link', label: 'Link', icon: '🔗' },
  { key: 'idea', label: 'Idea', icon: '💡' },
  { key: 'reference', label: 'Reference', icon: '📌' },
]

const TYPE_STYLES = {
  note:      { icon: '✎', color: '#2a9d8f' },
  link:      { icon: '🔗', color: '#6366f1' },
  image:     { icon: '◻', color: '#f4a261' },
  reference: { icon: '◈', color: '#e76f51' },
  idea:      { icon: '✦', color: '#e9c46a' },
}

const TAG_COLORS = ['#2a9d8f', '#e76f51', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6']

export default function Inspiration() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterTag, setFilterTag] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [quickUrl, setQuickUrl] = useState('')
  const [quickUrlSaving, setQuickUrlSaving] = useState(false)

  // New card form
  const [newType, setNewType] = useState('note')
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newTagInput, setNewTagInput] = useState('')
  const [newTags, setNewTags] = useState([])
  const [newColor, setNewColor] = useState(TAG_COLORS[0])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('inspiration').select('*').order('created_at', { ascending: false })
    setCards(data || [])
    // Collect all unique tags
    const tags = new Set()
    ;(data || []).forEach(c => (c.tags || []).forEach(t => tags.add(t)))
    setAllTags([...tags].sort())
    setLoading(false)
  }

  async function createCard() {
    const title = newTitle.trim()
    if (!title) return
    const { data, error } = await supabase.from('inspiration').insert({
      type: newType,
      title,
      body: newBody.trim() || null,
      url: newUrl.trim() || null,
      tags: newTags,
      color: newColor,
    }).select().single()
    if (!error && data) {
      setCards(prev => [data, ...prev])
      const tags = new Set([...allTags, ...newTags])
      setAllTags([...tags].sort())
    }
    resetForm()
    setAdding(false)
  }

  async function togglePin(id) {
    const card = cards.find(c => c.id === id)
    if (!card) return
    const pinned = !card.pinned
    await supabase.from('inspiration').update({ pinned, updated_at: new Date().toISOString() }).eq('id', id)
    setCards(prev => prev.map(c => c.id === id ? { ...c, pinned } : c))
  }

  async function deleteCard(id) {
    await supabase.from('inspiration').delete().eq('id', id)
    setCards(prev => prev.filter(c => c.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  async function updateCard(id, fields) {
    await supabase.from('inspiration').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
  }

  function addNewTag() {
    const tag = newTagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag || newTags.includes(tag)) return
    setNewTags(prev => [...prev, tag])
    setNewTagInput('')
  }

  function resetForm() {
    setNewType('note'); setNewTitle(''); setNewBody(''); setNewUrl('')
    setNewTagInput(''); setNewTags([]); setNewColor(TAG_COLORS[0])
  }

  async function quickAddUrl() {
    const url = quickUrl.trim()
    if (!url) return
    setQuickUrlSaving(true)
    const domain = url.replace(/^https?:\/\//, '').split('/')[0]
    const { data, error } = await supabase.from('inspiration').insert({
      type: 'link',
      title: domain,
      url,
      tags: [],
      pinned: false,
    }).select().single()
    if (!error && data) {
      setCards(prev => [data, ...prev])
      setExpandedId(data.id)
    }
    setQuickUrl('')
    setQuickUrlSaving(false)
  }

  const filtered = (() => {
    const q = searchQuery.toLowerCase().trim()
    const base = cards.filter(c => {
      if (filterType !== 'all' && c.type !== filterType) return false
      if (filterTag && !(c.tags || []).includes(filterTag)) return false
      if (q && !c.title.toLowerCase().includes(q) && !(c.body || '').toLowerCase().includes(q) && !(c.url || '').toLowerCase().includes(q) && !(c.tags || []).some(t => t.toLowerCase().includes(q))) return false
      return true
    })
    return [...base.filter(c => c.pinned), ...base.filter(c => !c.pinned)]
  })()

  return (
    <div className="p-7 max-w-5xl">
      <div className="mb-7">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Studio</p>
        <h1 className="font-serif text-3xl text-stone-800">Inspiration Board</h1>
        <p className="text-sm text-stone-400 mt-1">Save ideas, references, and links that fuel your content.</p>
      </div>

      {/* Quick URL paste bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-stone-300 text-xs flex-shrink-0">🔗</span>
        <input
          type="url"
          value={quickUrl}
          onChange={e => setQuickUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && quickAddUrl()}
          placeholder="Paste a link to save it instantly…"
          className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400 text-stone-700 placeholder-stone-300"
        />
        {quickUrl && (
          <button
            onClick={quickAddUrl}
            disabled={quickUrlSaving}
            className="text-xs text-teal-600 border border-teal-200 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-40"
          >
            {quickUrlSaving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => setAdding(true)}
          className="bg-teal-500 text-white text-xs font-medium px-4 py-2.5 rounded-md hover:bg-teal-600 transition-colors"
        >
          + Add card
        </button>
        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search cards…"
          className="text-xs border border-stone-200 rounded-md px-3 py-1.5 outline-none focus:border-teal-400 w-44"
        />

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${filterType === 'all' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
          >
            All
          </button>
          {CARD_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setFilterType(filterType === t.key ? 'all' : t.key)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${filterType === t.key ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filterTag === tag
                    ? 'bg-stone-700 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add card modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => { setAdding(false); resetForm() }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-xl text-stone-800 mb-4">New Card</h2>

            {/* Type */}
            <div className="flex gap-2 mb-4">
              {CARD_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setNewType(t.key)}
                  className={`flex-1 text-xs py-2 rounded-md border transition-all ${
                    newType === t.key ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Title or headline..."
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 mb-3"
            />

            {/* Body */}
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Notes, details, or context..."
              rows={3}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none mb-3"
            />

            {/* URL */}
            {(newType === 'link' || newType === 'reference') && (
              <input
                type="url"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 mb-3"
              />
            )}

            {/* Tags */}
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewTag() } }}
                  placeholder="Add tag..."
                  className="flex-1 border border-stone-200 rounded-md px-3 py-1.5 text-xs text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400"
                />
                <button onClick={addNewTag} className="text-xs text-stone-400 hover:text-teal-600 px-2 transition-colors">Add</button>
              </div>
              {newTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {newTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                      #{tag}
                      <button onClick={() => setNewTags(prev => prev.filter(t => t !== tag))} className="text-stone-300 hover:text-red-400 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Color accent */}
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs text-stone-400">Accent:</span>
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ backgroundColor: c }}
                >
                  {newColor === c && <span className="text-white text-[8px]">✓</span>}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={createCard}
                className="flex-1 bg-teal-500 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-600 transition-colors"
              >
                Save Card
              </button>
              <button
                onClick={() => { setAdding(false); resetForm() }}
                className="px-4 border border-stone-200 text-stone-500 text-sm py-2.5 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">💡</p>
          <p className="text-stone-500 text-sm">
            {cards.length === 0 ? 'Start saving ideas, links, and references here.' : 'No cards match this filter.'}
          </p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {filtered.map(card => (
            <InspirationCard
              key={card.id}
              card={card}
              expanded={expandedId === card.id}
              onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
              onUpdate={fields => updateCard(card.id, fields)}
              onDelete={() => deleteCard(card.id)}
              onTogglePin={() => togglePin(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function InspirationCard({ card, expanded, onToggle, onUpdate, onDelete, onTogglePin }) {
  const typeStyle = TYPE_STYLES[card.type] || { icon: '✎', color: '#a8a29e' }
  const [bodyDraft, setBodyDraft] = useState(card.body || '')
  const bodyTimer = useRef(null)

  function handleBodyChange(val) {
    setBodyDraft(val)
    clearTimeout(bodyTimer.current)
    bodyTimer.current = setTimeout(() => onUpdate({ body: val }), 800)
  }

  return (
    <div
      className="group break-inside-avoid bg-white border border-stone-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow"
      style={{ borderLeftColor: typeStyle.color, borderLeftWidth: 4 }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[11px] font-bold flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
              style={{ color: typeStyle.color }}
              title={card.type}
            >
              {typeStyle.icon}
            </span>
            <span className="text-sm font-medium text-stone-700 truncate">{card.title}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onTogglePin() }}
              className={`text-sm transition-all px-0.5 ${card.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:scale-110`}
              title={card.pinned ? 'Unpin' : 'Pin to top'}
            >
              {card.pinned ? '📌' : '📍'}
            </button>
            <button
              onClick={onToggle}
              className="text-xs text-stone-300 hover:text-stone-500 transition-colors px-1"
            >
              {expanded ? '▴' : '▾'}
            </button>
          </div>
        </div>

        {/* Body preview / full */}
        {card.body && !expanded && (
          <p className="text-xs text-stone-500 leading-relaxed line-clamp-3">{card.body}</p>
        )}

        {expanded && (
          <div className="mt-2 space-y-3">
            <textarea
              value={bodyDraft}
              onChange={e => handleBodyChange(e.target.value)}
              placeholder="Notes..."
              rows={4}
              className="w-full text-xs text-stone-600 bg-stone-50 rounded-lg p-2.5 outline-none resize-none leading-relaxed border border-stone-100 focus:border-stone-300"
            />
            {card.url && (
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 transition-colors truncate"
              >
                <span>🔗</span>
                <span className="truncate">{card.url}</span>
              </a>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-stone-300">
                {new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                onClick={onDelete}
                className="text-xs text-stone-200 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* URL preview (collapsed) */}
        {card.url && !expanded && (
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-teal-500 hover:text-teal-600 transition-colors mt-2 truncate"
          >
            <span>🔗</span>
            <span className="truncate">{card.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
          </a>
        )}

        {/* Tags */}
        {(card.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {card.tags.map(tag => (
              <span key={tag} className="text-[10px] bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
