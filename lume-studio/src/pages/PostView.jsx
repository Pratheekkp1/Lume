import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, POST_TYPES, PLATFORMS } from '../lib/constants'
import { recordOpen } from '../lib/recentOpens'

const BUCKET = 'Photos' // reuse the Photos bucket for post assets

export default function PostView() {
  const { postId } = useParams()
  const navigate = useNavigate()

  const [post, setPost] = useState(null)
  const [assets, setAssets] = useState([])
  const [categories, setCategories] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showCategoryPanel, setShowCategoryPanel] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [deleteAssetTarget, setDeleteAssetTarget] = useState(null)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [linkedPhotos, setLinkedPhotos] = useState([])
  const [linkedTracks, setLinkedTracks] = useState([])
  const [showLibraryLinker, setShowLibraryLinker] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchAll()
    recordOpen('post', postId)
  }, [postId])

  async function fetchAll() {
    const [{ data: postData }, { data: assetData }, { data: catJoins }, { data: allCats }, { data: photoLinks }, { data: trackLinks }] = await Promise.all([
      supabase.from('posts').select('*').eq('id', postId).single(),
      supabase.from('post_assets').select('*').eq('post_id', postId).order('order_index').order('created_at'),
      supabase.from('post_categories').select('category:categories(*)').eq('post_id', postId),
      supabase.from('categories').select('*').eq('type', 'post').order('name'),
      supabase.from('post_linked_photos').select('photo:photos(id, name, file_path, collection_id, collections(id, name))').eq('post_id', postId),
      supabase.from('post_linked_tracks').select('track:audio_tracks(id, name, project_id, audio_projects(id, name))').eq('post_id', postId),
    ])
    setPost(postData)
    setTitleDraft(postData?.title || '')
    setAssets(assetData || [])
    setCategories((catJoins || []).map(j => j.category).filter(Boolean))
    setAllCategories(allCats || [])
    setLinkedPhotos((photoLinks || []).map(l => l.photo).filter(Boolean))
    setLinkedTracks((trackLinks || []).map(l => l.track).filter(Boolean))
    setLoading(false)
  }

  // ── Metadata updates ──────────────────────────────────────────────────────

  async function saveTitle() {
    const t = titleDraft.trim()
    if (!t || t === post.title) { setEditingTitle(false); return }
    await supabase.from('posts').update({ title: t, updated_at: new Date().toISOString() }).eq('id', postId)
    setPost(prev => ({ ...prev, title: t }))
    setEditingTitle(false)
  }

  async function updateField(field, value) {
    await supabase.from('posts').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', postId)
    setPost(prev => ({ ...prev, [field]: value }))
  }

  // ── Category management ───────────────────────────────────────────────────

  async function toggleCategory(cat) {
    const has = categories.some(c => c.id === cat.id)
    if (has) {
      await supabase.from('post_categories').delete().eq('post_id', postId).eq('category_id', cat.id)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
    } else {
      await supabase.from('post_categories').insert({ post_id: postId, category_id: cat.id })
      setCategories(prev => [...prev, cat])
    }
  }

  async function createCategory(name, color) {
    const { data, error } = await supabase.from('categories').insert({ name, color, type: 'post' }).select().single()
    if (!error && data) {
      setAllCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      await supabase.from('post_categories').insert({ post_id: postId, category_id: data.id })
      setCategories(prev => [...prev, data])
    }
  }

  async function deleteCategory(catId) {
    await supabase.from('categories').delete().eq('id', catId)
    setAllCategories(prev => prev.filter(c => c.id !== catId))
    setCategories(prev => prev.filter(c => c.id !== catId))
  }

  // ── Library linking ──────────────────────────────────────────────────────

  async function linkPhoto(photo) {
    await supabase.from('post_linked_photos').insert({ post_id: postId, photo_id: photo.id })
    setLinkedPhotos(prev => [...prev, photo])
  }

  async function unlinkPhoto(photoId) {
    await supabase.from('post_linked_photos').delete().eq('post_id', postId).eq('photo_id', photoId)
    setLinkedPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  async function linkTrack(track) {
    await supabase.from('post_linked_tracks').insert({ post_id: postId, track_id: track.id })
    setLinkedTracks(prev => [...prev, track])
  }

  async function unlinkTrack(trackId) {
    await supabase.from('post_linked_tracks').delete().eq('post_id', postId).eq('track_id', trackId)
    setLinkedTracks(prev => prev.filter(t => t.id !== trackId))
  }

  // ── Asset upload ──────────────────────────────────────────────────────────

  async function handleFiles(files) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `post-assets/${postId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
      if (upErr) continue
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const fileType = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'image' : 'other'
      const { data: asset } = await supabase
        .from('post_assets')
        .insert({ post_id: postId, file_path: urlData.publicUrl, file_type: fileType, order_index: assets.length })
        .select()
        .single()
      if (asset) setAssets(prev => [...prev, asset])
    }
    setUploading(false)
  }

  async function handleDeleteAsset() {
    const asset = deleteAssetTarget
    // Extract storage path from URL
    const url = asset.file_path
    const bucketMarker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(bucketMarker)
    if (idx !== -1) {
      const storagePath = decodeURIComponent(url.slice(idx + bucketMarker.length))
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
    await supabase.from('post_assets').delete().eq('id', asset.id)
    setAssets(prev => prev.filter(a => a.id !== asset.id))
    if (lightboxIdx !== null) {
      const newAssets = assets.filter(a => a.id !== asset.id)
      if (newAssets.length === 0) setLightboxIdx(null)
      else setLightboxIdx(prev => Math.min(prev, newAssets.length - 1))
    }
    setDeleteAssetTarget(null)
  }

  const onDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading…</div>
  if (!post) return <div className="p-7 text-stone-400 text-sm">Post not found.</div>

  const status = POST_STATUSES[post.status]
  const imageAssets = assets.filter(a => a.file_type === 'image' || a.file_type === 'video')

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-7 pt-6 pb-4 border-b border-stone-200 bg-white flex-shrink-0">
          <button
            onClick={() => navigate('/posts')}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors mb-3 inline-flex items-center gap-1"
          >
            ← All Posts
          </button>
          <div className="flex items-start gap-2">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                className="font-serif text-3xl text-stone-800 outline-none border-b border-amber-600 bg-transparent flex-1"
              />
            ) : (
              <h1
                className="font-serif text-3xl text-stone-800 cursor-pointer hover:text-stone-600 transition-colors flex-1"
                onClick={() => setEditingTitle(true)}
                title="Click to rename"
              >
                {post.title}
              </h1>
            )}
          </div>
          {categories.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {categories.map(cat => (
                <span
                  key={cat.id}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: cat.color + '25', color: cat.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Asset grid */}
        <div
          className="flex-1 overflow-y-auto p-7"
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
        >
          {assets.length === 0 && !uploading ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center py-20 cursor-pointer hover:border-stone-300 transition-colors text-stone-400"
            >
              <p className="text-3xl mb-3">+</p>
              <p className="text-sm font-medium">Drop files or click to upload</p>
              <p className="text-xs mt-1">Photos and videos</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 mb-4">
                {assets.map((asset, i) => (
                  <AssetTile
                    key={asset.id}
                    asset={asset}
                    onClick={() => setLightboxIdx(i)}
                    onDelete={(e) => { e.stopPropagation(); setDeleteAssetTarget(asset) }}
                  />
                ))}
                {uploading && (
                  <div className="aspect-square bg-stone-100 rounded-xl flex items-center justify-center">
                    <span className="text-stone-400 text-xs">Uploading…</span>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center text-stone-300 hover:border-stone-400 hover:text-stone-400 transition-colors text-2xl"
                >
                  +
                </button>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Side panel */}
      <div className="w-64 border-l border-stone-200 bg-white flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-5 flex flex-col gap-5">

          {/* Status */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(POST_STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => updateField('status', key)}
                  className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                  style={post.status === key
                    ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                    : { borderColor: '#e7e5e4', color: '#78716c' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => updateField('type', post.type === t ? null : t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    post.type === t
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Platform</p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => updateField('platform', post.platform === p ? null : p)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    post.platform === p
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Notes</p>
            <DescriptionEditor
              value={post.description || ''}
              onSave={val => updateField('description', val)}
            />
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-stone-400">Categories</p>
              <button
                onClick={() => setShowCategoryPanel(p => !p)}
                className="text-[10px] text-stone-400 hover:text-amber-700 transition-colors"
              >
                Manage
              </button>
            </div>
            {allCategories.length === 0 ? (
              <p className="text-xs text-stone-300 italic">No categories yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {allCategories.map(cat => {
                  const active = categories.some(c => c.id === cat.id)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                        active ? 'bg-stone-100' : 'hover:bg-stone-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-left text-stone-600">{cat.name}</span>
                      {active && <span className="text-stone-400">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Linked Media */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-stone-400">Linked Media</p>
              <button
                onClick={() => setShowLibraryLinker(true)}
                className="text-[10px] text-stone-400 hover:text-amber-700 transition-colors"
              >
                + Link
              </button>
            </div>
            {linkedPhotos.length === 0 && linkedTracks.length === 0 ? (
              <p className="text-xs text-stone-300 italic">Link photos or audio from your library</p>
            ) : (
              <div className="flex flex-col gap-1">
                {linkedPhotos.map(photo => (
                  <div key={photo.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-stone-50 group">
                    <span className="w-4 text-center text-stone-300">◻</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-600 truncate">{photo.name}</p>
                      {photo.collections?.name && (
                        <p className="text-[10px] text-stone-300 truncate">from {photo.collections.name}</p>
                      )}
                    </div>
                    <button onClick={() => unlinkPhoto(photo.id)} className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block flex-shrink-0">✕</button>
                  </div>
                ))}
                {linkedTracks.map(track => (
                  <div key={track.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-stone-50 group">
                    <span className="w-4 text-center text-stone-300">♩</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-600 truncate">{track.name}</p>
                      {track.audio_projects?.name && (
                        <p className="text-[10px] text-stone-300 truncate">from {track.audio_projects.name}</p>
                      )}
                    </div>
                    <button onClick={() => unlinkTrack(track.id)} className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block flex-shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sources */}
          {(linkedPhotos.length > 0 || linkedTracks.length > 0) && (() => {
            const photoSources = [...new Map(linkedPhotos.filter(p => p.collections).map(p => [p.collections.id, p.collections])).values()]
            const audioSources = [...new Map(linkedTracks.filter(t => t.audio_projects).map(t => [t.audio_projects.id, t.audio_projects])).values()]
            if (photoSources.length === 0 && audioSources.length === 0) return null
            return (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Sources</p>
                <div className="flex flex-col gap-1">
                  {photoSources.map(col => (
                    <button
                      key={col.id}
                      onClick={() => navigate(`/collections/${col.id}`)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-stone-600 hover:bg-stone-50 transition-colors text-left"
                    >
                      <span className="w-4 text-center text-stone-300">◻</span>
                      <span className="truncate">{col.name}</span>
                    </button>
                  ))}
                  {audioSources.map(proj => (
                    <button
                      key={proj.id}
                      onClick={() => navigate(`/audio/${proj.id}`)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-stone-600 hover:bg-stone-50 transition-colors text-left"
                    >
                      <span className="w-4 text-center text-stone-300">♩</span>
                      <span className="truncate">{proj.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Dates */}
          <div className="text-xs text-stone-300 pt-2 border-t border-stone-100">
            <p>Created {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Category manage panel */}
      {showCategoryPanel && (
        <CategoryPanel
          categories={allCategories}
          type="post"
          onClose={() => setShowCategoryPanel(false)}
          onCreate={createCategory}
          onDelete={deleteCategory}
        />
      )}

      {/* Library linker */}
      {showLibraryLinker && (
        <LibraryLinker
          linkedPhotos={linkedPhotos}
          linkedTracks={linkedTracks}
          onLinkPhoto={linkPhoto}
          onUnlinkPhoto={unlinkPhoto}
          onLinkTrack={linkTrack}
          onUnlinkTrack={unlinkTrack}
          onClose={() => setShowLibraryLinker(false)}
        />
      )}

      {/* Asset lightbox */}
      {lightboxIdx !== null && imageAssets.length > 0 && (
        <Lightbox
          assets={imageAssets}
          idx={lightboxIdx}
          setIdx={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDelete={(asset) => setDeleteAssetTarget(asset)}
        />
      )}

      {/* Delete asset confirm */}
      {deleteAssetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="font-serif text-xl text-stone-800 mb-2">Delete asset?</h2>
            <p className="text-sm text-stone-500 mb-6">This file will be permanently deleted from storage.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteAssetTarget(null)} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
              <button onClick={handleDeleteAsset} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Asset tile ─────────────────────────────────────────────────────────────────

function AssetTile({ asset, onClick, onDelete }) {
  const isVideo = asset.file_type === 'video'
  return (
    <button
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden bg-stone-100"
    >
      {isVideo ? (
        <video src={asset.file_path} className="w-full h-full object-cover" muted />
      ) : (
        <img src={asset.file_path} alt="" className="w-full h-full object-cover" loading="lazy" />
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className="text-white text-xl drop-shadow">▷</span>
        </div>
      )}
      <button
        onClick={onDelete}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/50 text-white items-center justify-center text-[10px] hidden group-hover:flex hover:bg-black/70 transition-colors"
      >
        ✕
      </button>
    </button>
  )
}

// ── Lightbox ───────────────────────────────────────────────────────────────────

function Lightbox({ assets, idx, setIdx, onClose, onDelete }) {
  const asset = assets[idx]
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(assets.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [assets.length])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm">
      <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white text-lg transition-colors z-10">✕</button>
      {idx > 0 && (
        <button onClick={() => setIdx(i => i - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-2xl transition-colors z-10">‹</button>
      )}
      {idx < assets.length - 1 && (
        <button onClick={() => setIdx(i => i + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-2xl transition-colors z-10">›</button>
      )}
      <div className="max-w-4xl max-h-[90vh] flex items-center justify-center p-4">
        {asset.file_type === 'video' ? (
          <video src={asset.file_path} controls className="max-w-full max-h-[85vh] rounded-xl" />
        ) : (
          <img src={asset.file_path} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        )}
      </div>
      <button
        onClick={() => onDelete(asset)}
        className="absolute bottom-4 right-4 text-xs text-white/50 hover:text-red-400 transition-colors"
      >
        Delete
      </button>
    </div>
  )
}

// ── Description editor ─────────────────────────────────────────────────────────

function DescriptionEditor({ value, onSave }) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)

  useEffect(() => { setDraft(value) }, [value])

  return editing ? (
    <textarea
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); setEditing(false) }}
      rows={4}
      className="w-full text-xs text-stone-600 border border-stone-200 rounded-md p-2 outline-none focus:border-stone-400 resize-none transition-colors"
      placeholder="Add notes…"
    />
  ) : (
    <div
      onClick={() => setEditing(true)}
      className="text-xs text-stone-500 cursor-pointer hover:text-stone-700 transition-colors min-h-[2.5rem] whitespace-pre-wrap"
    >
      {value || <span className="text-stone-300 italic">Add notes…</span>}
    </div>
  )
}

// ── Category panel ─────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#78716c']

function CategoryPanel({ categories, type, onClose, onCreate, onDelete }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onCreate(name.trim(), color)
    setName('')
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl text-stone-800">Categories</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm transition-colors">✕</button>
        </div>

        {/* Existing */}
        <div className="flex flex-col gap-1 mb-5 max-h-48 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="text-xs text-stone-300 italic text-center py-3">No categories yet</p>
          ) : categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-50 group">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm text-stone-600">{cat.name}</span>
              <button
                onClick={() => onDelete(cat.id)}
                className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Create new */}
        <form onSubmit={handleCreate} className="border-t border-stone-100 pt-4">
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">New Category</p>
          <div className="flex gap-2 mb-3">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full flex-shrink-0 transition-transform hover:scale-110"
                style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Category name"
              className="flex-1 border border-stone-200 rounded-md px-3 py-1.5 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="bg-stone-800 text-white text-xs px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Library linker ──────────────────────────────────────────────────────────────

function LibraryLinker({ linkedPhotos, linkedTracks, onLinkPhoto, onUnlinkPhoto, onLinkTrack, onUnlinkTrack, onClose }) {
  const [tab, setTab] = useState('photos')
  const [collections, setCollections] = useState([])
  const [audioProjects, setAudioProjects] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    supabase.from('collections').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => setCollections(data || []))
    supabase.from('audio_projects').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => setAudioProjects(data || []))
  }, [])

  async function expand(type, id) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setLoadingItems(true)
    if (type === 'collection') {
      const { data } = await supabase.from('photos').select('id, name, file_path, collection_id').eq('collection_id', id).order('created_at')
      setItems(data || [])
    } else {
      const { data } = await supabase.from('audio_tracks').select('id, name, project_id').eq('project_id', id).order('created_at')
      setItems(data || [])
    }
    setLoadingItems(false)
  }

  const linkedPhotoIds = new Set(linkedPhotos.map(p => p.id))
  const linkedTrackIds = new Set(linkedTracks.map(t => t.id))

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-serif text-xl text-stone-800">Link from Library</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 mb-3">
          <button
            onClick={() => { setTab('photos'); setExpandedId(null) }}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'photos' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Photos
          </button>
          <button
            onClick={() => { setTab('audio'); setExpandedId(null) }}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'audio' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Audio
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {tab === 'photos' ? (
            collections.length === 0 ? (
              <p className="text-xs text-stone-300 italic text-center py-6">No collections</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {collections.map(col => (
                  <div key={col.id}>
                    <button
                      onClick={() => expand('collection', col.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      <span className="text-[10px] text-stone-400">{expandedId === col.id ? '▾' : '▸'}</span>
                      <span className="truncate">{col.name}</span>
                    </button>
                    {expandedId === col.id && (
                      <div className="pl-6 flex flex-col gap-0.5 mb-1">
                        {loadingItems ? (
                          <p className="text-xs text-stone-300 py-1">Loading…</p>
                        ) : items.length === 0 ? (
                          <p className="text-xs text-stone-300 italic py-1">No photos</p>
                        ) : items.map(photo => {
                          const linked = linkedPhotoIds.has(photo.id)
                          return (
                            <button
                              key={photo.id}
                              onClick={() => linked ? onUnlinkPhoto(photo.id) : onLinkPhoto(photo)}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${linked ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
                            >
                              <span className="w-4 text-center text-stone-300">◻</span>
                              <span className="flex-1 truncate text-stone-600">{photo.name}</span>
                              {linked && <span className="text-stone-400">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            audioProjects.length === 0 ? (
              <p className="text-xs text-stone-300 italic text-center py-6">No audio projects</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {audioProjects.map(proj => (
                  <div key={proj.id}>
                    <button
                      onClick={() => expand('audio', proj.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      <span className="text-[10px] text-stone-400">{expandedId === proj.id ? '▾' : '▸'}</span>
                      <span className="truncate">{proj.name}</span>
                    </button>
                    {expandedId === proj.id && (
                      <div className="pl-6 flex flex-col gap-0.5 mb-1">
                        {loadingItems ? (
                          <p className="text-xs text-stone-300 py-1">Loading…</p>
                        ) : items.length === 0 ? (
                          <p className="text-xs text-stone-300 italic py-1">No tracks</p>
                        ) : items.map(track => {
                          const linked = linkedTrackIds.has(track.id)
                          return (
                            <button
                              key={track.id}
                              onClick={() => linked ? onUnlinkTrack(track.id) : onLinkTrack(track)}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${linked ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
                            >
                              <span className="w-4 text-center text-stone-300">♩</span>
                              <span className="flex-1 truncate text-stone-600">{track.name}</span>
                              {linked && <span className="text-stone-400">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
