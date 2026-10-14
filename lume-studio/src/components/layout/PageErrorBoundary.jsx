import { Component } from 'react'
import { isStaleChunkError } from '../../lib/staleChunk'

const RELOAD_KEY = 'lume-stale-chunk-reload-at'
const RELOAD_COOLDOWN_MS = 10_000

// React only supports error boundaries as class components, so this is the
// one class in the app. App.jsx keys it by route, so moving to another page
// clears the error.
export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    // After a deploy, an open tab still asks for the old page files, which no
    // longer exist. An automatic reload picks up the new ones; the cooldown
    // stops a reload loop if reloading doesn't fix it.
    if (isStaleChunkError(error)) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
        window.location.reload()
        return
      }
    }
    console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-7 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm text-center">
          <p className="text-3xl text-stone-300 mb-3">⚠</p>
          <h1 className="font-serif text-2xl text-stone-800 mb-2">This page hit a problem</h1>
          <p className="text-sm text-stone-500 mb-5">
            Nothing else is affected. Reload to try again, or use the sidebar to go somewhere else.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-teal-500 text-white text-xs font-medium px-5 py-2.5 rounded-md hover:bg-teal-600 transition-colors"
          >
            Reload page
          </button>
          <p className="text-[10px] text-stone-400 mt-5 font-mono break-words">{String(this.state.error?.message || this.state.error)}</p>
        </div>
      </div>
    )
  }
}
