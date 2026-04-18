import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BRAND_KIT_KEY = 'scratch_notes'

const NOTE_TEMPLATES = [
  {
    name: 'Content Brief',
    content:
      '# Content Brief\n\n**Topic:**\n\n**Goal:**\n\n**Target audience:**\n\n**Key message:**\n\n**Platform(s):**\n\n**Due date:**\n\n**Notes:**',
  },
  {
    name: 'Weekly Plan',
    content:
      '# Weekly Content Plan\n\nWeek of: \n\n**Monday:**\n\n**Wednesday:**\n\n**Friday:**\n\n**Ideas for next week:**',
  },
  {
    name: 'Mood Board',
    content:
      '# Mood Board\n\n**Vibe / Aesthetic:**\n\n**Color palette:**\n\n**References:**\n\n**Caption tone:**\n\n**Hashtag direction:**',
  },
  {
    name: 'Meeting Notes',
    content:
      '# Meeting Notes\n\nDate: \nAttendees: \n\n**Agenda:**\n\n**Action items:**\n\n**Next steps:**',
  },
]

const SORT_OPTIONS = [
  { value: 'pinned', label: 'Pinned first' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

function renderMarkdown(text) {
  if (!text) return ''
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Horizontal rule
  html = html.replace(/^-{3,}$/gm, '<hr style="border:none;border-top:1px solid #e7e5e4;margin:1rem 0"/>')

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;color:#1c1917;margin:0.75rem 0 0.25rem">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.125rem;font-weight:700;color:#1c1917;margin:1rem 0 0.25rem">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:1.5rem;font-weight:700;color:#1c1917;margin:1rem 0 0.25rem;font-family:Georgia,serif">$1</h1>')

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600">$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f4f4f0;border:1px solid #e7e5e4;border-radius:3px;padding:0 4px;font-family:monospace;font-size:0.85em">$1</code>')

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin-left:1.25rem;list-style-type:disc">$1</li>')
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul style="margin:0.5rem 0">${m}</ul>`)

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1.5rem;list-style-type:decimal">$1</li>')

  // Blockquote
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #d6d3d1;padding-left:0.75rem;color:#78716c;margin:0.5rem 0">$1</blockquote>')

  // Line breaks → paragraphs (double newlines become paragraph breaks)
  const blocks = html.split(/\n\n+/)
  html = blocks.map(block => {
    // Don't wrap if already an HTML block
    if (/^<(h[1-6]|ul|ol|blockquote|hr|li)/.test(block.trim())) return block
    const withBr = block.replace(/\n/g, '<br/>')
    return withBr.trim() ? `<p style="margin:0.25rem 0">${withBr}</p>` : ''
  }).join('\n')

  return html
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTimestamp(isoString) {
  const d = new Date(isoString)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')
  const [sortMode, setSortMode] = useState('pinned')
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)

  const debounceTimer = useRef(null)
  const textareaRef = useRef(null)
  const notesRef = useRef(notes)
  const templateMenuRef = useRef(null)

  // Keep ref in sync so debounced save always has latest notes
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  // Load notes on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('brand_kit')
        .select('value')
        .eq('key', BRAND_KIT_KEY)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load notes:', error)
      }

      const raw = Array.isArray(data?.value) ? data.value : []
      // Migrate old notes that lack tags or pinned fields
      const loaded = raw.map((n) => ({ tags: [], pinned: false, ...n }))
      setNotes(loaded)
      if (loaded.length > 0) {
        setSelectedId(loaded[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  // Focus textarea when selection changes
  useEffect(() => {
    if (selectedId && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [selectedId])

  // Close template menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target)) {
        setShowTemplateMenu(false)
      }
    }
    if (showTemplateMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTemplateMenu])

  const saveToSupabase = useCallback(async (updatedNotes) => {
    setSaving(true)
    const { error } = await supabase
      .from('brand_kit')
      .upsert(
        { key: BRAND_KIT_KEY, value: updatedNotes, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    if (error) console.error('Failed to save notes:', error)
    setSaving(false)
  }, [])

  const scheduleSave = useCallback(
    (updatedNotes) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        saveToSupabase(updatedNotes)
      }, 800)
    },
    [saveToSupabase]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  function handleNewNote(initialContent = '') {
    const newNote = {
      id: crypto.randomUUID(),
      content: initialContent,
      tags: [],
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updated = [newNote, ...notes]
    setNotes(updated)
    setSelectedId(newNote.id)
    scheduleSave(updated)
  }

  function handleNewFromTemplate(template) {
    setShowTemplateMenu(false)
    handleNewNote(template.content)
  }

  function handleSelectNote(id) {
    setSelectedId(id)
  }

  function handleContentChange(e) {
    const newContent = e.target.value
    const updated = notes.map((n) =>
      n.id === selectedId
        ? { ...n, content: newContent, updated_at: new Date().toISOString() }
        : n
    )
    setNotes(updated)
    scheduleSave(updated)
  }

  function handleDuplicateNote(e, id) {
    e.stopPropagation()
    const orig = notes.find(n => n.id === id)
    if (!orig) return
    const firstLine = (orig.content || '').split('\n')[0].replace(/^#+\s*/, '').trim()
    const dupNote = {
      id: crypto.randomUUID(),
      content: orig.content,
      tags: [...(orig.tags || [])],
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    // Insert after the original
    const idx = notes.findIndex(n => n.id === id)
    const updated = [...notes.slice(0, idx + 1), dupNote, ...notes.slice(idx + 1)]
    setNotes(updated)
    setSelectedId(dupNote.id)
    scheduleSave(updated)
  }

  function handleDeleteNote(e, id) {
    e.stopPropagation()
    const idx = notes.findIndex((n) => n.id === id)
    const updated = notes.filter((n) => n.id !== id)
    setNotes(updated)
    saveToSupabase(updated)

    if (selectedId === id) {
      if (updated.length === 0) {
        setSelectedId(null)
      } else {
        // select next note, or previous if at end
        const nextIdx = Math.min(idx, updated.length - 1)
        setSelectedId(updated[nextIdx].id)
      }
    }
  }

  function handleTogglePin(e, id) {
    e.stopPropagation()
    const updated = notes.map((n) =>
      n.id === id ? { ...n, pinned: !n.pinned, updated_at: new Date().toISOString() } : n
    )
    setNotes(updated)
    scheduleSave(updated)
  }

  function addTag(tag) {
    const updated = notes.map((n) => {
      if (n.id !== selectedId) return n
      const existingTags = n.tags || []
      if (existingTags.includes(tag)) return n
      return { ...n, tags: [...existingTags, tag], updated_at: new Date().toISOString() }
    })
    setNotes(updated)
    scheduleSave(updated)
  }

  function removeTag(tag) {
    const updated = notes.map((n) => {
      if (n.id !== selectedId) return n
      return { ...n, tags: (n.tags || []).filter((t) => t !== tag), updated_at: new Date().toISOString() }
    })
    setNotes(updated)
    scheduleSave(updated)
  }

  const [previewMode, setPreviewMode] = useState(false)
  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  // Word / character counts for the selected note
  const wordCount = (selectedNote?.content || '').trim().split(/\s+/).filter(Boolean).length
  const charCount = (selectedNote?.content || '').length

  // Filter + sort note list
  const filteredNotes = notes.filter(
    (n) =>
      !noteSearch.trim() ||
      n.content.toLowerCase().includes(noteSearch.toLowerCase()) ||
      (n.tags || []).some((t) => t.toLowerCase().includes(noteSearch.toLowerCase()))
  )

  const displayedNotes = [...filteredNotes].sort((a, b) => {
    if (sortMode === 'pinned') {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updated_at) - new Date(a.updated_at)
    }
    if (sortMode === 'oldest') return new Date(a.updated_at) - new Date(b.updated_at)
    // newest
    return new Date(b.updated_at) - new Date(a.updated_at)
  })

  return (
    <div className="p-7 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-3xl text-stone-800">Notes</h1>
          <span className="text-sm text-stone-400">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
          {saving && (
            <span className="text-xs text-teal-500 animate-pulse">Saving…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Template dropdown */}
          <div className="relative" ref={templateMenuRef}>
            <button
              onClick={() => setShowTemplateMenu((v) => !v)}
              className="text-xs text-stone-500 hover:text-teal-600 px-2 py-1.5 rounded-lg hover:bg-teal-50 transition-colors border border-stone-200 hover:border-teal-200"
            >
              From template ▾
            </button>
            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-stone-200 rounded-xl shadow-lg z-10 py-1 overflow-hidden">
                {NOTE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    onClick={() => handleNewFromTemplate(tpl)}
                    className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notes.length > 0 && (
              <button
                onClick={() => {
                  const lines = notes.map(n => {
                    const firstLine = (n.content || '').split('\n')[0].replace(/^#+\s*/, '').trim() || 'Untitled'
                    return `# ${firstLine}\n\n${n.content || ''}`
                  }).join('\n\n---\n\n')
                  const blob = new Blob([lines], { type: 'text/markdown' })
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                  a.download = `all-notes-${Date.now()}.md`; a.click()
                }}
                className="text-xs text-stone-400 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
                title="Export all notes as Markdown"
              >
                ↓ All .md
              </button>
            )}
            <button
              onClick={() => handleNewNote()}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span>
              New Note
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-400 text-sm">Loading notes…</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-5 min-h-0">
          {/* Left: Note list */}
          <div className="w-64 flex-shrink-0 flex flex-col min-h-0">
            {/* Sort + Search row */}
            <div className="flex items-center gap-2 mb-2">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="text-[11px] border border-stone-200 rounded-lg px-2 py-1.5 text-stone-500 focus:outline-none focus:border-teal-400 bg-white flex-shrink-0"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:border-teal-400"
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {displayedNotes.length === 0 ? (
                <p className="text-stone-400 text-sm text-center mt-10">
                  {noteSearch.trim() ? 'No matching notes' : 'No notes yet'}
                </p>
              ) : (
                displayedNotes.map((note) => {
                  const isSelected = note.id === selectedId
                  const firstLine = note.content.split('\n')[0].replace(/^#+\s*/, '') || 'Empty note'
                  const tags = note.tags || []
                  return (
                    <div
                      key={note.id}
                      className={`group relative border rounded-lg p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                      }`}
                      onClick={() => handleSelectNote(note.id)}
                    >
                      {/* Title row */}
                      <div className="flex items-start gap-1.5 pr-5">
                        {note.pinned && (
                          <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-teal-400" title="Pinned" />
                        )}
                        <p className="text-sm text-stone-700 truncate flex-1">
                          {firstLine}
                        </p>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        {formatTimestamp(note.updated_at)}
                      </p>
                      {/* Tag pills in sidebar */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] bg-teal-50 text-teal-600 border border-teal-200 px-1.5 py-0.5 rounded-full leading-none"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Pin button — visible on hover; always visible when pinned */}
                      <button
                        onClick={(e) => handleTogglePin(e, note.id)}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                        className={`absolute bottom-2.5 right-2.5 w-5 h-5 flex items-center justify-center text-xs transition-opacity ${
                          note.pinned
                            ? 'opacity-100 text-teal-500'
                            : 'opacity-0 group-hover:opacity-100 text-stone-400 hover:text-teal-500'
                        }`}
                      >
                        📌
                      </button>
                      {/* Duplicate button */}
                      <button
                        onClick={(e) => handleDuplicateNote(e, note.id)}
                        className="absolute top-2.5 right-8 w-5 h-5 flex items-center justify-center text-stone-400 hover:text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                        title="Duplicate note"
                      >
                        ⎘
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteNote(e, note.id)}
                        className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                        title="Delete note"
                      >
                        ×
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Editor */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedNote === null ? (
              <div className="flex-1 flex items-center justify-center border border-dashed border-stone-200 rounded-xl">
                <p className="text-stone-400 text-sm">Select a note or create one</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Edit / Preview toggle */}
                <div className="flex items-center gap-1 mb-2 self-end">
                  {['Edit', 'Preview'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPreviewMode(mode === 'Preview')}
                      className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                        (previewMode ? mode === 'Preview' : mode === 'Edit')
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'border-stone-200 text-stone-400 hover:border-stone-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {previewMode ? (
                  <div
                    className="flex-1 min-h-96 p-4 text-sm text-stone-700 border border-stone-200 rounded-xl overflow-y-auto prose-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.content) }}
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    className="flex-1 w-full min-h-96 p-4 text-sm text-stone-700 border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 resize-none font-sans leading-relaxed"
                    value={selectedNote.content}
                    onChange={handleContentChange}
                    placeholder="Start writing…"
                  />
                )}

                {/* Tag input row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {(selectedNote.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-teal-400 hover:text-teal-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    placeholder="Add tag…"
                    className="text-[10px] border-b border-stone-200 outline-none text-stone-500 w-20 focus:border-teal-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        addTag(e.target.value.trim())
                        e.target.value = ''
                      }
                    }}
                  />
                </div>

                {/* Word / char count + last edited + export */}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-stone-400">
                    Last edited {timeAgo(selectedNote.updated_at)}
                    {selectedNote.pinned && (
                      <span className="ml-2 text-teal-500">· Pinned</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const blob = new Blob([selectedNote.content], { type: 'text/markdown' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        const firstLine = selectedNote.content.split('\n')[0].replace(/^#+\s*/, '').trim() || 'note'
                        a.href = url; a.download = `${firstLine.slice(0, 40).replace(/[^a-z0-9]/gi, '-')}.md`; a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="text-xs text-stone-400 hover:text-teal-600 transition-colors"
                      title="Download as Markdown"
                    >
                      ↓ .md
                    </button>
                    <p className="text-xs text-stone-400">
                      {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} chars
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
