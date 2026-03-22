import { useState } from 'react'
import { getProfile, saveProfile, deriveInitials, AVATAR_COLORS } from '../lib/profile'

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
    { keys: ['Space'], description: 'Play / pause audio (Audio projects)' },
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
            <p className="text-xs text-stone-400 mt-0.5">Creative asset management for photographers & filmmakers</p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {[
            { label: 'Photo Collections', desc: 'Organize, filter, and manage photo shoots' },
            { label: 'Video Projects', desc: 'Track clips, status, and edit notes' },
            { label: 'Music / Audio', desc: 'Manage tracks, assign to projects, mark favorites' },
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

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  )
}
