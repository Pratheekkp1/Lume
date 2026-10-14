import { useEffect, useState } from 'react'

// Edits are saved straight to Supabase, so without a connection they fail.
// Say so up front instead of letting changes silently not stick.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    let timer
    function goOnline() {
      setOnline(true)
      setJustReconnected(true)
      timer = setTimeout(() => setJustReconnected(false), 3000)
    }
    function goOffline() {
      clearTimeout(timer)
      setJustReconnected(false)
      setOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online && !justReconnected) return null

  return (
    <div
      role="status"
      className={`flex-shrink-0 text-center text-xs py-1.5 px-4 ${
        online ? 'bg-teal-500 text-white' : 'bg-amber-100 text-amber-800 border-b border-amber-200'
      }`}
    >
      {online
        ? 'Back online.'
        : "You're offline. Changes won't save until your connection is back."}
    </div>
  )
}
