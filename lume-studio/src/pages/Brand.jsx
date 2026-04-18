import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { PLATFORMS } from '../lib/constants'


const TABS = [
  { key: 'colors', label: 'Colors' },
  { key: 'tone', label: 'Tone of Voice' },
  { key: 'captions', label: 'Caption Blocks' },
  { key: 'hashtags', label: 'Hashtags' },
  { key: 'pillars', label: 'Content Pillars' },
]

export default function Brand() {
  const [activeTab, setActiveTab] = useState('colors')

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-1">Brand</p>
          <h1 className="font-serif text-3xl text-stone-800">Brand Kit</h1>
          <p className="text-sm text-stone-400 mt-1">Your creative identity — colors, voice, and reusable copy.</p>
        </div>
        <button
          onClick={async () => {
            // Fetch all brand_kit entries
            const { data } = await supabase.from('brand_kit').select('key, value')
            const kit = {}
            ;(data || []).forEach(r => { kit[r.key] = r.value })
            const lines = ['# Brand Kit', `_Exported ${new Date().toLocaleDateString()}_`, '']
            // Colors
            if (kit.colors?.palettes?.length) {
              lines.push('## Colors')
              kit.colors.palettes.forEach(p => {
                lines.push(`### ${p.name}`)
                ;(p.swatches || []).forEach(s => lines.push(`- ${s.hex}${s.name ? ` — ${s.name}` : ''}`))
              })
              lines.push('')
            }
            // Tone
            if (kit.tone?.notes) { lines.push('## Brand Voice', kit.tone.notes, '') }
            if (kit.tone_keywords?.length) { lines.push('### Voice Keywords', kit.tone_keywords.join(', '), '') }
            // Captions
            if (kit.captions?.blocks?.length) {
              lines.push('## Caption Blocks')
              kit.captions.blocks.forEach(b => { lines.push(`### ${b.title}`, b.text, '') })
            }
            // Hashtags
            if (kit.hashtag_groups?.groups?.length) {
              lines.push('## Hashtag Groups')
              kit.hashtag_groups.groups.forEach(g => { lines.push(`### ${g.name}`, g.tags.map(t => `#${t}`).join(' '), '') })
            }
            const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
            a.download = 'brand-kit.md'; a.click()
          }}
          className="text-xs text-stone-400 border border-stone-200 px-3 py-1.5 rounded-md hover:bg-stone-50 transition-colors"
          title="Export brand kit as Markdown"
        >
          ↓ Export .md
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-7 border-b border-stone-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === t.key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'colors' && <ColorsTab />}
      {activeTab === 'tone' && <ToneTab />}
      {activeTab === 'captions' && <CaptionsTab />}
      {activeTab === 'hashtags' && <HashtagsTab />}
      {activeTab === 'pillars' && <PillarsTab />}
    </div>
  )
}

// ── Colors ──────────────────────────────────────────────────────────────────

