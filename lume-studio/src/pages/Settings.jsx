import { useState, useEffect } from 'react'
import { getProfile, saveProfile, deriveInitials, AVATAR_COLORS } from '../lib/profile'
import { fetchTrashed, restoreItem, permanentDelete, ENTITY_TYPES } from '../lib/trash'

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile')

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-44 border-r border-stone-200 py-6 flex-shrink-0 bg-white">
        <p className="text-xs tracking-widest uppercase text-stone-400 px-5 mb-2">Settings</p>
        {[
          { key: 'profile', label: 'Profile' },
          { key: 'shortcuts', label: 'Keyboard Shortcuts' },
          { key: 'trash', label: 'Trash' },
          { key: 'about', label: 'About' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`w-full text-left px-5 py-2 text-sm border-l-2 transition-all ${
              activeSection === s.key
                ? 'text-amber-700 border-amber-700 bg-amber-50 font-medium'
                : 'text-stone-500 border-transparent hover:bg-stone-50 hover:text-stone-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-xl">
        {activeSection === 'profile' && <ProfileSection />}
        {activeSection === 'shortcuts' && <ShortcutsSection />}
        {activeSection === 'trash' && <TrashSection />}
        {activeSection === 'about' && <AboutSection />}
      </div>
    </div>
  )
}

function ProfileSection() {
  const stored = getProfile()
  const [displayName, setDisplayName] = useState(stored.displayName)
  const [initials, setInitials] = useState(stored.initials)
  const [email, setEmail] = useState(stored.email)
  const [avatarColor, setAvatarColor] = useState(stored.avatarColor)
  const [initialsManual, setInitialsManual] = useState(
    stored.initials !== '' && stored.initials !== deriveInitials(stored.displayName)
  )
  const [saved, setSaved] = useState(false)

  function handleNameChange(name) {
    setDisplayName(name)
    if (!initialsManual) {
      setInitials(deriveInitials(name))
    }
  }

  function handleInitialsChange(val) {
    const upper = val.slice(0, 2).toUpperCase()
    setInitials(upper)
    setInitialsManual(upper !== deriveInitials(displayName))
  }

  function handleSave() {
    saveProfile({ displayName, initials, email, avatarColor })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const displayInitials = initials || deriveInitials(displayName) || '?'

  return (
    <div>
      <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Profile</p>
      <h1 className="font-serif text-3xl text-stone-800 mb-6">Your Profile</h1>

      {/* Avatar preview */}
      <div className="flex items-center gap-5 mb-8 p-5 bg-stone-50 border border-stone-200 rounded-xl">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-medium flex-shrink-0 transition-colors"
          style={{ backgroundColor: avatarColor }}
        >
          {displayInitials}
        </div>
        <div>
          <p className="text-sm font-medium text-stone-700">{displayName || 'Your Name'}</p>
          <p className="text-xs text-stone-400 mt-0.5">{email || 'No email set'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Field label="Display Name" hint="Shown in the top bar tooltip">
          <input
            type="text"
            value={displayName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Alex Rivera"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
          />
        </Field>

        <Field label="Initials" hint="2 characters shown in the avatar · auto-derived from name">
          <input
            type="text"
            value={initials}
            onChange={(e) => handleInitialsChange(e.target.value)}
            placeholder={deriveInitials(displayName) || 'e.g. AR'}
            maxLength={2}
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors font-mono"
          />
        </Field>

        <Field label="Email" hint="Optional — for display only">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. alex@studio.com"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
          />
        </Field>

        <Field label="Avatar Color">
          <div className="flex items-center gap-2 flex-wrap">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setAvatarColor(color)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                style={{ backgroundColor: color }}
                title={color}
              >
                {avatarColor === color && (
                  <span className="text-white text-[10px]">✓</span>
                )}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="bg-stone-800 text-white text-xs font-medium px-5 py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
          {saved && <span className="text-xs text-stone-400">Profile updated</span>}
        </div>
      </div>
    </div>
  )
}

function ShortcutsSection() {
  const shortcuts = [
    { keys: ['Esc'], description: 'Close detail panel or modal' },
    { keys: ['←', '→'], description: 'Navigate to previous / next item' },
    { keys: ['Space'], description: 'Play / pause audio (Sound projects)' },
    { keys: ['Click name'], description: 'Rename a track, clip, or photo' },
  ]

  return (
    <div>
      <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Shortcuts</p>
      <h1 className="font-serif text-3xl text-stone-800 mb-6">Keyboard Shortcuts</h1>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {shortcuts.map((s, i) => (
          <div key={i} className={`flex items-center gap-4 px-5 py-3.5 ${i !== 0 ? 'border-t border-stone-100' : ''}`}>
            <div className="flex items-center gap-1.5 flex-shrink-0 w-32">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded text-xs text-stone-600 font-mono"
                >
                  {k}
                </kbd>
              ))}
            </div>
            <span className="text-sm text-stone-600">{s.description}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-400 mt-4">Shortcuts are disabled when typing in a text field.</p>
    </div>
  )
}

function AboutSection() {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">About</p>
      <h1 className="font-serif text-3xl text-stone-800 mb-6">About Lume</h1>

      <div className="flex flex-col gap-5">
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center gap-4">
          <span className="font-serif italic text-amber-700 text-3xl">lume.</span>
          <div>
            <p className="text-sm font-medium text-stone-700">Lume Studio</p>
            <p className="text-xs text-stone-400 mt-0.5">Your creative hub for planning and organizing content</p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {[
            { label: 'Posts', desc: 'Plan and create reels, montages, edits, and photo dumps' },
            { label: 'Media & Albums', desc: 'Organize photos and videos into albums, grouped by event' },
            { label: 'Sounds', desc: 'Manage music, recordings, and audio tracks' },
          ].map((f, i) => (
            <div key={i} className={`px-5 py-3.5 ${i !== 0 ? 'border-t border-stone-100' : ''}`}>
              <p className="text-sm font-medium text-stone-700">{f.label}</p>
              <p className="text-xs text-stone-400 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrashSection() {
  const [trash, setTrash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmPermanent, setConfirmPermanent] = useState(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  useEffect(() => { loadTrash() }, [])

  async function loadTrash() {
    setLoading(true)
    const data = await fetchTrashed()
    setTrash(data)
    setLoading(false)
  }

  function daysRemaining(deletedAt) {
    const days = 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, days)
  }

  async function handleRestore(entityType, id, deletedAt) {
    await restoreItem(entityType, id, deletedAt)
    window.dispatchEvent(new CustomEvent(entityType.event))
    loadTrash()
  }

  async function handlePermanentDelete(entityType, id) {
    setConfirmPermanent(null)
    await permanentDelete(entityType, id)
    loadTrash()
  }

  async function handleEmptyTrash() {
    setConfirmEmpty(false)
    if (!trash) return
    const allItems = [
      ...trash.posts.map(i => ({ type: ENTITY_TYPES.POST, id: i.id })),
      ...trash.collections.map(i => ({ type: ENTITY_TYPES.COLLECTION, id: i.id })),
      ...trash.audioProjects.map(i => ({ type: ENTITY_TYPES.AUDIO_PROJECT, id: i.id })),
      ...trash.photos.map(i => ({ type: ENTITY_TYPES.PHOTO, id: i.id })),
      ...trash.audioTracks.map(i => ({ type: ENTITY_TYPES.AUDIO_TRACK, id: i.id })),
    ]
    for (const item of allItems) {
      await permanentDelete(item.type, item.id)
    }
    loadTrash()
  }

  const totalItems = trash
    ? trash.posts.length + trash.collections.length + trash.audioProjects.length + trash.photos.length + trash.audioTracks.length
    : 0

  const sections = trash ? [
    { label: 'Posts', type: ENTITY_TYPES.POST, items: trash.posts, nameField: 'title' },
    { label: 'Albums', type: ENTITY_TYPES.COLLECTION, items: trash.collections, nameField: 'name' },
    { label: 'Sound Projects', type: ENTITY_TYPES.AUDIO_PROJECT, items: trash.audioProjects, nameField: 'name' },
    { label: 'Photos', type: ENTITY_TYPES.PHOTO, items: trash.photos, nameField: 'name' },
    { label: 'Tracks', type: ENTITY_TYPES.AUDIO_TRACK, items: trash.audioTracks, nameField: 'name' },
  ].filter(s => s.items.length > 0) : []

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Trash</p>
          <h1 className="font-serif text-3xl text-stone-800">Trash</h1>
          <p className="text-xs text-stone-400 mt-1">Items are permanently deleted after 30 days</p>
        </div>
        {totalItems > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-md transition-colors"
          >
            Empty Trash
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : totalItems === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-4xl mb-3">🗑</p>
          <p className="text-sm font-medium">Trash is empty</p>
          <p className="text-xs mt-1">Deleted items will appear here for 30 days</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map(section => (
            <div key={section.label}>
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">{section.label}</p>
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                {section.items.map((item, i) => (
                  <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? 'border-t border-stone-100' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 truncate">{item[section.nameField]}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">{daysRemaining(item.deleted_at)} days remaining</p>
                    </div>
                    <button
                      onClick={() => handleRestore(section.type, item.id, item.deleted_at)}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium px-2 py-1 rounded transition-colors"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmPermanent({ type: section.type, id: item.id, name: item[section.nameField] })}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded transition-colors"
                    >
                      Delete Forever
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmPermanent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="font-serif text-xl text-stone-800 mb-2">Delete forever?</h2>
            <p className="text-sm text-stone-500 mb-6">
              "<span className="font-medium text-stone-700">{confirmPermanent.name}</span>" will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPermanent(null)} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
              <button onClick={() => handlePermanentDelete(confirmPermanent.type, confirmPermanent.id)} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      {confirmEmpty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="font-serif text-xl text-stone-800 mb-2">Empty trash?</h2>
            <p className="text-sm text-stone-500 mb-6">
              All {totalItems} item{totalItems !== 1 ? 's' : ''} will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmEmpty(false)} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
              <button onClick={() => handleEmptyTrash()} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">Empty Trash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  )
}
