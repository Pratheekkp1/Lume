import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../lib/constants'

export default function Sidebar() {
  return (
    <aside className="w-48 bg-stone-100 border-r border-stone-200 flex flex-col py-4 flex-shrink-0">
      <div className="mb-6">
        <p className="text-xs tracking-widest uppercase text-stone-400 px-4 mb-1">Studio</p>
        {NAV_ITEMS.map(item => (
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
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto px-3">
        <button className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 px-2 py-2 rounded-md hover:bg-stone-200 w-full transition-all">
          <span>⚙</span> Settings
        </button>
      </div>
    </aside>
  )
}