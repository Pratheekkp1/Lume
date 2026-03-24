import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, POST_TYPES, PLATFORMS } from '../lib/constants'
import { recordOpen } from '../lib/recentOpens'

const BUCKET = 'Photos'

export default function PostView() {
  const { postId } = useParams()
  const navigate = useNavigate()

  const [post, setPost] = useState(null)
  const [assets, setAssets] = useState([])
  const [categories, setCategories] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [linkedPhotos, setLinkedPhotos] = useState([])
  const [linkedTracks, setLinkedTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showCategoryPanel, setShowCategoryPanel] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [deleteAssetTarget, setDeleteAssetTarget] = useState(null)

  // Tabs & selection
  const [activeTab, setActiveTab] = useState('photos')
  const [selectedItem, setSelectedItem] = useState(null) // { kind: 'asset'|'linked_photo'|'linked_track', data }
  const [showLibraryLinker, setShowLibraryLinker] = useState(false)
  const [libraryLinkerTab, setLibraryLinkerTab] = useState('photos')

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

  // ── Metadata ────────────────────────────────────────────────────────────────

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

  // ── Categories ──────────────────────────────────────────────────────────────

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

  // ── Library linking ─────────────────────────────────────────────────────────

  async function linkPhoto(photo) {
    await supabase.from('post_linked_photos').insert({ post_id: postId, photo_id: photo.id })
    setLinkedPhotos(prev => [...prev, photo])
  }

  async function unlinkPhoto(photoId) {
    await supabase.from('post_linked_photos').delete().eq('post_id', postId).eq('photo_id', photoId)
    setLinkedPhotos(prev => prev.filter(p => p.id !== photoId))
    if (selectedItem?.kind === 'linked_photo' && selectedItem.data.id === photoId) setSelectedItem(null)
  }

  async function linkTrack(track) {
    await supabase.from('post_linked_tracks').insert({ post_id: postId, track_id: track.id })
    setLinkedTracks(prev => [...prev, track])
  }

  async function unlinkTrack(trackId) {
    await supabase.from('post_linked_tracks').delete().eq('post_id', postId).eq('track_id', trackId)
    setLinkedTracks(prev => prev.filter(t => t.id !== trackId))
    if (selectedItem?.kind === 'linked_track' && selectedItem.data.id === trackId) setSelectedItem(null)
  }

  // ── Asset upload / delete ───────────────────────────────────────────────────

  async function handleFiles(files) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `post-assets/${postId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
      if (upErr) continue
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const fileType = file.type.startsWith('video') ? 'video'
        : file.type.startsWith('audio') ? 'audio'
        : file.type.startsWith('image') ? 'image'
        : 'other'
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
    const url = asset.file_path
    const bucketMarker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(bucketMarker)
    if (idx !== -1) {
      const storagePath = decodeURIComponent(url.slice(idx + bucketMarker.length))
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
    await supabase.from('post_assets').delete().eq('id', asset.id)
    setAssets(prev => prev.filter(a => a.id !== asset.id))
    if (selectedItem?.kind === 'asset' && selectedItem.data.id === asset.id) setSelectedItem(null)
    setDeleteAssetTarget(null)
  }

  const onDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  function triggerUpload() {
    const input = fileInputRef.current
    if (!input) return
    if (activeTab === 'photos') input.accept = 'image/*'
    else if (activeTab === 'videos') input.accept = 'video/*'
    else input.accept = 'audio/*'
    input.click()
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  function selectItem(kind, data) {
    setSelectedItem({ kind, data })
  }

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading…</div>
  if (!post) return <div className="p-7 text-stone-400 text-sm">Post not found.</div>

  // Split by type
  const photoAssets = assets.filter(a => a.file_type === 'image')
  const videoAssets = assets.filter(a => a.file_type === 'video')
  const audioAssets = assets.filter(a => a.file_type === 'audio')

  const photosCount = photoAssets.length + linkedPhotos.length
  const videosCount = videoAssets.length
  const audioCount = audioAssets.length + linkedTracks.length

  // Sources
  const photoSources = [...new Map(linkedPhotos.filter(p => p.collections).map(p => [p.collections.id, p.collections])).values()]
  const audioSources = [...new Map(linkedTracks.filter(t => t.audio_projects).map(t => [t.audio_projects.id, t.audio_projects])).values()]

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
              <div className="flex-1" onClick={() => setEditingTitle(true)}>
                <h1 className="font-serif text-3xl text-stone-800 cursor-pointer hover:text-stone-600 transition-colors">
                  {post.title}
                </h1>
                <p className="text-[10px] text-stone-300 mt-0.5">Click to edit title</p>
              </div>
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

        {/* Tabs */}
        <div className="px-7 bg-white border-b border-stone-200 flex-shrink-0">
          <div className="flex gap-6">
            {[
              { key: 'photos', label: 'Photos', count: photosCount },
              { key: 'videos', label: 'Videos', count: videosCount },
              { key: 'audio', label: 'Sounds', count: audioCount },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedItem(null) }}
                className={`pb-2.5 pt-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-stone-800 text-stone-800'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab.label}
                {tab.count > 0 && <span className="ml-1 text-stone-300">{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div
          className="flex-1 overflow-y-auto p-7"
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
        >
          {/* ── Photos tab ── */}
          {activeTab === 'photos' && (
            photosCount === 0 && !uploading ? (
              <EmptyTab
                icon="◻"
                title="No photos yet"
                subtitle="Upload photos or link from your albums"
                onUpload={triggerUpload}
                onLink={() => { setLibraryLinkerTab('photos'); setShowLibraryLinker(true) }}
                linkLabel="Link from Album"
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {photoAssets.map(asset => (
                    <MediaCard
                      key={`a-${asset.id}`}
                      selected={selectedItem?.kind === 'asset' && selectedItem.data.id === asset.id}
                      onClick={() => selectItem('asset', asset)}
                      onRemove={() => setDeleteAssetTarget(asset)}
                    >
                      <img src={asset.file_path} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </MediaCard>
                  ))}
                  {linkedPhotos.map(photo => (
                    <MediaCard
                      key={`l-${photo.id}`}
                      selected={selectedItem?.kind === 'linked_photo' && selectedItem.data.id === photo.id}
                      onClick={() => selectItem('linked_photo', photo)}
                      onRemove={() => unlinkPhoto(photo.id)}
                      badge={photo.collections?.name}
                    >
                      <img
                        src={supabase.storage.from('Photos').getPublicUrl(photo.file_path).data.publicUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </MediaCard>
                  ))}
                  {uploading && <UploadingPlaceholder />}
                  <AddButton onClick={triggerUpload} />
                </div>
                <button
                  onClick={() => { setLibraryLinkerTab('photos'); setShowLibraryLinker(true) }}
                  className="mt-3 text-xs text-stone-400 hover:text-amber-700 transition-colors"
                >
                  + Link from Album
                </button>
              </>
            )
          )}

          {/* ── Videos tab ── */}
          {activeTab === 'videos' && (
            videosCount === 0 && !uploading ? (
              <EmptyTab
                icon="▷"
                title="No videos yet"
                subtitle="Upload videos to include in this post"
                onUpload={triggerUpload}
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {videoAssets.map(asset => (
                    <MediaCard
                      key={`a-${asset.id}`}
                      selected={selectedItem?.kind === 'asset' && selectedItem.data.id === asset.id}
                      onClick={() => selectItem('asset', asset)}
                      onRemove={() => setDeleteAssetTarget(asset)}
                    >
                      <video src={asset.file_path} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <span className="text-white text-xl drop-shadow">▷</span>
                      </div>
                    </MediaCard>
                  ))}
                  {uploading && <UploadingPlaceholder />}
                  <AddButton onClick={triggerUpload} />
                </div>
              </>
            )
          )}

          {/* ── Audio tab ── */}
          {activeTab === 'audio' && (
            audioCount === 0 && !uploading ? (
              <EmptyTab
                icon="♩"
                title="No sounds yet"
                subtitle="Upload audio or link from your sounds library"
                onUpload={triggerUpload}
                onLink={() => { setLibraryLinkerTab('audio'); setShowLibraryLinker(true) }}
                linkLabel="Link from Sounds"
              />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {audioAssets.map(asset => {
                    const isSelected = selectedItem?.kind === 'asset' && selectedItem.data.id === asset.id
                    const ext = asset.file_path?.split('.').pop()?.split('?')[0] || ''
                    return (
                      <button
                        key={`a-${asset.id}`}
                        onClick={() => selectItem('asset', asset)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all group ${
                          isSelected ? 'border-amber-500 bg-amber-50' : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-xs flex-shrink-0">♩</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-700 truncate">Audio{ext ? `.${ext}` : ''}</p>
                          <p className="text-[10px] text-stone-400">Uploaded</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteAssetTarget(asset) }}
                          className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block flex-shrink-0"
                        >
                          ✕
                        </button>
                      </button>
                    )
                  })}
                  {linkedTracks.map(track => {
                    const isSelected = selectedItem?.kind === 'linked_track' && selectedItem.data.id === track.id
                    return (
                      <button
                        key={`l-${track.id}`}
                        onClick={() => selectItem('linked_track', track)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all group ${
                          isSelected ? 'border-amber-500 bg-amber-50' : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-xs flex-shrink-0">♩</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-700 truncate">{track.name}</p>
                          {track.audio_projects?.name && (
                            <p className="text-[10px] text-stone-400">from {track.audio_projects.name}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); unlinkTrack(track.id) }}
                          className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block flex-shrink-0"
                        >
                          ✕
                        </button>
                      </button>
                    )
                  })}
                  {uploading && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-200">
                      <span className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-xs">…</span>
                      <span className="text-xs text-stone-400">Uploading…</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={triggerUpload} className="text-xs text-stone-400 hover:text-amber-700 transition-colors">
                    + Upload Audio
                  </button>
                  <button
                    onClick={() => { setLibraryLinkerTab('audio'); setShowLibraryLinker(true) }}
                    className="text-xs text-stone-400 hover:text-amber-700 transition-colors"
                  >
                    + Link from Sounds
                  </button>
                </div>
              </>
            )
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Side panel */}
      <div className="w-64 border-l border-stone-200 bg-white flex flex-col overflow-y-auto flex-shrink-0">
        {/* Selected item detail */}
        {selectedItem && (
          <div className="p-5 border-b border-stone-100">
            <div className="flex items-start justify-between mb-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-stone-700 truncate">
                  {selectedItem.kind === 'asset'
                    ? (selectedItem.data.file_type === 'image' ? 'Photo' : selectedItem.data.file_type === 'video' ? 'Video' : 'Audio')
                    : selectedItem.data.name
                  }
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {selectedItem.kind === 'asset' ? 'Uploaded to post' : 'Linked from library'}
                </p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-stone-300 hover:text-stone-500 text-xs flex-shrink-0 ml-2 transition-colors">✕</button>
            </div>

            {/* Source collection / project */}
            {selectedItem.kind === 'linked_photo' && selectedItem.data.collections && (
              <button
                onClick={() => navigate(`/media/${selectedItem.data.collections.id}`)}
                className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 transition-colors mt-2"
              >
                <span className="text-stone-300">◻</span>
                From: {selectedItem.data.collections.name} →
              </button>
            )}
            {selectedItem.kind === 'linked_track' && selectedItem.data.audio_projects && (
              <button
                onClick={() => navigate(`/sounds/${selectedItem.data.audio_projects.id}`)}
                className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 transition-colors mt-2"
              >
                <span className="text-stone-300">♩</span>
                From: {selectedItem.data.audio_projects.name} →
              </button>
            )}

            {/* Actions */}
            <div className="mt-3">
              {selectedItem.kind === 'asset' ? (
                <button
                  onClick={() => setDeleteAssetTarget(selectedItem.data)}
                  className="text-xs text-red-400 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (selectedItem.kind === 'linked_photo') unlinkPhoto(selectedItem.data.id)
                    else unlinkTrack(selectedItem.data.id)
                  }}
                  className="text-xs text-red-400 hover:text-red-500 transition-colors"
                >
                  Unlink
                </button>
              )}
            </div>
          </div>
        )}

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

          {/* Sources */}
          {(photoSources.length > 0 || audioSources.length > 0) && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Sources</p>
              <div className="flex flex-col gap-1">
                {photoSources.map(col => (
                  <button
                    key={col.id}
                    onClick={() => navigate(`/media/${col.id}`)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-stone-600 hover:bg-stone-50 transition-colors text-left"
                  >
                    <span className="w-4 text-center text-stone-300">◻</span>
                    <span className="truncate">{col.name}</span>
                  </button>
                ))}
                {audioSources.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => navigate(`/sounds/${proj.id}`)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-stone-600 hover:bg-stone-50 transition-colors text-left"
                  >
                    <span className="w-4 text-center text-stone-300">♩</span>
                    <span className="truncate">{proj.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
          initialTab={libraryLinkerTab}
          linkedPhotos={linkedPhotos}
          linkedTracks={linkedTracks}
          onLinkPhoto={linkPhoto}
          onUnlinkPhoto={unlinkPhoto}
          onLinkTrack={linkTrack}
          onUnlinkTrack={unlinkTrack}
          onClose={() => setShowLibraryLinker(false)}
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

// ── Media card (grid item) ──────────────────────────────────────────────────────

function MediaCard({ selected, onClick, onRemove, badge, children }) {
  return (
    <div
      onClick={onClick}
      className={`group relative aspect-square rounded-xl overflow-hidden bg-stone-100 cursor-pointer ring-2 transition-all ${
        selected ? 'ring-amber-500' : 'ring-transparent hover:ring-stone-300'
      }`}
    >
      {children}
      {badge && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/50 to-transparent">
          <p className="text-[10px] text-white/80 truncate">{badge}</p>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/50 text-white items-center justify-center text-[10px] hidden group-hover:flex hover:bg-black/70 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

// ── Empty tab placeholder ───────────────────────────────────────────────────────

function EmptyTab({ icon, title, subtitle, onUpload, onLink, linkLabel }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-3xl text-stone-200 mb-3">{icon}</p>
      <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
      <p className="text-xs text-stone-400 mb-4">{subtitle}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onUpload}
          className="bg-stone-800 text-white text-xs px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          Upload
        </button>
        {onLink && (
          <button
            onClick={onLink}
            className="border border-stone-200 text-stone-500 text-xs px-4 py-2 rounded-md hover:border-stone-400 transition-colors"
          >
            {linkLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Small helpers ───────────────────────────────────────────────────────────────

function UploadingPlaceholder() {
  return (
    <div className="aspect-square bg-stone-100 rounded-xl flex items-center justify-center">
      <span className="text-stone-400 text-xs">Uploading…</span>
    </div>
  )
}

function AddButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center text-stone-300 hover:border-stone-400 hover:text-stone-400 transition-colors text-2xl"
    >
      +
    </button>
  )
}

// ── Description editor ──────────────────────────────────────────────────────────

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

// ── Category panel ──────────────────────────────────────────────────────────────

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

function LibraryLinker({ initialTab = 'photos', linkedPhotos, linkedTracks, onLinkPhoto, onUnlinkPhoto, onLinkTrack, onUnlinkTrack, onClose }) {
  const [tab, setTab] = useState(initialTab)
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

        <div className="flex gap-1 px-5 mb-3">
          <button
            onClick={() => { setTab('photos'); setExpandedId(null) }}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'photos' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Albums
          </button>
          <button
            onClick={() => { setTab('audio'); setExpandedId(null) }}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'audio' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Sounds
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {tab === 'photos' ? (
            collections.length === 0 ? (
              <p className="text-xs text-stone-300 italic text-center py-6">No albums</p>
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
              <p className="text-xs text-stone-300 italic text-center py-6">No sound projects</p>
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
