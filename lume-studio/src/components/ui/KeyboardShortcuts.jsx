import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GOTO_KEYS, SHORTCUTS, isTypingTarget } from '../../lib/shortcuts'

// How long after pressing "g" the second key still counts as part of the chord.
const CHORD_TIMEOUT_MS = 1200

export default function KeyboardShortcuts() {
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)
  const [chordPending, setChordPending] = useState(false)
  // The ref drives the logic, the state only drives the "G then…" hint.
  const chordRef = useRef(null)

  useEffect(() => {
    function endChord() {
      clearTimeout(chordRef.current)
      chordRef.current = null
      setChordPending(false)
    }

    function handleKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      if (e.key === 'Escape') { setHelpOpen(false); endChord(); return }

      // Second key of a "g" chord
      if (chordRef.current) {
        const target = GOTO_KEYS[e.key.toLowerCase()]
        endChord()
        if (target) {
          e.preventDefault()
          setHelpOpen(false)
          navigate(target.path)
        }
        return
      }

      if (e.key === '?') { e.preventDefault(); setHelpOpen(v => !v); return }
      if (e.key === '/') { e.preventDefault(); window.dispatchEvent(new CustomEvent('lume-focus-search')); return }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        setChordPending(true)
        chordRef.current = setTimeout(endChord, CHORD_TIMEOUT_MS)
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        navigate('/posts?create=true')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(chordRef.current)
    }
  }, [navigate])

  return (
    <>
      {chordPending && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
          <kbd className="font-mono">G</kbd> then… <span className="text-stone-400">(? for the list)</span>
        </div>
      )}

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Keyboard shortcuts"
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl text-stone-800">Keyboard shortcuts</h2>
              <button onClick={() => setHelpOpen(false)} className="text-stone-400 hover:text-stone-700 transition-colors text-sm">
                Esc
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {SHORTCUTS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">{group.group}</p>
                  <div className="space-y-1">
                    {group.items.map(item => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-stone-600">{item.label}</span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {item.keys.map((k, i) => (
                            <kbd key={i} className="px-1.5 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px] font-mono text-stone-600">{k}</kbd>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-6">Single-key shortcuts are off while you're typing in a field.</p>
          </div>
        </div>
      )}
    </>
  )
}
