import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Sidebar() {
  const navigate = useNavigate()
  const [collections, setCollections] = useState([])

  useEffect(() => {
    fetchCollections()
    window.addEventListener('lume-collections-updated', fetchCollections)
    return () => window.removeEventListener('lume-collections-updated', fetchCollections)
  }, [])

  async function fetchCollections() {
    const { data } = await supabase
      .from('collections')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(20)
    setCollections(data || [])
  }

  return (
    <aside className="w-48 bg-stone-100 border-r border-stone-200 flex flex-col py-4 flex-shrink-0 overflow-y-auto">

      {/* Dashboard */}
      <div className="px-3 mb-4">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2 text-sm px-2 py-1.5 rounded-md w-full transition-all
            ${isActive
              ? 'text-amber-700 bg-amber-50 font-medium'
              : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200'
            }`
          }
        >
          <span>⌂</span> Dashboard
        </NavLink>
      </div>

      {/* Collections */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-4 mb-1">
          <p className="text-[10px] tracking-widest uppercase text-stone-400">Collections</p>
          <button
            onClick={() => navigate('/collections')}
            className="text-[10px] tracking-widest uppercase text-stone-400 hover:text-amber-700 transition-colors"
            title="All collections"
          >
            All
          </button>
        </div>

        {collections.length === 0 ? (
          <p className="text-xs text-stone-400 px-4 py-1 italic">No collections yet</p>
        ) : (
          collections.map(col => (
            <NavLink
              key={col.id}
              to={`/collections/${col.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-1.5 text-sm border-l-2 transition-all truncate
                ${isActive
                  ? 'text-amber-700 border-amber-700 bg-amber-50 font-medium'
                  : 'text-stone-500 border-transparent hover:bg-stone-200 hover:text-stone-800'
                }`
              }
            >
              <span className="w-3 h-3 rounded-sm bg-stone-300 flex-shrink-0 text-[7px] flex items-center justify-center text-white">◻</span>
              <span className="truncate">{col.name}</span>
            </NavLink>
          ))
        )}

        <button
          onClick={() => navigate('/collections')}
          className="flex items-center gap-2 px-4 py-1.5 text-xs text-stone-400 hover:text-amber-700 transition-colors w-full text-left"
        >
          <span className="w-3 text-center">+</span>
          New collection
        </button>
      </div>

      {/* Library */}
      <div className="mb-4">
        <p className="text-[10px] tracking-widest uppercase text-stone-400 px-4 mb-1">Library</p>

        {[
          { label: 'All Posts',  path: '/posts',     icon: '▷' },
          { label: 'All Audio',  path: '/audio',     icon: '♩' },
        ].map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 text-sm border-l-2 transition-all
              ${isActive
                ? 'text-amber-700 border-amber-700 bg-amber-50 font-medium'
                : 'text-stone-500 border-transparent hover:bg-stone-200 hover:text-stone-800'
              }`
            }
          >
            <span className="w-4 text-center text-xs">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto px-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 text-sm px-2 py-1.5 rounded-md w-full transition-all
            ${isActive
              ? 'text-amber-700 bg-amber-50 font-medium'
              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-200'
            }`
          }
        >
          <span>⚙</span> Settings
        </NavLink>
      </div>
    </aside>
  )
}
