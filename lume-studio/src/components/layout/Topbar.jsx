import { useNavigate } from 'react-router-dom'

export default function Topbar() {
  return (
    <header className="h-13 bg-stone-100 border-b border-stone-200 flex items-center px-4 gap-4 flex-shrink-0">
      <span
        className="font-serif italic text-amber-700 text-xl cursor-pointer"
        onClick={() => window.location.href = '/photos'}
      >
        lume.
      </span>

      <div className="relative flex-1 max-w-xs mx-auto">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs">⌕</span>
        <input
          type="text"
          placeholder="Search…"
          className="w-full bg-white border border-stone-200 rounded-md py-1.5 pl-6 pr-3 text-xs text-stone-700 placeholder-stone-400 outline-none focus:border-amber-600 transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-medium cursor-pointer">
          YO
        </div>
      </div>
    </header>
  )
}