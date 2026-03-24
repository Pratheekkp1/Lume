import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Sidebar() {
  const navigate = useNavigate()
  const [recentPosts, setRecentPosts] = useState([])
  const [postsExpanded, setPostsExpanded] = useState(false)

  useEffect(() => {
    fetchRecentPosts()
    window.addEventListener('lume-posts-updated', fetchRecentPosts)
    return () => window.removeEventListener('lume-posts-updated', fetchRecentPosts)
  }, [])

  async function fetchRecentPosts() {
    const { data } = await supabase
      .from('posts')
      .select('id, title, status')
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentPosts(data || [])
  }

  const navClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 text-sm border-l-2 transition-all ${
      isActive
        ? 'text-amber-700 border-amber-700 bg-amber-50 font-medium'
        : 'text-stone-500 border-transparent hover:bg-stone-200 hover:text-stone-800'
    }`

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

      <div className="border-t border-stone-200 mx-3 mb-3" />

      {/* Posts */}
      <div className="mb-4">
        <NavLink to="/posts" className={navClass}>
          <span className="w-4 text-center text-xs">▷</span>
          Posts
        </NavLink>

        {/* Collapsible recent posts */}
        {recentPosts.length > 0 && (
          <>
            <button
              onClick={() => setPostsExpanded(prev => !prev)}
              className="w-full flex items-center gap-2 px-4 py-1 text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
            >
              <span className="text-[8px]">{postsExpanded ? '▾' : '▸'}</span>
              <span>Recent</span>
            </button>
            {postsExpanded && recentPosts.map(p => (
              <NavLink
                key={p.id}
                to={`/posts/${p.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 pl-8 pr-4 py-1.5 text-xs border-l-2 transition-all truncate ${
                    isActive
                      ? 'text-amber-700 border-amber-700 bg-amber-50 font-medium'
                      : 'text-stone-400 border-transparent hover:bg-stone-200 hover:text-stone-600'
                  }`
                }
              >
                <span className="truncate">{p.title}</span>
              </NavLink>
            ))}
          </>
        )}

        {/* Quick create */}
        <button
          onClick={() => navigate('/posts?create=true')}
          className="flex items-center gap-2 px-4 py-1.5 text-xs text-stone-400 hover:text-amber-700 transition-colors w-full"
        >
          <span className="w-4 text-center">+</span>
          New Post
        </button>
      </div>

      <div className="border-t border-stone-200 mx-3 mb-3" />

      {/* Media & Sounds */}
      <div className="mb-4">
        <NavLink to="/media" className={navClass}>
          <span className="w-4 text-center text-xs">◻</span>
          Media
        </NavLink>
        <NavLink to="/sounds" className={navClass}>
          <span className="w-4 text-center text-xs">♩</span>
          Sounds
        </NavLink>
      </div>

      <div className="border-t border-stone-200 mx-3 mb-3" />

      {/* Settings */}
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
