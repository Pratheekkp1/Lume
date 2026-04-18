import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getRecentOpens } from '../../lib/recentOpens'

export default function Sidebar() {
  const navigate = useNavigate()
  const [recentPosts, setRecentPosts] = useState([])
  const [recentLibrary, setRecentLibrary] = useState([])
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('lume-sidebar-collapsed') === 'true')

  const navClass = ({ isActive }) =>
    collapsed
      ? `flex items-center justify-center py-2.5 text-sm transition w-full ${
          isActive ? 'text-teal-700' : 'text-stone-400 hover:text-stone-700'
        }`
      : `flex items-center gap-2 px-4 py-2 text-sm border-l-2 transition ${
          isActive
            ? 'text-teal-700 border-teal-700 bg-teal-50 font-medium'
            : 'text-stone-500 border-transparent hover:bg-stone-200 hover:text-stone-800'
        }`

  useEffect(() => {
    loadRecents()
    window.addEventListener('lume-posts-updated', loadRecents)
    window.addEventListener('lume-media-updated', loadRecents)
    window.addEventListener('lume-sounds-updated', loadRecents)
    window.addEventListener('lume-recents-updated', loadRecents)
    return () => {
      window.removeEventListener('lume-posts-updated', loadRecents)
      window.removeEventListener('lume-media-updated', loadRecents)
      window.removeEventListener('lume-sounds-updated', loadRecents)
      window.removeEventListener('lume-recents-updated', loadRecents)
    }
  }, [])

  async function loadRecents() {
    const opens = getRecentOpens().slice(0, 20)
    if (opens.length === 0) { setRecentPosts([]); setRecentLibrary([]); return }

    const postIds = opens.filter(o => o.type === 'post').map(o => o.id)
    const albumIds = opens.filter(o => o.type === 'album').map(o => o.id)
    const soundIds = opens.filter(o => o.type === 'sound').map(o => o.id)

    const [postRes, albumRes, soundRes] = await Promise.all([
      postIds.length > 0
        ? supabase.from('posts').select('id, title').in('id', postIds).is('deleted_at', null)
        : Promise.resolve({ data: [] }),
      albumIds.length > 0
        ? supabase.from('collections').select('id, name').in('id', albumIds).is('deleted_at', null)
        : Promise.resolve({ data: [] }),
      soundIds.length > 0
        ? supabase.from('audio_projects').select('id, name').in('id', soundIds).is('deleted_at', null)
        : Promise.resolve({ data: [] }),
    ])

    const postMap = Object.fromEntries((postRes.data || []).map(p => [p.id, p]))
    const albumMap = Object.fromEntries((albumRes.data || []).map(a => [a.id, a]))
    const soundMap = Object.fromEntries((soundRes.data || []).map(s => [s.id, s]))

    const posts = []
    const library = []
    for (const o of opens) {
      if (o.type === 'post' && postMap[o.id] && posts.length < 5)
        posts.push({ ...o, label: postMap[o.id].title, icon: '▷', link: `/posts/${o.id}` })
      if (o.type === 'album' && albumMap[o.id] && library.length < 5)
        library.push({ ...o, label: albumMap[o.id].name, icon: '◻', link: `/media/${o.id}` })
      if (o.type === 'sound' && soundMap[o.id] && library.length < 5)
        library.push({ ...o, label: soundMap[o.id].name, icon: '♩', link: `/sounds/${o.id}` })
    }

    setRecentPosts(posts)
    setRecentLibrary(library)
  }

  return (
    <aside className={`${collapsed ? 'w-12' : 'w-48'} bg-stone-100 border-r border-stone-200 flex flex-col py-4 flex-shrink-0 overflow-y-auto transition-all duration-200`}>

      {/* Collapse toggle */}
      <div className={`${collapsed ? 'flex justify-center' : 'flex justify-end px-3'} mb-2`}>
        <button
          onClick={() => {
            const next = !collapsed
            setCollapsed(next)
            localStorage.setItem('lume-sidebar-collapsed', String(next))
          }}
          className="text-stone-300 hover:text-stone-600 transition-colors text-xs p-1"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Dashboard */}
      <div className={`${collapsed ? '' : 'px-3'} mb-4`}>
        <NavLink
          to="/dashboard"
          title={collapsed ? 'Dashboard' : undefined}
          className={({ isActive }) =>
            collapsed
              ? `flex items-center justify-center py-2.5 text-sm transition w-full ${isActive ? 'text-teal-700' : 'text-stone-400 hover:text-stone-700'}`
              : `flex items-center gap-2 text-sm px-2 py-1.5 rounded-md w-full transition ${isActive ? 'text-teal-700 bg-teal-50 font-medium' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200'}`
          }
        >
          <span>⌂</span>{!collapsed && ' Dashboard'}
        </NavLink>
      </div>

      {!collapsed && <div className="border-t border-stone-200 mx-3 mb-3" />}

      {/* Projects (renamed from Posts) */}
      <div className="mb-4">
        <NavLink to="/posts" className={navClass} title={collapsed ? 'Projects' : undefined}>
          <span className="w-4 text-center text-xs">▷</span>
          {!collapsed && 'Projects'}
        </NavLink>
        {!collapsed && (
          <>
            <NavLink
              to="/posts?create=true"
              className="flex items-center gap-2 px-4 py-1.5 text-xs text-stone-400 hover:text-teal-700 transition-colors w-full"
            >
              <span className="w-4 text-center">+</span>
              New Project
            </NavLink>
            {recentPosts.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.link)}
                className="flex items-center gap-2 px-4 py-1.5 text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors w-full text-left"
              >
                <span className="w-4 text-center text-[10px] flex-shrink-0">▷</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {!collapsed && <div className="border-t border-stone-200 mx-3 mb-3" />}

      {/* Library */}
      <div className="mb-4">
        <NavLink to="/library" className={navClass} title={collapsed ? 'Library' : undefined}>
          <span className="w-4 text-center text-xs">◻</span>
          {!collapsed && 'Library'}
        </NavLink>
        {!collapsed && recentLibrary.map(item => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => navigate(item.link)}
            className="flex items-center gap-2 px-4 py-1.5 text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors w-full text-left"
          >
            <span className="w-4 text-center text-[10px] flex-shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {!collapsed && <div className="border-t border-stone-200 mx-3 mb-3" />}

      {/* Ideas */}
      <div className="mb-4">
        <NavLink to="/ideas" className={navClass} title={collapsed ? 'Ideas' : undefined}>
          <span className="w-4 text-center text-xs">✦</span>
          {!collapsed && 'Ideas'}
        </NavLink>
      </div>

      {/* Analytics */}
      <div className="mb-4">
        <NavLink to="/analytics" className={navClass} title={collapsed ? 'Analytics' : undefined}>
          <span className="w-4 text-center text-xs">↗</span>
          {!collapsed && 'Analytics'}
        </NavLink>
      </div>

      {/* Campaigns */}
      <div className="mb-4">
        <NavLink to="/campaigns" className={navClass} title={collapsed ? 'Campaigns' : undefined}>
          <span className="w-4 text-center text-xs">◈</span>
          {!collapsed && 'Campaigns'}
        </NavLink>
      </div>

      {/* Brand */}
      <div className="mb-4">
        <NavLink to="/brand" className={navClass} title={collapsed ? 'Brand Kit' : undefined}>
          <span className="w-4 text-center text-xs">◈</span>
          {!collapsed && 'Brand'}
        </NavLink>
      </div>

      {!collapsed && <div className="border-t border-stone-200 mx-3 mb-3" />}

      {/* Inspiration */}
      <div className="mb-4">
        <NavLink to="/inspiration" className={navClass} title={collapsed ? 'Inspiration' : undefined}>
          <span className="w-4 text-center text-xs">◉</span>
          {!collapsed && 'Inspiration'}
        </NavLink>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <NavLink to="/notes" className={navClass} title={collapsed ? 'Notes' : undefined}>
          <span className="w-4 text-center text-xs">✎</span>
          {!collapsed && 'Notes'}
        </NavLink>
      </div>

      {!collapsed && <div className="border-t border-stone-200 mx-3 mb-3" />}

      {/* Settings + Trash */}
      <div className={`mt-auto ${collapsed ? 'px-0 flex flex-col items-center' : 'px-3'} space-y-0.5`}>
        <NavLink
          to="/trash"
          title={collapsed ? 'Trash' : undefined}
          className={({ isActive }) =>
            collapsed
              ? `flex items-center justify-center py-2.5 text-sm transition w-full ${isActive ? 'text-stone-700' : 'text-stone-400 hover:text-stone-700'}`
              : `flex items-center gap-2 text-sm px-2 py-1.5 rounded-md w-full transition ${isActive ? 'text-stone-700 bg-stone-100 font-medium' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-200'}`
          }
        >
          <span>🗑</span>{!collapsed && ' Trash'}
        </NavLink>
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            collapsed
              ? `flex items-center justify-center py-2.5 text-sm transition w-full ${isActive ? 'text-teal-700' : 'text-stone-400 hover:text-stone-700'}`
              : `flex items-center gap-2 text-sm px-2 py-1.5 rounded-md w-full transition ${isActive ? 'text-teal-700 bg-teal-50 font-medium' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-200'}`
          }
        >
          <span>⚙</span>{!collapsed && ' Settings'}
        </NavLink>
      </div>
    </aside>
  )
}
