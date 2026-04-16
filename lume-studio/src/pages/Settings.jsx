import { useState, useEffect } from 'react'
import { getProfile, saveProfile, deriveInitials, AVATAR_COLORS } from '../lib/profile'
import { fetchTrashed, restoreItem, permanentDelete, ENTITY_TYPES } from '../lib/trash'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, POST_TYPES, PLATFORMS } from '../lib/constants'

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile')

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-44 border-r border-stone-200 py-6 flex-shrink-0 bg-white">
        <p className="text-xs tracking-widest uppercase text-stone-400 px-5 mb-2">Settings</p>
        {[
          { key: 'profile', label: 'Profile' },
          { key: 'goals', label: 'Goals & Cadence' },
          { key: 'shortcuts', label: 'Keyboard Shortcuts' },
          { key: 'templates', label: 'Templates' },
          { key: 'trash', label: 'Trash' },
          { key: 'connected', label: 'Connected Accounts' },
          { key: 'team', label: 'Team' },
          { key: 'about', label: 'About' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`w-full text-left px-5 py-2 text-sm border-l-2 transition ${
              activeSection === s.key
                ? 'text-teal-700 border-teal-700 bg-teal-50 font-medium'
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
        {activeSection === 'goals' && <GoalsSection />}
        {activeSection === 'shortcuts' && <ShortcutsSection />}
        {activeSection === 'templates' && <TemplatesSection />}
        {activeSection === 'trash' && <TrashSection />}
        {activeSection === 'connected' && <ConnectedAccountsSection />}
        {activeSection === 'team' && <TeamSection />}
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
          <div className="flex flex-wrap gap-2 mt-1">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setAvatarColor(color)}
                className={`w-7 h-7 rounded-full transition-transform ${avatarColor === color ? 'scale-110 ring-2 ring-offset-1 ring-stone-400' : 'hover:scale-105'}`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <label className="text-xs text-stone-400">Other</label>
            <input
              type="color"
              value={avatarColor}
              onChange={(e) => setAvatarColor(e.target.value)}
              className="w-7 h-7 rounded-full cursor-pointer border border-stone-200 bg-transparent p-0.5"
              title="Custom color"
            />
            <span className="text-xs text-stone-300 font-mono">{avatarColor}</span>
          </div>
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="bg-teal-500 text-white text-xs font-medium px-5 py-2 rounded-md hover:bg-teal-600 transition-colors"
          >
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
          {saved && <span className="text-xs text-stone-400">Profile updated</span>}
        </div>
      </div>
    </div>
  )
}

const SHORTCUTS = [
  { group: 'Global', items: [
    { keys: ['⌘', 'K'], label: 'Open command palette' },
    { keys: ['⌘', '/'], label: 'Focus search' },
    { keys: ['Esc'],    label: 'Close modal / deselect' },
  ]},
  { group: 'Posts', items: [
    { keys: ['⌘', 'N'], label: 'New post (when on Posts page)' },
    { keys: ['↑', '↓'], label: 'Navigate results' },
    { keys: ['↵'],      label: 'Open selected item' },
  ]},
  { group: 'Album View', items: [
    { keys: ['←', '→'], label: 'Previous / next photo' },
    { keys: ['Esc'],    label: 'Close lightbox' },
    { keys: ['F'],      label: 'Toggle favorite (when photo open)' },
  ]},
  { group: 'Sound View', items: [
    { keys: ['Space'],  label: 'Play / pause track' },
    { keys: ['←', '→'], label: 'Previous / next track' },
  ]},
  { group: 'Notes', items: [
    { keys: ['⌘', 'Enter'], label: 'Save note entry' },
    { keys: ['Enter'],       label: 'Add activity log entry (in PostView)' },
  ]},
]

function ShortcutsSection() {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Shortcuts</p>
      <h1 className="font-serif text-3xl text-stone-800 mb-6">Keyboard Shortcuts</h1>

      <div className="flex flex-col gap-6">
        {SHORTCUTS.map((group) => (
          <div key={group.group}>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">{group.group}</p>
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 px-5 border-b border-stone-100 last:border-0">
                  <span className="text-sm text-stone-600">{item.label}</span>
                  <div className="flex items-center gap-1">
                    {item.keys.map((k, i) => (
                      <kbd key={i} className="px-1.5 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px] font-mono text-stone-600">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-400 mt-5">Shortcuts are disabled when typing in a text field.</p>
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
          <span className="font-serif italic text-teal-700 text-3xl">lume.</span>
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

function TemplatesSection() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, {id,...} = edit
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    const { data } = await supabase.from('post_templates').select('*').order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  async function handleSave(fields) {
    if (editing?.id) {
      const { error } = await supabase.from('post_templates').update(fields).eq('id', editing.id)
      if (!error) {
        setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, ...fields } : t))
        setEditing(null)
      }
    } else {
      const { data, error } = await supabase.from('post_templates').insert(fields).select().single()
      if (!error && data) {
        setTemplates(prev => [data, ...prev])
        setEditing(null)
      }
    }
  }

  async function handleDelete(id) {
    setConfirmDelete(null)
    await supabase.from('post_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  function summarize(template) {
    const parts = []
    if (template.type?.length) parts.push(template.type.join(', '))
    if (template.platform?.length) parts.push(template.platform.join(', '))
    if (template.status) parts.push(POST_STATUSES[template.status]?.label || template.status)
    return parts.join(' · ') || 'Blank template'
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Templates</p>
          <h1 className="font-serif text-3xl text-stone-800">Post Templates</h1>
          <p className="text-xs text-stone-400 mt-1">Pre-fill new posts with saved configurations</p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
        >
          + New Template
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-medium">No templates yet</p>
          <p className="text-xs mt-1">Create a template to quickly start new posts with pre-filled settings</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-700 truncate">{t.name}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">{summarize(t)}</p>
              </div>
              <button
                onClick={() => setEditing(t)}
                className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(t)}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <TemplateFormModal
          initial={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="font-serif text-xl text-stone-800 mb-2">Delete template?</h2>
            <p className="text-sm text-stone-500 mb-6">
              "<span className="font-medium text-stone-700">{confirmDelete.name}</span>" will be deleted.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateFormModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '')
  const [types, setTypes] = useState(initial.type || [])
  const [platforms, setPlatforms] = useState(initial.platform || [])
  const [status, setStatus] = useState(initial.status || 'idea')
  const [description, setDescription] = useState(initial.description || '')
  const [caption, setCaption] = useState(initial.caption || '')
  const [saving, setSaving] = useState(false)

  function toggleItem(arr, setArr, item) {
    setArr(arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      type: types.length > 0 ? types : null,
      platform: platforms.length > 0 ? platforms : null,
      status,
      description: description.trim() || null,
      caption: caption.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <h2 className="font-serif text-xl text-stone-800 mb-5">{initial.id ? 'Edit Template' : 'New Template'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Template Name">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Instagram Reel"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <Field label="Default Status">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(POST_STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                  style={status === key
                    ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                    : { borderColor: '#e7e5e4', color: '#78716c' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button key={t} type="button" onClick={() => toggleItem(types, setTypes, t)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${types.includes(t) ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Platform">
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button key={p} type="button" onClick={() => toggleItem(platforms, setPlatforms, p)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${platforms.includes(p) ? 'bg-teal-500 text-white border-teal-500' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Default Notes">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Pre-filled notes…"
              rows={2}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none transition-colors"
            />
          </Field>
          <Field label="Default Caption">
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Pre-filled caption…"
              rows={2}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none transition-colors"
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving} className="flex-1 bg-teal-500 text-white text-sm py-2 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : initial.id ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
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
                      className="text-xs text-teal-600 hover:text-teal-800 font-medium px-2 py-1 rounded transition-colors"
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

// ── Goals & Cadence ──────────────────────────────────────────────────────────

function GoalsSection() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newPlatform, setNewPlatform] = useState(PLATFORMS[0])
  const [newTarget, setNewTarget] = useState(3)
  const [weekProgress, setWeekProgress] = useState({}) // platform -> published count this week
  const [streak, setStreak] = useState(0)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: goalsData }, { data: posts }] = await Promise.all([
      supabase.from('posting_goals').select('*').order('created_at'),
      supabase.from('posts').select('platform, scheduled_date, status').is('deleted_at', null).eq('status', 'published'),
    ])
    setGoals(goalsData || [])

    // Compute this-week progress per platform
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay()) // Sunday
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const progress = {}
    ;(posts || []).forEach(p => {
      const d = p.scheduled_date ? new Date(p.scheduled_date + 'T00:00:00') : null
      if (!d || d < weekStart || d >= weekEnd) return
      ;(p.platform || []).forEach(pl => {
        progress[pl] = (progress[pl] || 0) + 1
      })
    })
    setWeekProgress(progress)

    // Streak: count consecutive past weeks where ALL goals were met
    // Simplified: count backwards week by week until one is missed
    if (goalsData && goalsData.length > 0 && posts && posts.length > 0) {
      let s = 0
      for (let w = 1; w <= 52; w++) {
        const wStart = new Date(weekStart)
        wStart.setDate(wStart.getDate() - w * 7)
        const wEnd = new Date(wStart)
        wEnd.setDate(wStart.getDate() + 7)

        const wProgress = {}
        posts.forEach(p => {
          const d = p.scheduled_date ? new Date(p.scheduled_date + 'T00:00:00') : null
          if (!d || d < wStart || d >= wEnd) return
          ;(p.platform || []).forEach(pl => { wProgress[pl] = (wProgress[pl] || 0) + 1 })
        })

        const allMet = goalsData.every(g => (wProgress[g.platform] || 0) >= g.target_count)
        if (allMet) s++
        else break
      }
      setStreak(s)
    }

    setLoading(false)
  }

  async function addGoal() {
    const existing = goals.find(g => g.platform === newPlatform)
    if (existing) {
      await supabase.from('posting_goals').update({ target_count: newTarget, updated_at: new Date().toISOString() }).eq('id', existing.id)
      setGoals(prev => prev.map(g => g.id === existing.id ? { ...g, target_count: newTarget } : g))
    } else {
      const { data, error } = await supabase.from('posting_goals').insert({ platform: newPlatform, frequency: 'weekly', target_count: newTarget }).select().single()
      if (!error && data) setGoals(prev => [...prev, data])
    }
    setAdding(false)
  }

  async function removeGoal(id) {
    await supabase.from('posting_goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function updateTarget(id, target) {
    const t = Math.max(1, parseInt(target) || 1)
    await supabase.from('posting_goals').update({ target_count: t, updated_at: new Date().toISOString() }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, target_count: t } : g))
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading...</p>

  return (
    <div>
      <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Cadence</p>
      <h1 className="font-serif text-3xl text-stone-800 mb-2">Goals & Cadence</h1>
      <p className="text-sm text-stone-400 mb-6">Set weekly posting targets per platform and track your consistency.</p>

      {/* Streak */}
      {goals.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 mb-6 flex items-center gap-5">
          <div className="text-center">
            <p className="text-3xl font-light text-stone-800">{streak}</p>
            <p className="text-xs text-stone-400 mt-1">week streak</p>
          </div>
          <div className="w-px h-10 bg-stone-100" />
          <div>
            <p className="text-sm text-stone-600 font-medium">{streak === 0 ? 'Start your streak' : streak === 1 ? '1 week strong' : `${streak} weeks in a row`}</p>
            <p className="text-xs text-stone-400 mt-0.5">Hit all goals every week to build your streak.</p>
          </div>
        </div>
      )}

      {/* This week */}
      {goals.length > 0 && (
        <div className="mb-6">
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-3">This Week</p>
          <div className="space-y-3">
            {goals.map(goal => {
              const done = weekProgress[goal.platform] || 0
              const pct = Math.min(100, Math.round((done / goal.target_count) * 100))
              const met = done >= goal.target_count
              return (
                <div key={goal.id} className="bg-white border border-stone-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-stone-700">{goal.platform}</span>
                    <span className={`text-xs font-medium ${met ? 'text-teal-600' : 'text-stone-400'}`}>
                      {done}/{goal.target_count} posts {met ? '✓' : ''}
                    </span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${met ? 'bg-teal-500' : 'bg-stone-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-stone-300 mt-1.5">{goal.target_count}×/week target</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Goal list */}
      <div className="mb-4">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-3">Targets</p>
        <div className="space-y-2">
          {goals.map(goal => (
            <div key={goal.id} className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3">
              <span className="flex-1 text-sm text-stone-700">{goal.platform}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={goal.target_count}
                  onChange={e => updateTarget(goal.id, e.target.value)}
                  className="w-12 text-center border border-stone-200 rounded text-sm py-1 outline-none focus:border-stone-400"
                />
                <span className="text-xs text-stone-400">× / week</span>
              </div>
              <button
                onClick={() => removeGoal(goal.id)}
                className="text-stone-200 hover:text-red-400 transition-colors text-sm"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {adding ? (
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-4 py-3">
          <select
            autoFocus
            value={newPlatform}
            onChange={e => setNewPlatform(e.target.value)}
            className="flex-1 text-sm text-stone-700 outline-none bg-transparent"
          >
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            type="number"
            min={1}
            max={30}
            value={newTarget}
            onChange={e => setNewTarget(parseInt(e.target.value) || 1)}
            className="w-12 text-center border border-stone-200 rounded text-sm py-1 outline-none focus:border-stone-400"
          />
          <span className="text-xs text-stone-400">× / week</span>
          <button onClick={addGoal} className="bg-teal-500 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-teal-600 transition-colors">Add</button>
          <button onClick={() => setAdding(false)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-teal-600 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add platform goal
        </button>
      )}
    </div>
  )
}

// ── Connected Accounts (placeholder) ────────────────────────────────────────

function ConnectedAccountsSection() {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Integrations</p>
      <h1 className="font-serif text-3xl text-stone-800 mb-2">Connected Accounts</h1>
      <p className="text-sm text-stone-400 mb-6">Link your social accounts to publish directly from Lume.</p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <span className="text-amber-500 text-lg flex-shrink-0">◎</span>
        <div>
          <p className="text-sm font-medium text-amber-800">Coming soon</p>
          <p className="text-xs text-amber-700 mt-0.5">API publishing integrations are planned for a future update. You'll be able to authorize accounts here and publish directly from Post view.</p>
        </div>
      </div>

      <div className="space-y-2">
        {PLATFORMS.map(platform => (
          <div key={platform} className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-5 py-4 opacity-60">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-xs font-bold flex-shrink-0">
              {platform[0]}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-700">{platform}</p>
              <p className="text-xs text-stone-400 mt-0.5">Not connected</p>
            </div>
            <span className="text-[10px] text-stone-300 border border-stone-200 px-2 py-1 rounded">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Team & Collaboration (placeholder) ──────────────────────────────────────

function TeamSection() {
  const features = [
    { icon: '👥', title: 'Invite collaborators', desc: 'Add teammates who can view and edit your content.' },
    { icon: '🔒', title: 'Role-based permissions', desc: 'Control who can publish, who can only comment, and who has full access.' },
    { icon: '💬', title: 'Comments & feedback', desc: 'Leave notes on posts and assets. Resolve threads when done.' },
    { icon: '📋', title: 'Shared projects', desc: 'Assign posts to team members and track their progress.' },
  ]

  return (
    <div>
      <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Collaborate</p>
      <h1 className="font-serif text-3xl text-stone-800 mb-2">Team & Collaboration</h1>
      <p className="text-sm text-stone-400 mb-6">Work with others on your content — shared access, roles, and feedback.</p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <span className="text-amber-500 text-lg flex-shrink-0">◎</span>
        <div>
          <p className="text-sm font-medium text-amber-800">Coming soon</p>
          <p className="text-xs text-amber-700 mt-0.5">Collaboration features require accounts and authentication, which are planned for a future update.</p>
        </div>
      </div>

      <div className="space-y-3">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-4 bg-white border border-stone-200 rounded-xl px-5 py-4 opacity-60">
            <span className="text-xl flex-shrink-0">{f.icon}</span>
            <div>
              <p className="text-sm font-medium text-stone-700">{f.title}</p>
              <p className="text-xs text-stone-400 mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-300 mt-5">Accounts and authentication will plug in here when available.</p>
    </div>
  )
}
