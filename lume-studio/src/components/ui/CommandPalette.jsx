import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const COMMANDS = [
  // Navigate
  { id: 'nav-dashboard',    group: 'Navigate',  label: 'Dashboard',        icon: '⌂',  path: '/dashboard' },
  { id: 'nav-posts',        group: 'Navigate',  label: 'Projects',         icon: '▷',  path: '/posts' },
  { id: 'nav-library',      group: 'Navigate',  label: 'Library',          icon: '◻',  path: '/library' },
  { id: 'nav-ideas',        group: 'Navigate',  label: 'Ideas',            icon: '✦',  path: '/ideas' },
  { id: 'nav-inspiration',  group: 'Navigate',  label: 'Inspiration',      icon: '◉',  path: '/inspiration' },
  { id: 'nav-notes',        group: 'Navigate',  label: 'Notes',            icon: '✎',  path: '/notes' },
  { id: 'nav-analytics',    group: 'Navigate',  label: 'Analytics',        icon: '↗',  path: '/analytics' },
  { id: 'nav-campaigns',    group: 'Navigate',  label: 'Campaigns',        icon: '◈',  path: '/campaigns' },
  { id: 'nav-brand',        group: 'Navigate',  label: 'Brand Kit',        icon: '◈',  path: '/brand' },
  { id: 'nav-settings',     group: 'Navigate',  label: 'Settings',         icon: '⚙',  path: '/settings' },
  // Actions
  { id: 'act-new-post',     group: 'Actions',   label: 'New Post',         icon: '+',  path: '/posts?create=true' },
  { id: 'act-new-album',    group: 'Actions',   label: 'New Album',        icon: '+',  path: '/library?type=albums' },
  { id: 'act-capture-idea', group: 'Actions',   label: 'Capture Idea',     icon: '+',  path: '/ideas' },
  { id: 'act-new-note',     group: 'Actions',   label: 'New Note',         icon: '+',  path: '/notes' },
  { id: 'act-search',       group: 'Actions',   label: 'Search…',          icon: '⌕',  path: '/search' },
  { id: 'act-calendar',     group: 'Actions',   label: 'Content Calendar', icon: '▦',  path: '/posts?view=calendar' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  // Open/close via keyboard
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Filter commands by query
  const filtered = query
    ? COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS

  // Keyboard navigation within palette
  function handlePaletteKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) {
        executeCommand(filtered[activeIndex])
      }
    }
  }

  function executeCommand(cmd) {
    navigate(cmd.path)
    setOpen(false)
    setQuery('')
  }

  function handleQueryChange(e) {
    setQuery(e.target.value)
    setActiveIndex(0)
  }

  if (!open) return null

  // Group items for rendering
  const groups = []
  let currentGroup = null
  filtered.forEach((cmd, idx) => {
    if (cmd.group !== currentGroup) {
      currentGroup = cmd.group
      groups.push({ group: cmd.group, items: [] })
    }
    groups[groups.length - 1].items.push({ ...cmd, filteredIndex: idx })
  })

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onKeyDown={handlePaletteKeyDown}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
          <span className="text-stone-400 text-base select-none">⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search commands…"
            className="flex-1 text-sm outline-none text-stone-700 placeholder-stone-300 bg-transparent"
          />
          <span className="text-[10px] text-stone-300 select-none">esc</span>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-stone-400 text-center">No commands found</div>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group}>
                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-stone-400 select-none">
                  {group}
                </div>
                {items.map((cmd) => (
                  <div
                    key={cmd.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                      activeIndex === cmd.filteredIndex ? 'bg-teal-50' : 'hover:bg-teal-50'
                    }`}
                    onMouseEnter={() => setActiveIndex(cmd.filteredIndex)}
                    onClick={() => executeCommand(cmd)}
                  >
                    <span className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center text-xs text-stone-500 select-none shrink-0">
                      {cmd.icon}
                    </span>
                    <span className="text-sm text-stone-700">{cmd.label}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-stone-100 flex gap-4 text-[10px] text-stone-400 select-none">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