function ColorsTab() {
  const [palettes, setPalettes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newPaletteName, setNewPaletteName] = useState('')
  const [addingPalette, setAddingPalette] = useState(false)
  const [copiedCSS, setCopiedCSS] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('brand_kit').select('value').eq('key', 'colors').single()
    setPalettes(data?.value?.palettes || [])
    setLoading(false)
  }

  async function save(updated) {
    setSaving(true)
    await supabase.from('brand_kit').upsert({ key: 'colors', value: { palettes: updated }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaving(false)
  }

  function addPalette() {
    const name = newPaletteName.trim()
    if (!name) return
    const updated = [...palettes, { id: crypto.randomUUID(), name, swatches: ['#2a9d8f'] }]
    setPalettes(updated)
    save(updated)
    setNewPaletteName('')
    setAddingPalette(false)
  }

  function removePalette(id) {
    const updated = palettes.filter(p => p.id !== id)
    setPalettes(updated)
    save(updated)
  }

  function addSwatch(paletteId) {
    const updated = palettes.map(p =>
      p.id === paletteId ? { ...p, swatches: [...p.swatches, '#888888'] } : p
    )
    setPalettes(updated)
    save(updated)
  }

  function updateSwatch(paletteId, idx, hex) {
    const updated = palettes.map(p => {
      if (p.id !== paletteId) return p
      const swatches = [...p.swatches]
      swatches[idx] = hex
      return { ...p, swatches }
    })
    setPalettes(updated)
  }

  function saveSwatch(paletteId, idx, hex) {
    const updated = palettes.map(p => {
      if (p.id !== paletteId) return p
      const swatches = [...p.swatches]
      swatches[idx] = hex
      return { ...p, swatches }
    })
    setPalettes(updated)
    save(updated)
  }

  function removeSwatch(paletteId, idx) {
    const updated = palettes.map(p => {
      if (p.id !== paletteId) return p
      const swatches = p.swatches.filter((_, i) => i !== idx)
      return { ...p, swatches }
    })
    setPalettes(updated)
    save(updated)
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading...</p>

  return (
    <div className="space-y-6">
      {palettes.map(palette => (
        <div key={palette.id} className="bg-white border border-stone-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-stone-700">{palette.name}</p>
            <button
              onClick={() => removePalette(palette.id)}
              className="text-xs text-stone-300 hover:text-red-400 transition-colors"
            >
              Remove palette
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {palette.swatches.map((hex, idx) => (
              <SwatchPicker
                key={idx}
                hex={hex}
                onChange={h => updateSwatch(palette.id, idx, h)}
                onBlur={h => saveSwatch(palette.id, idx, h)}
                onRemove={() => removeSwatch(palette.id, idx)}
              />
            ))}
            <button
              onClick={() => addSwatch(palette.id)}
              className="w-10 h-10 rounded-lg border-2 border-dashed border-stone-200 hover:border-stone-400 flex items-center justify-center text-stone-300 hover:text-stone-500 transition-all text-lg"
            >
              +
            </button>
          </div>
        </div>
      ))}

      {/* Copy as CSS */}
      {palettes.some(p => p.swatches.length > 0) && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => {
              const allSwatches = palettes.flatMap(p => p.swatches)
              const css = allSwatches.map((hex, i) => `  --brand-color-${i + 1}: ${hex};`).join('\n')
              const block = `:root {\n${css}\n}`
              navigator.clipboard.writeText(block)
              setCopiedCSS(true)
              setTimeout(() => setCopiedCSS(false), 2000)
            }}
            className="text-xs border border-stone-200 text-stone-500 px-3 py-1.5 rounded-md hover:border-stone-300 transition-colors flex items-center gap-1.5"
          >
            {copiedCSS ? '✓ Copied!' : '⟨/⟩ Copy as CSS'}
          </button>
        </div>
      )}

      {addingPalette ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={newPaletteName}
            onChange={e => setNewPaletteName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addPalette(); if (e.key === 'Escape') setAddingPalette(false) }}
            placeholder="Palette name (e.g. Primary, Brand Deal)"
            className="flex-1 border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400"
          />
          <button onClick={addPalette} className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors">Add</button>
          <button onClick={() => setAddingPalette(false)} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-2">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setAddingPalette(true)}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-teal-600 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add color palette
        </button>
      )}
      {saving && <p className="text-xs text-stone-300">Saving...</p>}
    </div>
  )
}

