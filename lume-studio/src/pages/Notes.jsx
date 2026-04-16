import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BRAND_KIT_KEY = 'scratch_notes'

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')

  const debounceTimer = useRef(null)
  const textareaRef = useRef(null)
  const notesRef = useRef(notes)

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
      // Migrate old notes that lack a tags field
      const loaded = raw.map((n) => ({ tags: [], ...n }))
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

  const scheduleSave = useCallback((updatedNotes) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      saveToSupabase(updatedNotes)
    }, 800)
  }, [saveToSupabase])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  function handleNewNote() {
    const newNote = {
      id: crypto.randomUUID(),
      content: '',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updated = [newNote, ...notes]
    setNotes(updated)
    setSelectedId(newNote.id)
    scheduleSave(updated)
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

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  // Word / character counts for the selected note
  const wordCount = (selectedNote?.content || '').trim().split(/\s+/).filter(Boolean).length
  const charCount = (selectedNote?.content || '').length

  // Filtered note list for search
  const displayedNotes = notes.filter(
    (n) =>
      !noteSearch.trim() ||
      n.content.toLowerCase().includes(noteSearch.toLowerCase()) ||
      (n.tags || []).some((t) => t.toLowerCase().includes(noteSearch.toLowerCase()))
  )

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
        <button
          onClick={handleNewNote}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New Note
        </button>
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
            {/* Search input */}
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
                  const firstLine = note.content.split('\n')[0] || 'Empty note'
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
                      <p className="text-sm text-stone-700 truncate pr-5">
                        {firstLine}
                      </p>
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
                <textarea
                  ref={textareaRef}
                  className="flex-1 w-full min-h-96 p-4 text-sm text-stone-700 border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 resize-none font-sans leading-relaxed"
                  value={selectedNote.content}
                  onChange={handleContentChange}
                  placeholder="Start writing…"
                />

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

                {/* Word / char count + last edited */}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-stone-400">
                    Last edited {timeAgo(selectedNote.updated_at)}
                  </p>
                  <p className="text-xs text-stone-400">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} chars
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
