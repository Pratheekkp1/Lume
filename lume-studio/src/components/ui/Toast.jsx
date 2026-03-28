import { useEffect, useState, useRef } from 'react'

export default function Toast() {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  useEffect(() => {
    function onToast(e) {
      const { message, undoFn } = e.detail
      const id = nextId.current++
      setToasts(prev => [...prev.slice(-2), { id, message, undoFn, createdAt: Date.now() }])
    }
    window.addEventListener('lume-toast', onToast)
    return () => window.removeEventListener('lume-toast', onToast)
  }, [])

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  async function handleUndo(toast) {
    dismiss(toast.id)
    if (toast.undoFn) await toast.undoFn()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} onUndo={() => handleUndo(toast)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss, onUndo }) {
  const [progress, setProgress] = useState(100)
  const intervalRef = useRef(null)

  useEffect(() => {
    const duration = 5000
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(pct)
      if (pct <= 0) {
        clearInterval(intervalRef.current)
        onDismiss()
      }
    }, 50)
    return () => clearInterval(intervalRef.current)
  }, [])

  return (
    <div className="pointer-events-auto relative bg-stone-800 text-white rounded-lg shadow-lg flex items-center gap-3 pl-4 pr-2 py-2.5 min-w-[280px] max-w-md animate-slide-up">
      <p className="text-sm flex-1">{toast.message}</p>
      {toast.undoFn && (
        <button
          onClick={onUndo}
          className="text-amber-300 hover:text-amber-200 text-sm font-medium px-2 py-0.5 transition-colors"
        >
          Undo
        </button>
      )}
      <button
        onClick={onDismiss}
        className="text-stone-400 hover:text-white text-sm px-1 transition-colors"
      >
        ×
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-700 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