function SwatchPicker({ hex, onChange, onBlur, onRemove }) {
  const [showRemove, setShowRemove] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyHex() {
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowRemove(true)}
      onMouseLeave={() => setShowRemove(false)}
    >
      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-stone-200 cursor-pointer">
        <div className="w-full h-full" style={{ backgroundColor: hex }} />
        <input
          type="color"
          value={hex}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onBlur(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          title={hex}
        />
      </div>
      <button
        onClick={copyHex}
        className="text-[9px] text-stone-400 text-center mt-1 font-mono uppercase w-full hover:text-teal-600 transition-colors block"
        title="Click to copy hex"
      >
        {copied ? '✓' : hex}
      </button>
      {showRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white rounded-full text-[10px] flex items-center justify-center leading-none hover:bg-red-500"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Tone of Voice ────────────────────────────────────────────────────────────

function ToneTab() {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef(null)
  const [toneKeywords, setToneKeywords] = useState([])
  const [keywordInput, setKeywordInput] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: toneData }, { data: kwData }] = await Promise.all([
      supabase.from('brand_kit').select('value').eq('key', 'tone').single(),
      supabase.from('brand_kit').select('value').eq('key', 'tone_keywords').single(),
    ])
    setNotes(toneData?.value?.notes || '')
    setToneKeywords(kwData?.value || [])
    setLoading(false)
  }

  function handleChange(val) {
    setNotes(val)
    setSaved(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(val), 1000)
  }

  async function save(val) {
    await supabase.from('brand_kit').upsert({ key: 'tone', value: { notes: val }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveKeywords(updated) {
    await supabase.from('brand_kit').upsert({ key: 'tone_keywords', value: updated, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  function addToneKeyword(kw) {
    if (!kw || toneKeywords.includes(kw)) return
    const updated = [...toneKeywords, kw]
    setToneKeywords(updated)
    saveKeywords(updated)
  }

  function removeToneKeyword(kw) {
    const updated = toneKeywords.filter(k => k !== kw)
    setToneKeywords(updated)
    saveKeywords(updated)
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-stone-500">Describe your voice — adjectives, tone, what to avoid, examples.</p>
        {saved && <span className="text-xs text-teal-600">Saved</span>}
      </div>
      <textarea
        value={notes}
        onChange={e => handleChange(e.target.value)}
        placeholder="e.g. Warm and conversational. Never corporate. Use contractions. End CTAs with a question. Avoid: 'game-changing', 'synergy', exclamation marks used more than once per post."
        rows={14}
        className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none leading-relaxed"
      />
      <p className="text-xs text-stone-300 mt-2">Auto-saves as you type.</p>

      {/* Brand Keywords */}
      <div className="mt-4">
        <label className="text-xs uppercase tracking-widest text-stone-400 mb-2 block">Brand Keywords</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {toneKeywords.map(kw => (
            <span key={kw} className="flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-3 py-1 rounded-full border border-stone-200">
              {kw}
              <button onClick={() => removeToneKeyword(kw)} className="text-stone-400 hover:text-stone-600 text-sm leading-none">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && keywordInput.trim()) { addToneKeyword(keywordInput.trim()); setKeywordInput('') } }}
            placeholder="Add keyword (Enter to add)…"
            className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
          />
        </div>
      </div>
    </div>
  )
}

// ── Caption Building Blocks ──────────────────────────────────────────────────

function CaptionsTab() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newText, setNewText] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('brand_kit').select('value').eq('key', 'captions').single()
    setBlocks(data?.value?.blocks || [])
    setLoading(false)
  }

  async function save(updated) {
    setSaving(true)
    await supabase.from('brand_kit').upsert({ key: 'captions', value: { blocks: updated }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaving(false)
  }

  function addBlock() {
    const label = newLabel.trim()
    const text = newText.trim()
    if (!label || !text) return
    const updated = [...blocks, { id: crypto.randomUUID(), label, text }]
    setBlocks(updated)
    save(updated)
    setNewLabel('')
    setNewText('')
    setAdding(false)
  }

  function removeBlock(id) {
    const updated = blocks.filter(b => b.id !== id)
    setBlocks(updated)
    save(updated)
  }

  function copyBlock(id, text) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function updateBlock(id, field, val) {
    const updated = blocks.map(b => b.id === id ? { ...b, [field]: val } : b)
    setBlocks(updated)
    save(updated)
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading...</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">Reusable CTA snippets, disclaimers, link-in-bio lines, and sign-offs.</p>

      {blocks.map(block => (
        <div key={block.id} className="bg-white border border-stone-200 rounded-xl p-4 group">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={block.label}
                onChange={e => updateBlock(block.id, 'label', e.target.value)}
                className="text-xs font-medium text-stone-400 uppercase tracking-wider bg-transparent outline-none w-full mb-2 hover:text-stone-600 transition-colors"
              />
              <textarea
                value={block.text}
                onChange={e => updateBlock(block.id, 'text', e.target.value)}
                rows={3}
                className="w-full text-sm text-stone-700 bg-transparent outline-none resize-none leading-relaxed"
              />
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <button
                onClick={() => copyBlock(block.id, block.text)}
                className="text-xs text-stone-300 hover:text-teal-600 transition-colors px-2 py-1 rounded hover:bg-teal-50"
              >
                {copied === block.id ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={() => removeBlock(block.id)}
                className="text-xs text-stone-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <input
            autoFocus
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Link in Bio CTA)"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400"
          />
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setAdding(false) }}
            placeholder="The reusable text snippet..."
            rows={4}
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={addBlock} className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors">Add Block</button>
            <button onClick={() => setAdding(false)} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-teal-600 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add caption block
        </button>
      )}

      {saving && <p className="text-xs text-stone-300">Saving...</p>}
    </div>
  )
}

// ── Hashtags ─────────────────────────────────────────────────────────────────

function HashtagsTab() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlatform, setNewPlatform] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [copied, setCopied] = useState(null)
  const [editTagInput, setEditTagInput] = useState({}) // groupId -> draft string
  const [usageMap, setUsageMap] = useState({}) // groupName -> post count

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: groupData }, { data: captions }] = await Promise.all([
      supabase.from('hashtag_groups').select('*').order('created_at'),
      supabase.from('posts').select('caption').is('deleted_at', null).not('caption', 'is', null),
    ])
    setGroups(groupData || [])
    // Count how many captions contain hashtags from each group
    const usage = {}
    ;(groupData || []).forEach(g => {
      const tags = (g.hashtags || []).map(t => t.toLowerCase().replace(/^#/, ''))
      if (tags.length === 0) return
      let count = 0
      ;(captions || []).forEach(({ caption }) => {
        if (!caption) return
        const cl = caption.toLowerCase()
        if (tags.some(t => cl.includes('#' + t))) count++
      })
      usage[g.id] = count
    })
    setUsageMap(usage)
    setLoading(false)
  }

  async function createGroup() {
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase.from('hashtag_groups').insert({ name, platform: newPlatform || null, hashtags: [] }).select().single()
    if (!error && data) {
      setGroups(prev => [...prev, data])
      setExpandedId(data.id)
    }
    setNewName('')
    setNewPlatform('')
    setAdding(false)
  }

  async function deleteGroup(id) {
    await supabase.from('hashtag_groups').delete().eq('id', id)
    setGroups(prev => prev.filter(g => g.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  async function saveHashtags(id, hashtags) {
    await supabase.from('hashtag_groups').update({ hashtags, updated_at: new Date().toISOString() }).eq('id', id)
    setGroups(prev => prev.map(g => g.id === id ? { ...g, hashtags } : g))
  }

  function addTag(group) {
    const raw = (editTagInput[group.id] || '').trim()
    if (!raw) return
    const tags = raw.split(/\s+/).map(t => t.startsWith('#') ? t : `#${t}`).filter(Boolean)
    const updated = [...new Set([...(group.hashtags || []), ...tags])]
    saveHashtags(group.id, updated)
    setEditTagInput(prev => ({ ...prev, [group.id]: '' }))
  }

  function removeTag(group, tag) {
    const updated = group.hashtags.filter(h => h !== tag)
    saveHashtags(group.id, updated)
  }

  function copyGroup(group) {
    navigator.clipboard.writeText(group.hashtags.join(' '))
    setCopied(group.id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading...</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500 mb-4">Named hashtag sets — one-click copy for any post.</p>

      {groups.map(group => (
        <div key={group.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {/* Group header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              className="flex-1 flex items-center gap-3 text-left"
              onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
            >
              <span className="text-stone-300 text-xs">{expandedId === group.id ? '▾' : '▸'}</span>
              <span className="text-sm font-medium text-stone-700">{group.name}</span>
              {group.platform && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-400">{group.platform}</span>
              )}
              <span className="text-xs text-stone-300 ml-auto">{(group.hashtags || []).length} tags</span>
              {usageMap[group.id] > 0 && (
                <span className="text-[10px] text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  Used in {usageMap[group.id]} post{usageMap[group.id] !== 1 ? 's' : ''}
                </span>
              )}
            </button>
            <button
              onClick={() => copyGroup(group)}
              className="text-xs text-stone-300 hover:text-teal-600 transition-colors px-2 py-1 rounded hover:bg-teal-50 flex-shrink-0"
            >
              {copied === group.id ? '✓ Copied' : 'Copy all'}
            </button>
            <button
              onClick={() => deleteGroup(group.id)}
              className="text-xs text-stone-200 hover:text-red-400 transition-colors flex-shrink-0"
            >
              Delete
            </button>
          </div>

          {/* Expanded */}
          {expandedId === group.id && (
            <div className="border-t border-stone-100 px-4 py-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(group.hashtags || []).map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-md"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(group, tag)}
                      className="text-stone-300 hover:text-red-400 leading-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTagInput[group.id] || ''}
                  onChange={e => setEditTagInput(prev => ({ ...prev, [group.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addTag(group) }}
                  placeholder="#tag1 #tag2 (space-separated)"
                  className="flex-1 border border-stone-200 rounded-md px-3 py-1.5 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400"
                />
                <button
                  onClick={() => addTag(group)}
                  className="bg-teal-500 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-teal-600 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Group name (e.g. Travel Niche)"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400"
          />
          <div className="flex gap-2 items-center">
            <select
              value={newPlatform}
              onChange={e => setNewPlatform(e.target.value)}
              className="border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-600 outline-none focus:border-stone-400 bg-white"
            >
              <option value="">All platforms</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={createGroup} className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors">Create</button>
            <button onClick={() => setAdding(false)} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-teal-600 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New hashtag group
        </button>
      )}
    </div>
  )
}

// ── Content Pillars ──────────────────────────────────────────────────────────

const PILLAR_COLORS = [
  '#2a9d8f', '#e76f51', '#e9c46a', '#264653', '#6366f1',
  '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
]

const PILLAR_EMOJIS = ['📚', '🎯', '💡', '🔥', '✨', '🎬', '📸', '🎵', '🌱', '💪', '🛍', '❤️']

function PillarsTab() {
  const [pillars, setPillars] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(PILLAR_COLORS[0])
  const [newEmoji, setNewEmoji] = useState(PILLAR_EMOJIS[0])
  const [postCounts, setPostCounts] = useState({}) // pillar_id -> count

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: pillarData }, { data: postData }] = await Promise.all([
      supabase.from('content_pillars').select('*').order('created_at'),
      supabase.from('posts').select('pillar_id').is('deleted_at', null).not('pillar_id', 'is', null),
    ])
    setPillars(pillarData || [])
    const counts = {}
    ;(postData || []).forEach(p => { counts[p.pillar_id] = (counts[p.pillar_id] || 0) + 1 })
    setPostCounts(counts)
    setLoading(false)
  }

  async function createPillar() {
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase.from('content_pillars').insert({
      name, description: newDesc.trim() || null, color: newColor, emoji: newEmoji,
    }).select().single()
    if (!error && data) setPillars(prev => [...prev, data])
    setNewName(''); setNewDesc(''); setNewColor(PILLAR_COLORS[0]); setNewEmoji(PILLAR_EMOJIS[0])
    setAdding(false)
  }

  async function deletePillar(id) {
    await supabase.from('content_pillars').delete().eq('id', id)
    setPillars(prev => prev.filter(p => p.id !== id))
  }

  async function updatePillar(id, fields) {
    await supabase.from('content_pillars').update(fields).eq('id', id)
    setPillars(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p))
  }

  const totalTagged = Object.values(postCounts).reduce((s, n) => s + n, 0)

  if (loading) return <p className="text-stone-400 text-sm">Loading...</p>

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-stone-500">Define your content themes — the recurring topics your audience expects from you.</p>
        {totalTagged > 0 && (
          <p className="text-xs text-stone-400 mt-1">{totalTagged} post{totalTagged !== 1 ? 's' : ''} assigned to a pillar</p>
        )}
      </div>

      {/* Balance bar */}
      {pillars.length > 0 && totalTagged > 0 && (
        <div>
          <p className="text-xs tracking-widest uppercase text-stone-400 mb-2">Balance</p>
          <div className="h-3 bg-stone-100 rounded-full overflow-hidden flex">
            {pillars.map(p => {
              const count = postCounts[p.id] || 0
              if (count === 0) return null
              const pct = (count / totalTagged) * 100
              return (
                <div
                  key={p.id}
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: p.color }}
                  title={`${p.name}: ${count} post${count !== 1 ? 's' : ''}`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {pillars.filter(p => (postCounts[p.id] || 0) > 0).map(p => (
              <div key={p.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-stone-500">{p.name}</span>
                <span className="text-xs text-stone-300">{postCounts[p.id]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pillar cards */}
      <div className="space-y-3">
        {pillars.map(pillar => (
          <div key={pillar.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-4 group">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: pillar.color + '20' }}
            >
              {pillar.emoji || '📌'}
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={pillar.name}
                onChange={e => updatePillar(pillar.id, { name: e.target.value })}
                className="text-sm font-medium text-stone-700 bg-transparent outline-none w-full"
              />
              <input
                type="text"
                value={pillar.description || ''}
                onChange={e => updatePillar(pillar.id, { description: e.target.value })}
                placeholder="Short description..."
                className="text-xs text-stone-400 bg-transparent outline-none w-full mt-0.5 placeholder-stone-200"
              />
              <p className="text-xs text-stone-300 mt-1.5">
                {postCounts[pillar.id] || 0} post{(postCounts[pillar.id] || 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => deletePillar(pillar.id)}
              className="text-stone-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm flex-shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding ? (
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            {/* Emoji picker */}
            <div className="relative group/emoji">
              <button className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-xl hover:bg-stone-100 transition-colors">
                {newEmoji}
              </button>
              <div className="absolute top-12 left-0 bg-white border border-stone-200 rounded-xl shadow-lg p-2 z-10 hidden group-hover/emoji:flex flex-wrap w-44 gap-1">
                {PILLAR_EMOJIS.map(e => (
                  <button key={e} onClick={() => setNewEmoji(e)} className="w-8 h-8 hover:bg-stone-100 rounded flex items-center justify-center text-base">
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createPillar(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Pillar name (e.g. Behind the Scenes)"
              className="flex-1 border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400"
            />
          </div>
          <input
            type="text"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400"
          />
          {/* Color picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-stone-400">Color:</span>
            {PILLAR_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                style={{ backgroundColor: c }}
              >
                {newColor === c && <span className="text-white text-[10px]">✓</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={createPillar} className="bg-teal-500 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition-colors">Create Pillar</button>
            <button onClick={() => setAdding(false)} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-teal-600 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add content pillar
        </button>
      )}
    </div>
  )
}
