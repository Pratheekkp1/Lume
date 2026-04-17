import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, POST_TYPES, PLATFORMS } from '../lib/constants'
import { recordOpen } from '../lib/recentOpens'
import useDebouncedSave from '../hooks/useDebouncedSave'
import PostMetrics from '../components/ui/PostMetrics'
import RepurposeTracker from '../components/ui/RepurposeTracker'

const BUCKET = 'Photos'

const PLATFORM_SPECS = {
  Instagram: {
    color: '#E1306C',
    formats: ['Feed (1:1, 4:5)', 'Story (9:16)', 'Reel (9:16)'],
    caption: '2,200 chars',
    fileSize: 'Images ≤ 8 MB · Videos ≤ 650 MB',
    duration: 'Reels: 15s–90s · Feed video: up to 60 min',
    tips: 'First 125 chars show before "more". Use 3–5 hashtags.',
  },
  TikTok: {
    color: '#010101',
    formats: ['Vertical 9:16'],
    caption: '2,200 chars',
    fileSize: 'Video ≤ 287.6 MB',
    duration: '15s–10 min (3min sweet spot)',
    tips: 'Hook in first 2s. Use trending sounds.',
  },
  YouTube: {
    color: '#FF0000',
    formats: ['16:9 recommended', 'Shorts: 9:16'],
    caption: '5,000 chars description',
    fileSize: 'Video ≤ 256 GB or 12 hrs',
    duration: 'Shorts: ≤ 60s · Long-form: unlimited',
    tips: 'Thumbnail drives CTR. First 150 chars of description in search.',
  },
  'Twitter/X': {
    color: '#1DA1F2',
    formats: ['16:9 or 1:1'],
    caption: '280 chars',
    fileSize: 'Images ≤ 5 MB · Video ≤ 512 MB',
    duration: 'Video: 0.5s–2 min 20s',
    tips: 'Threads for long content. Images increase engagement ~35%.',
  },
  Facebook: {
    color: '#1877F2',
    formats: ['16:9, 1:1, 4:5'],
    caption: '63,206 chars',
    fileSize: 'Video ≤ 10 GB',
    duration: 'Up to 240 min',
    tips: 'Native video gets 10x more reach. Post when audience is active.',
  },
  LinkedIn: {
    color: '#0A66C2',
    formats: ['1.91:1 or 1:1'],
    caption: '3,000 chars',
    fileSize: 'Images ≤ 10 MB · Video ≤ 5 GB',
    duration: 'Video: 3s–10 min',
    tips: 'Personal posts outperform company posts. Use 3–5 hashtags.',
  },
  Pinterest: {
    color: '#E60023',
    formats: ['2:3 vertical preferred'],
    caption: '500 chars',
    fileSize: 'Images ≤ 32 MB',
    duration: 'Video: 4s–15 min',
    tips: 'Vertical images get more saves. Add text overlay.',
  },
}

const PLATFORM_CHAR_LIMITS = {
  Instagram: 2200,
  TikTok: 2200,
  YouTube: 5000,
  'Twitter/X': 280,
  Facebook: 63206,
  LinkedIn: 3000,
  Pinterest: 500,
}

function PostPreview({ post, assets, linkedPhotos }) {
  const platforms = post?.platform || []
  const [activePlatform, setActivePlatform] = useState(null)

  const displayPlatforms = platforms.length > 0 ? platforms : ['Generic']
  // selectedPlatform: use activePlatform if it's still valid, else fall back to first
  const selectedPlatform = (activePlatform && platforms.includes(activePlatform))
    ? activePlatform
    : displayPlatforms[0]
  const caption = post?.caption || ''
  const title = post?.title || 'Untitled Post'

  // Find first image URL
  const firstImageAsset = assets.find(a => a.file_type === 'image')
  const firstLinkedPhoto = linkedPhotos[0]
  let thumbUrl = null
  if (firstImageAsset) {
    thumbUrl = firstImageAsset.file_path
  } else if (firstLinkedPhoto) {
    thumbUrl = supabase.storage.from('Photos').getPublicUrl(firstLinkedPhoto.file_path).data.publicUrl
  }

  const charLimit = PLATFORM_CHAR_LIMITS[selectedPlatform] || null
  const captionLen = caption.length
  const remaining = charLimit !== null ? charLimit - captionLen : null

  function ImagePlaceholder({ className }) {
    return thumbUrl ? (
      <img src={thumbUrl} alt="" className={`${className} object-cover`} />
    ) : (
      <div className={`${className} bg-stone-200 flex items-center justify-center`}>
        <span className="text-stone-400 text-xs">No image</span>
      </div>
    )
  }

  function AvatarCircle({ size = 'w-7 h-7' }) {
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-[9px] font-bold">Y</span>
      </div>
    )
  }

  function InstagramCard() {
    const previewCaption = caption.length > 125 ? caption.slice(0, 125) + '…more' : caption || 'Your caption will appear here.'
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-[11px]">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100">
          <AvatarCircle />
          <div>
            <p className="font-semibold text-stone-800 text-[11px]">yourbrand</p>
            <p className="text-stone-400 text-[9px]">Sponsored</p>
          </div>
          <span className="ml-auto text-stone-400 text-base leading-none">···</span>
        </div>
        {/* Image */}
        <ImagePlaceholder className="w-full aspect-square" />
        {/* Engagement */}
        <div className="px-3 py-2 flex items-center gap-3 border-b border-stone-100">
          <span className="text-stone-500">♡</span>
          <span className="text-stone-500">💬</span>
          <span className="text-stone-500">↗</span>
          <span className="ml-auto text-stone-500">🔖</span>
        </div>
        {/* Likes */}
        <div className="px-3 pt-1 pb-0.5">
          <p className="font-semibold text-stone-700 text-[10px]">1,024 likes</p>
        </div>
        {/* Caption */}
        <div className="px-3 pb-3 pt-0.5 text-stone-700 leading-relaxed">
          <span className="font-semibold">yourbrand </span>
          {previewCaption}
        </div>
      </div>
    )
  }

  function TwitterCard() {
    const tweet = caption.length > 280 ? caption.slice(0, 277) + '...' : caption || 'Your tweet text will appear here.'
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white p-3 text-[11px]">
        <div className="flex gap-2">
          <AvatarCircle size="w-8 h-8" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-bold text-stone-800 text-[11px]">yourbrand</span>
              <span className="text-stone-400 text-[9px]">@yourbrand · now</span>
            </div>
            <p className="text-stone-700 leading-relaxed whitespace-pre-line">{tweet}</p>
            {thumbUrl && (
              <img src={thumbUrl} alt="" className="mt-2 rounded-xl w-full aspect-video object-cover border border-stone-100" />
            )}
            {/* Engagement */}
            <div className="flex items-center gap-4 mt-2 text-stone-400">
              <span>💬 <span className="text-[10px]">12</span></span>
              <span>🔁 <span className="text-[10px]">34</span></span>
              <span>♡ <span className="text-[10px]">128</span></span>
              <span>↗</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function YouTubeCard() {
    const desc = caption.length > 150 ? caption.slice(0, 150) + '…' : caption || 'Video description.'
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-[11px]">
        <ImagePlaceholder className="w-full aspect-video" />
        <div className="p-3">
          <p className="font-bold text-stone-800 text-[12px] leading-snug line-clamp-2">{title}</p>
          <p className="text-stone-500 text-[10px] mt-1">yourbrand · 0 views · just now</p>
          <p className="text-stone-500 mt-2 leading-relaxed">{desc}</p>
        </div>
      </div>
    )
  }

  function LinkedInCard() {
    const previewCaption = caption.length > 200 ? caption.slice(0, 197) + '...more' : caption || 'Your post content will appear here.'
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-[11px]">
        <div className="flex items-center gap-2 px-3 py-2">
          <AvatarCircle size="w-8 h-8" />
          <div>
            <p className="font-semibold text-stone-800 text-[11px]">yourbrand</p>
            <p className="text-stone-400 text-[9px]">1st · just now</p>
          </div>
          <span className="ml-auto text-stone-400 text-base leading-none">···</span>
        </div>
        <div className="px-3 pb-2 text-stone-700 leading-relaxed">{previewCaption}</div>
        {thumbUrl && (
          <img src={thumbUrl} alt="" className="w-full aspect-video object-cover" />
        )}
        <div className="px-3 py-2 flex items-center gap-3 border-t border-stone-100 text-stone-400">
          <span>👍 Like</span>
          <span>💬 Comment</span>
          <span>↗ Share</span>
        </div>
      </div>
    )
  }

  function FacebookCard() {
    const previewCaption = caption.length > 200 ? caption.slice(0, 197) + '...See more' : caption || 'Your post content will appear here.'
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-[11px]">
        <div className="flex items-center gap-2 px-3 py-2">
          <AvatarCircle size="w-8 h-8" />
          <div>
            <p className="font-semibold text-stone-800 text-[11px]">yourbrand</p>
            <p className="text-stone-400 text-[9px]">Just now · 🌐</p>
          </div>
          <span className="ml-auto text-stone-400 text-base leading-none">···</span>
        </div>
        <div className="px-3 pb-2 text-stone-700 leading-relaxed">{previewCaption}</div>
        {thumbUrl && (
          <img src={thumbUrl} alt="" className="w-full aspect-video object-cover" />
        )}
        <div className="px-3 py-2 flex items-center gap-4 border-t border-stone-100 text-stone-400">
          <span>👍 Like</span>
          <span>💬 Comment</span>
          <span>↗ Share</span>
        </div>
      </div>
    )
  }

  function GenericCard() {
    const previewCaption = caption.length > 200 ? caption.slice(0, 197) + '...' : caption || 'Your post content will appear here.'
    return (
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-[11px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100">
          <AvatarCircle />
          <span className="font-semibold text-stone-800">yourbrand</span>
        </div>
        <ImagePlaceholder className="w-full aspect-video" />
        <div className="p-3">
          <p className="font-semibold text-stone-800 mb-1 text-[12px]">{title}</p>
          <p className="text-stone-600 leading-relaxed">{previewCaption}</p>
        </div>
      </div>
    )
  }

  function renderCard(platform) {
    if (platform === 'Instagram' || platform === 'TikTok') return <InstagramCard />
    if (platform === 'Twitter/X') return <TwitterCard />
    if (platform === 'YouTube') return <YouTubeCard />
    if (platform === 'LinkedIn') return <LinkedInCard />
    if (platform === 'Facebook') return <FacebookCard />
    return <GenericCard />
  }

  return (
    <div className="space-y-4">
      {/* Platform selector pills */}
      {displayPlatforms.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {displayPlatforms.map(p => (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                selectedPlatform === p
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Platform label when only one */}
      {displayPlatforms.length === 1 && displayPlatforms[0] !== 'Generic' && (
        <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">{displayPlatforms[0]} preview</p>
      )}

      {/* Mock card */}
      {renderCard(selectedPlatform)}

      {/* Character limit indicator + copy button */}
      {charLimit !== null && (
        <div className="flex items-center justify-between text-[10px] px-1">
          <span className="text-stone-400">{selectedPlatform} caption limit</span>
          <div className="flex items-center gap-2">
            <span className={remaining < 0 ? 'text-red-500 font-semibold' : remaining < 50 ? 'text-amber-500 font-medium' : 'text-stone-400'}>
              {remaining < 0 ? `${Math.abs(remaining)} over limit` : `${remaining.toLocaleString()} remaining`}
            </span>
            {caption && (
              <button
                onClick={() => {
                  const truncated = charLimit ? caption.slice(0, charLimit) : caption
                  navigator.clipboard.writeText(truncated)
                }}
                className="text-teal-600 hover:text-teal-700 transition-colors font-medium"
                title={`Copy caption for ${selectedPlatform}`}
              >
                Copy
              </button>
            )}
          </div>
        </div>
      )}

      {/* No platform notice */}
      {platforms.length === 0 && (
        <p className="text-[10px] text-stone-400 text-center pt-1">
          Select platforms in the Details panel to see platform-specific previews.
        </p>
      )}
    </div>
  )
}

function PlatformRequirements({ platforms }) {
  const [open, setOpen] = useState(false)
  const relevant = (platforms || []).filter(p => PLATFORM_SPECS[p])
  if (relevant.length === 0) return null

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-stone-400">📋</span>
          Platform Specs
        </span>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-stone-100 divide-y divide-stone-100">
          {relevant.map(platform => {
            const spec = PLATFORM_SPECS[platform]
            return (
              <div key={platform} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: spec.color }} />
                  <span className="text-xs font-semibold text-stone-700">{platform}</span>
                </div>
                <div className="space-y-1 text-[11px] text-stone-500">
                  <div><span className="text-stone-400">Format: </span>{spec.formats.join(' · ')}</div>
                  <div><span className="text-stone-400">Caption: </span>{spec.caption}</div>
                  <div><span className="text-stone-400">File size: </span>{spec.fileSize}</div>
                  <div><span className="text-stone-400">Duration: </span>{spec.duration}</div>
                  <div className="text-teal-600 italic mt-1">{spec.tips}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PublishChecklist({ post, assets, linkedPhotos, variants, categories }) {
  const hasCaption = !!(post?.caption?.trim() || variants?.some(v => v.caption?.trim()))
  const hasMedia = assets?.length > 0 || linkedPhotos?.length > 0
  const hasPlatform = post?.platform?.length > 0
  const hasDate = !!post?.scheduled_date
  const hasType = post?.type?.length > 0
  const hasCategory = categories?.length > 0

  const items = [
    { label: 'Platform selected',    done: hasPlatform },
    { label: 'Content type set',     done: hasType },
    { label: 'Caption written',      done: hasCaption },
    { label: 'Media attached',       done: hasMedia },
    { label: 'Scheduled date set',   done: hasDate },
    { label: 'Category tagged',      done: hasCategory },
  ]
  const doneCount = items.filter(i => i.done).length
  const allDone = doneCount === items.length

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <span className="text-sm font-medium text-stone-700">Publish Checklist</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${allDone ? 'bg-teal-100 text-teal-700' : 'bg-stone-100 text-stone-500'}`}>
          {doneCount}/{items.length}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-teal-500' : 'bg-stone-100 border border-stone-300'}`}>
              {item.done && <span className="text-white text-[10px]">✓</span>}
            </div>
            <span className={`text-xs ${item.done ? 'text-stone-500 line-through decoration-stone-300' : 'text-stone-600'}`}>
              {item.label}
            </span>
          </div>
        ))}
        {allDone && (
          <p className="text-xs text-teal-600 font-medium pt-1">✨ Ready to publish!</p>
        )}
      </div>
    </div>
  )
}

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
  const [allPillars, setAllPillars] = useState([])
  const [postCampaigns, setPostCampaigns] = useState([])
  const [liveUrlDraft, setLiveUrlDraft] = useState('')
  const [liveUrlSaved, setLiveUrlSaved] = useState(false)
  const [showRepurpose, setShowRepurpose] = useState(false)
  const [repurposing, setRepurposing] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateSaved, setTemplateSaved] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [deleteAssetTarget, setDeleteAssetTarget] = useState(null)

  // Activity log
  const [activityLog, setActivityLog] = useState([])
  const [activityInput, setActivityInput] = useState('')
  const [savingActivity, setSavingActivity] = useState(false)

  // Caption history
  const [captionHistory, setCaptionHistory] = useState([])
  const [showCaptionHistory, setShowCaptionHistory] = useState(false)
  const lastSnapshotRef = useRef('')

  // Focus mode
  const [focusMode, setFocusMode] = useState(false)

  // Multi-select for assets
  const [assetSelectMode, setAssetSelectMode] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set()) // stores 'kind:id' strings
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false)

  // Variants (multi-platform)
  const [variants, setVariants] = useState([])
  const [activeVariant, setActiveVariant] = useState(null) // null = "Base", or variant id

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

  // Listen for global drag-and-drop forwarded files
  useEffect(() => {
    function onGlobalDrop(e) {
      handleFiles(e.detail.files)
    }
    window.addEventListener('lume-global-drop', onGlobalDrop)
    return () => window.removeEventListener('lume-global-drop', onGlobalDrop)
  })

  async function fetchAll() {
    const [{ data: postData }, { data: assetData }, { data: catJoins }, { data: allCats }, { data: photoLinks }, { data: trackLinks }, { data: variantData }, { data: pillarData }] = await Promise.all([
      supabase.from('posts').select('*').eq('id', postId).single(),
      supabase.from('post_assets').select('*').eq('post_id', postId).order('order_index').order('created_at'),
      supabase.from('post_categories').select('category:categories(*)').eq('post_id', postId),
      supabase.from('categories').select('*').eq('type', 'post').order('name'),
      supabase.from('post_linked_photos').select('order_index, photo_id, photo:photos(id, name, file_path, collection_id, collections(id, name))').eq('post_id', postId).order('order_index'),
      supabase.from('post_linked_tracks').select('order_index, track_id, track:audio_tracks(id, name, project_id, audio_projects(id, name))').eq('post_id', postId).order('order_index'),
      supabase.from('post_variants').select('*').eq('post_id', postId),
      supabase.from('content_pillars').select('*').order('name'),
    ])
    setPost(postData)
    setTitleDraft(postData?.title || '')
    setLiveUrlDraft(postData?.live_url || '')
    setAssets(assetData || [])
    setCategories((catJoins || []).map(j => j.category).filter(Boolean))
    setAllCategories(allCats || [])
    setLinkedPhotos((photoLinks || []).map(l => l.photo ? { ...l.photo, _order_index: l.order_index ?? 0 } : null).filter(Boolean))
    setLinkedTracks((trackLinks || []).map(l => l.track ? { ...l.track, _order_index: l.order_index ?? 0 } : null).filter(Boolean))
    setVariants(variantData || [])
    setAllPillars(pillarData || [])
    // Load campaigns for this post
    const { data: campLinks } = await supabase
      .from('campaign_posts')
      .select('campaign:campaigns(id, name, color, status)')
      .eq('post_id', postId)
    setPostCampaigns((campLinks || []).map(l => l.campaign).filter(Boolean))
    const { data: activityData } = await supabase
      .from('brand_kit')
      .select('value')
      .eq('key', `post_log_${postId}`)
      .maybeSingle()
    setActivityLog(activityData?.value || [])
    // Load caption history
    const { data: captionHistData } = await supabase
      .from('brand_kit')
      .select('value')
      .eq('key', `caption_history_${postId}`)
      .maybeSingle()
    setCaptionHistory(captionHistData?.value || [])
    setLoading(false)
  }

  // ── Caption History ─────────────────────────────────────────────────────────

  async function saveCaptionSnapshot(caption) {
    if (!caption || caption === lastSnapshotRef.current) return
    lastSnapshotRef.current = caption
    const snapshot = { id: crypto.randomUUID(), caption, created_at: new Date().toISOString() }
    setCaptionHistory(prev => {
      const updated = [snapshot, ...prev].slice(0, 15)
      supabase.from('brand_kit').upsert(
        { key: `caption_history_${postId}`, value: updated, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      return updated
    })
  }

  // ── Activity Log ────────────────────────────────────────────────────────────

  async function addActivityEntry() {
    const text = activityInput.trim()
    if (!text) return
    setSavingActivity(true)
    const entry = { id: crypto.randomUUID(), text, created_at: new Date().toISOString() }
    const updated = [entry, ...activityLog]
    setActivityLog(updated)
    setActivityInput('')
    await supabase.from('brand_kit').upsert(
      { key: `post_log_${postId}`, value: updated, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    setSavingActivity(false)
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
    if (field === 'caption') saveCaptionSnapshot(value)
  }

  // ── Variants ───────────────────────────────────────────────────────────────

  async function getOrCreateVariant(platform) {
    const existing = variants.find(v => v.platform === platform)
    if (existing) { setActiveVariant(existing.id); return }
    const { data, error } = await supabase
      .from('post_variants')
      .insert({ post_id: postId, platform })
      .select()
      .single()
    if (!error && data) {
      setVariants(prev => [...prev, data])
      setActiveVariant(data.id)
    }
  }

  async function updateVariant(variantId, fields) {
    await supabase.from('post_variants').update(fields).eq('id', variantId)
    setVariants(prev => prev.map(v => v.id === variantId ? { ...v, ...fields } : v))
  }

  async function deleteVariant(variantId) {
    await supabase.from('post_variants').delete().eq('id', variantId)
    setVariants(prev => prev.filter(v => v.id !== variantId))
    if (activeVariant === variantId) setActiveVariant(null)
  }

  const currentVariant = variants.find(v => v.id === activeVariant) || null

  function isIncludedInVariant(itemId, itemKind) {
    if (!currentVariant) return true
    const field = itemKind === 'asset' ? 'included_asset_ids'
      : itemKind === 'linked_photo' ? 'included_linked_photo_ids'
      : 'included_linked_track_ids'
    const ids = currentVariant[field]
    if (!ids) return true // null = all included
    return ids.includes(itemId)
  }

  async function toggleVariantInclusion(itemId, itemKind) {
    if (!currentVariant) return
    const field = itemKind === 'asset' ? 'included_asset_ids'
      : itemKind === 'linked_photo' ? 'included_linked_photo_ids'
      : 'included_linked_track_ids'

    // Build current set of all IDs of this kind
    let allIds
    if (itemKind === 'asset') allIds = assets.map(a => a.id)
    else if (itemKind === 'linked_photo') allIds = linkedPhotos.map(p => p.id)
    else allIds = linkedTracks.map(t => t.id)

    // Current included list (null = all)
    const current = currentVariant[field] || [...allIds]
    const included = current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId]

    // If all are included, store null (meaning "include all")
    const val = included.length === allIds.length ? null : included
    await updateVariant(currentVariant.id, { [field]: val })
  }

  // ── Repurpose ────────────────────────────────────────────────────────────────

  async function handleRepurpose(targetPlatform) {
    setRepurposing(true)
    const newTitle = `[Repurpose] ${post.title} — ${targetPlatform}`
    const { data, error } = await supabase.from('posts').insert({
      title: newTitle,
      type: post.type,
      status: 'idea',
      platform: [targetPlatform],
      caption: post.caption || null,
      description: post.description ? `Repurposed from: ${post.title}\n\n${post.description}` : `Repurposed from: ${post.title}`,
      pillar_id: post.pillar_id || null,
    }).select('id').single()
    if (!error && data) {
      // Copy linked photos
      if (linkedPhotos.length > 0) {
        await supabase.from('post_linked_photos').insert(
          linkedPhotos.map((p, i) => ({ post_id: data.id, photo_id: p.id, order_index: i }))
        )
      }
      // Copy linked tracks
      if (linkedTracks.length > 0) {
        await supabase.from('post_linked_tracks').insert(
          linkedTracks.map((t, i) => ({ post_id: data.id, track_id: t.id, order_index: i }))
        )
      }
      // Copy categories
      if (categories.length > 0) {
        await supabase.from('post_categories').insert(
          categories.map(c => ({ post_id: data.id, category_id: c.id }))
        )
      }
      window.dispatchEvent(new CustomEvent('lume-posts-updated'))
      setShowRepurpose(false)
      navigate(`/posts/${data.id}`)
    }
    setRepurposing(false)
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
    const nextOrder = assets.filter(a => a.file_type === 'image').length + linkedPhotos.length
    await supabase.from('post_linked_photos').insert({ post_id: postId, photo_id: photo.id, order_index: nextOrder })
    setLinkedPhotos(prev => [...prev, { ...photo, _order_index: nextOrder }])
  }

  async function unlinkPhoto(photoId) {
    await supabase.from('post_linked_photos').delete().eq('post_id', postId).eq('photo_id', photoId)
    setLinkedPhotos(prev => prev.filter(p => p.id !== photoId))
    if (selectedItem?.kind === 'linked_photo' && selectedItem.data.id === photoId) setSelectedItem(null)
  }

  async function linkTrack(track) {
    const nextOrder = assets.filter(a => a.file_type === 'audio').length + linkedTracks.length
    await supabase.from('post_linked_tracks').insert({ post_id: postId, track_id: track.id, order_index: nextOrder })
    setLinkedTracks(prev => [...prev, { ...track, _order_index: nextOrder }])
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

  // ── Multi-select for assets ────────────────────────────────────────────────

  function makeAssetKey(kind, id) { return `${kind}:${id}` }

  function toggleAssetSelect(kind, id) {
    const key = makeAssetKey(kind, id)
    setSelectedAssetIds(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
  }

  function deselectAllAssets() {
    setSelectedAssetIds(new Set())
    setAssetSelectMode(false)
    setConfirmBulkRemove(false)
  }

  async function bulkRemoveAssets() {
    const toRemove = [...selectedAssetIds].map(key => {
      const [kind, id] = key.split(':')
      return { kind, id }
    })

    // Remove direct assets
    const assetIds = toRemove.filter(r => r.kind === 'asset').map(r => r.id)
    if (assetIds.length > 0) {
      // Delete from storage
      for (const id of assetIds) {
        const asset = assets.find(a => a.id === id)
        if (asset) {
          const url = asset.file_path
          const bucketMarker = `/object/public/${BUCKET}/`
          const idx = url.indexOf(bucketMarker)
          if (idx !== -1) {
            const storagePath = decodeURIComponent(url.slice(idx + bucketMarker.length))
            await supabase.storage.from(BUCKET).remove([storagePath])
          }
        }
      }
      await supabase.from('post_assets').delete().in('id', assetIds)
      setAssets(prev => prev.filter(a => !assetIds.includes(a.id)))
    }

    // Unlink photos
    const photoIds = toRemove.filter(r => r.kind === 'linked_photo').map(r => r.id)
    if (photoIds.length > 0) {
      for (const photoId of photoIds) {
        await supabase.from('post_linked_photos').delete().eq('post_id', postId).eq('photo_id', photoId)
      }
      setLinkedPhotos(prev => prev.filter(p => !photoIds.includes(p.id)))
    }

    // Unlink tracks
    const trackIds = toRemove.filter(r => r.kind === 'linked_track').map(r => r.id)
    if (trackIds.length > 0) {
      for (const trackId of trackIds) {
        await supabase.from('post_linked_tracks').delete().eq('post_id', postId).eq('track_id', trackId)
      }
      setLinkedTracks(prev => prev.filter(t => !trackIds.includes(t.id)))
    }

    if (selectedItem && selectedAssetIds.has(makeAssetKey(selectedItem.kind, selectedItem.data.id))) {
      setSelectedItem(null)
    }
    setSelectedAssetIds(new Set())
    setConfirmBulkRemove(false)
    setAssetSelectMode(false)
  }

  const anyAssetSelected = selectedAssetIds.size > 0

  const onDrop = (e) => {
    e.preventDefault()
    // Only handle file uploads here; internal reorder drops are handled by item-level handlers
    if (dragActive.current) return
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
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

  // ── Drag-to-reorder ──────────────────────────────────────────────────────────

  const [dragItem, setDragItem] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragActive = useRef(false)

  function handleReorderDragStart(e, item, index) {
    dragActive.current = true
    setDragItem({ ...item, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
  }

  function handleReorderDragEnd() {
    dragActive.current = false
    setDragItem(null)
    setDragOverIndex(null)
  }

  function handleReorderDragOver(e, index) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) setDragOverIndex(index)
  }

  async function handleReorderDrop(e, targetIndex, orderedList, tabKind) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverIndex(null)
    if (!dragItem || dragItem.index === targetIndex) { setDragItem(null); return }

    const newList = [...orderedList]
    const [moved] = newList.splice(dragItem.index, 1)
    newList.splice(targetIndex, 0, moved)

    // Optimistic UI update
    applyNewOrder(newList, tabKind)
    // Persist
    await persistOrder(newList)
    setDragItem(null)
  }

  function applyNewOrder(newList, tabKind) {
    const updatedAssets = []
    const updatedLinkedPhotos = []
    const updatedLinkedTracks = []

    newList.forEach((item, i) => {
      if (item.kind === 'asset') {
        updatedAssets.push({ ...item.data, order_index: i })
      } else if (item.kind === 'linked_photo') {
        updatedLinkedPhotos.push({ ...item.data, _order_index: i })
      } else if (item.kind === 'linked_track') {
        updatedLinkedTracks.push({ ...item.data, _order_index: i })
      }
    })

    if (updatedAssets.length > 0) {
      setAssets(prev => {
        const ids = new Set(updatedAssets.map(a => a.id))
        return [...prev.filter(a => !ids.has(a.id)), ...updatedAssets]
      })
    }
    if (updatedLinkedPhotos.length > 0) setLinkedPhotos(updatedLinkedPhotos)
    if (updatedLinkedTracks.length > 0) setLinkedTracks(updatedLinkedTracks)
  }

  async function persistOrder(newList) {
    const updates = newList.map((item, i) => {
      if (item.kind === 'asset') {
        return supabase.from('post_assets').update({ order_index: i }).eq('id', item.data.id)
      } else if (item.kind === 'linked_photo') {
        return supabase.from('post_linked_photos').update({ order_index: i }).eq('post_id', postId).eq('photo_id', item.data.id)
      } else if (item.kind === 'linked_track') {
        return supabase.from('post_linked_tracks').update({ order_index: i }).eq('post_id', postId).eq('track_id', item.data.id)
      }
      return null
    }).filter(Boolean)
    await Promise.all(updates)
  }

  function buildOrderedItems(directAssets, linkedItems, linkedKind) {
    const items = [
      ...directAssets.map((a, i) => ({ kind: 'asset', data: a, order: a.order_index ?? i })),
      ...linkedItems.map((l, i) => ({ kind: linkedKind, data: l, order: l._order_index ?? (directAssets.length + i) })),
    ]
    items.sort((a, b) => a.order - b.order)
    return items
  }

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading…</div>
  if (!post) return <div className="p-7 text-stone-400 text-sm">Post not found.</div>

  // Split by type
  const photoAssets = assets.filter(a => a.file_type === 'image')
  const videoAssets = assets.filter(a => a.file_type === 'video')
  const audioAssets = assets.filter(a => a.file_type === 'audio')

  // Unified ordered lists for drag-to-reorder
  const orderedPhotos = buildOrderedItems(photoAssets, linkedPhotos, 'linked_photo')
  const orderedVideos = videoAssets.map((a, i) => ({ kind: 'asset', data: a, order: a.order_index ?? i })).sort((a, b) => a.order - b.order)
  const orderedAudio = buildOrderedItems(audioAssets, linkedTracks, 'linked_track')

  const photosCount = photoAssets.length + linkedPhotos.length
  const videosCount = videoAssets.length
  const audioCount = audioAssets.length + linkedTracks.length

  // Sources
  const photoSources = [...new Map(linkedPhotos.filter(p => p.collections).map(p => [p.collections.id, p.collections])).values()]
  const audioSources = [...new Map(linkedTracks.filter(t => t.audio_projects).map(t => [t.audio_projects.id, t.audio_projects])).values()]

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-7 pt-6 pb-4 border-b border-stone-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigate('/posts')}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors inline-flex items-center gap-1"
            >
              ← All Posts
            </button>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setFocusMode(v => !v)}
                title={focusMode ? 'Exit focus mode' : 'Focus mode — hide details panel'}
                className={`text-xs border px-2.5 py-1 rounded-md transition-all inline-flex items-center gap-1.5 ${focusMode ? 'bg-stone-800 text-white border-stone-800' : 'text-stone-400 hover:text-stone-700 border-stone-200 hover:border-stone-300'}`}
              >
                {focusMode ? '⊡ Exit focus' : '⊡ Focus'}
              </button>
              <button
                onClick={() => setShowRepurpose(true)}
                className="text-xs text-stone-400 hover:text-teal-600 border border-stone-200 hover:border-teal-300 px-2.5 py-1 rounded-md transition-all inline-flex items-center gap-1.5"
              >
                ↗ Repurpose
              </button>
              <button
                onClick={() => { setTemplateName(post?.title || ''); setShowSaveTemplate(v => !v); setTemplateSaved(false) }}
                className="text-xs text-stone-400 hover:text-stone-700 border border-stone-200 hover:border-stone-300 px-2.5 py-1 rounded-md transition-all inline-flex items-center gap-1.5"
              >
                ⊞ Save as template
              </button>
              {showSaveTemplate && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-lg z-40 p-4">
                  {templateSaved ? (
                    <p className="text-sm text-teal-600 font-medium text-center py-1">Template saved!</p>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-stone-700 mb-3">Save as template</p>
                      <input
                        autoFocus
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="Template name"
                        className="w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 outline-none focus:border-stone-400 mb-3"
                      />
                      <div className="bg-stone-50 rounded-lg p-3 mb-3 space-y-1">
                        {post?.type && (
                          <p className="text-xs text-stone-500">
                            <span className="text-stone-400">Type:</span> {post.type}
                          </p>
                        )}
                        {(post?.platform || []).length > 0 && (
                          <p className="text-xs text-stone-500">
                            <span className="text-stone-400">Platforms:</span> {(post.platform || []).join(', ')}
                          </p>
                        )}
                        {(currentVariant?.caption || post?.caption) && (
                          <p className="text-xs text-stone-500">
                            <span className="text-stone-400">Caption:</span>{' '}
                            {(currentVariant?.caption || post?.caption || '').slice(0, 80)}
                            {(currentVariant?.caption || post?.caption || '').length > 80 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowSaveTemplate(false)}
                          className="flex-1 text-xs text-stone-400 hover:text-stone-600 border border-stone-200 py-1.5 rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={savingTemplate || !templateName.trim()}
                          onClick={async () => {
                            if (!templateName.trim()) return
                            setSavingTemplate(true)
                            const { error } = await supabase.from('post_templates').insert({
                              name: templateName.trim(),
                              type: post?.type || null,
                              platform: post?.platform || null,
                              status: post?.status || null,
                              description: post?.description || null,
                              caption: currentVariant?.caption || post?.caption || null,
                            })
                            setSavingTemplate(false)
                            if (!error) {
                              setTemplateSaved(true)
                              window.dispatchEvent(new CustomEvent('lume-templates-updated'))
                              setTimeout(() => {
                                setShowSaveTemplate(false)
                                setTemplateSaved(false)
                              }, 1500)
                            }
                          }}
                          className="flex-1 text-xs bg-stone-800 text-white py-1.5 rounded-md hover:bg-stone-700 transition-colors disabled:opacity-50"
                        >
                          {savingTemplate ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                className="font-serif text-3xl text-stone-800 outline-none border-b border-teal-600 bg-transparent flex-1"
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

        {/* Platform variant tabs */}
        {(post.platform || []).length > 0 && (
          <div className="px-7 bg-white border-b border-stone-200 flex-shrink-0">
            <div className="flex gap-1 pt-2 pb-0">
              <button
                onClick={() => setActiveVariant(null)}
                className={`text-xs px-3 py-2 rounded-t-md border border-b-0 transition-colors ${
                  !activeVariant
                    ? 'bg-white text-stone-800 font-medium border-stone-200 -mb-px z-10'
                    : 'bg-stone-50 text-stone-400 border-transparent hover:text-stone-600'
                }`}
              >
                Base
              </button>
              {(post.platform || []).map(p => {
                const v = variants.find(va => va.platform === p)
                const isActive = v && activeVariant === v.id
                const hasExclusions = v && (v.included_asset_ids || v.included_linked_photo_ids || v.included_linked_track_ids)
                return (
                  <button
                    key={p}
                    onClick={() => getOrCreateVariant(p)}
                    className={`text-xs px-3 py-2 rounded-t-md border border-b-0 transition-colors ${
                      isActive
                        ? 'bg-white text-stone-800 font-medium border-stone-200 -mb-px z-10'
                        : 'bg-stone-50 text-stone-400 border-transparent hover:text-stone-600'
                    }`}
                  >
                    {p}
                    {hasExclusions && <span className="ml-1 text-teal-500 text-[9px]">●</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Caption */}
        <div className="px-7 py-4 bg-white border-b border-stone-200 flex-shrink-0">
          {currentVariant ? (
            <>
              <CaptionEditor
                key={`variant-caption-${currentVariant.id}`}
                value={currentVariant.caption || ''}
                placeholder={post.caption || 'Write your caption…'}
                onSave={val => updateVariant(currentVariant.id, { caption: val })}
                platform={currentVariant.platform}
              />
              {currentVariant.caption && (
                <button
                  onClick={() => updateVariant(currentVariant.id, { caption: null })}
                  className="text-[10px] text-stone-400 hover:text-teal-700 transition-colors mt-1"
                >
                  Reset to base caption
                </button>
              )}
              {/* Crop notes */}
              <div className="mt-3 pt-3 border-t border-stone-100">
                <CropNotesEditor
                  key={`crop-${currentVariant.id}`}
                  value={currentVariant.crop_notes || ''}
                  onSave={val => updateVariant(currentVariant.id, { crop_notes: val })}
                />
              </div>
            </>
          ) : (
            <>
              <CaptionEditor
                value={post.caption || ''}
                onSave={val => updateField('caption', val)}
              />
              {captionHistory.length > 0 && (
                <div className="relative mt-1">
                  <button
                    onClick={() => setShowCaptionHistory(v => !v)}
                    className="text-[10px] text-stone-400 hover:text-teal-600 transition-colors"
                  >
                    ↩ {captionHistory.length} version{captionHistory.length !== 1 ? 's' : ''}
                  </button>
                  {showCaptionHistory && (
                    <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-stone-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-64 overflow-y-auto">
                      <p className="text-[10px] uppercase tracking-widest text-stone-400 px-4 py-2 border-b border-stone-100">Caption History</p>
                      {captionHistory.map(snap => (
                        <div key={snap.id} className="px-4 py-3 border-b border-stone-50 last:border-0 group hover:bg-stone-50">
                          <p className="text-xs text-stone-600 line-clamp-2 mb-1">{snap.caption || '(empty)'}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-stone-400">
                              {new Date(snap.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <button
                              onClick={() => { updateField('caption', snap.caption); setShowCaptionHistory(false) }}
                              className="text-[10px] text-teal-600 hover:text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="px-7 bg-white border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-6">
            {[
              { key: 'photos', label: 'Photos', count: photosCount },
              { key: 'videos', label: 'Videos', count: videosCount },
              { key: 'audio', label: 'Sounds', count: audioCount },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedItem(null); deselectAllAssets(); }}
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
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-2.5 pt-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'activity'
                  ? 'border-stone-800 text-stone-800'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`pb-2.5 pt-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'preview'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              Preview
            </button>
            {activeTab !== 'preview' && (
              <div className="ml-auto pb-1.5 pt-2">
                <button
                  onClick={() => { setAssetSelectMode(!assetSelectMode); if (assetSelectMode) deselectAllAssets(); }}
                  className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                    assetSelectMode
                      ? 'bg-teal-500 text-white border-teal-500'
                      : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`}
                >
                  {assetSelectMode ? 'Done' : 'Select'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bulk action bar for assets */}
        {anyAssetSelected && (
          <div className="px-7 py-2 bg-stone-100 border-b border-stone-200 flex-shrink-0">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-stone-600 font-medium">{selectedAssetIds.size} item{selectedAssetIds.size !== 1 ? 's' : ''} selected</span>
              <button onClick={deselectAllAssets} className="text-stone-400 hover:text-stone-600 transition-colors">Deselect all</button>
              <div className="ml-auto flex items-center gap-2">
                {confirmBulkRemove ? (
                  <>
                    <span className="text-stone-500">Remove {selectedAssetIds.size} item{selectedAssetIds.size !== 1 ? 's' : ''}?</span>
                    <button onClick={() => setConfirmBulkRemove(false)} className="text-stone-400 hover:text-stone-600 px-2 py-1 border border-stone-200 rounded transition-colors">Cancel</button>
                    <button onClick={bulkRemoveAssets} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors">
                      Confirm
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmBulkRemove(true)}
                    className="border border-red-200 text-red-400 px-3 py-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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
                linkLabel="Browse Library"
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {orderedPhotos.map((item, idx) => (
                    <div
                      key={`${item.kind}-${item.data.id}`}
                      draggable={!assetSelectMode}
                      onDragStart={e => !assetSelectMode && handleReorderDragStart(e, item, idx)}
                      onDragEnd={handleReorderDragEnd}
                      onDragOver={e => handleReorderDragOver(e, idx)}
                      onDrop={e => handleReorderDrop(e, idx, orderedPhotos, 'photos')}
                      className={`${assetSelectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${dragOverIndex === idx && dragItem ? 'ring-2 ring-teal-400 rounded-xl' : ''}`}
                    >
                      <MediaCard
                        selected={selectedItem?.kind === item.kind && selectedItem.data.id === item.data.id}
                        onClick={() => assetSelectMode ? toggleAssetSelect(item.kind, item.data.id) : selectItem(item.kind, item.data)}
                        onRemove={() => item.kind === 'asset' ? setDeleteAssetTarget(item.data) : unlinkPhoto(item.data.id)}
                        badge={item.kind === 'linked_photo' ? item.data.collections?.name : undefined}
                        excluded={currentVariant ? !isIncludedInVariant(item.data.id, item.kind) : false}
                        onToggleInclude={currentVariant ? () => toggleVariantInclusion(item.data.id, item.kind) : undefined}
                        selectMode={assetSelectMode}
                        anySelected={anyAssetSelected}
                        checked={selectedAssetIds.has(makeAssetKey(item.kind, item.data.id))}
                        onCheck={() => toggleAssetSelect(item.kind, item.data.id)}
                      >
                        <img
                          src={item.kind === 'asset' ? item.data.file_path : supabase.storage.from('Photos').getPublicUrl(item.data.file_path).data.publicUrl}
                          alt={item.data.name || ''}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </MediaCard>
                    </div>
                  ))}
                  {uploading && <UploadingPlaceholder />}
                  <AddButton onClick={triggerUpload} />
                </div>
                <button
                  onClick={() => { setLibraryLinkerTab('photos'); setShowLibraryLinker(true) }}
                  className="mt-3 text-xs text-stone-400 hover:text-teal-700 transition-colors"
                >
                  + Browse Library
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
                  {orderedVideos.map((item, idx) => (
                    <div
                      key={`asset-${item.data.id}`}
                      draggable={!assetSelectMode}
                      onDragStart={e => !assetSelectMode && handleReorderDragStart(e, item, idx)}
                      onDragEnd={handleReorderDragEnd}
                      onDragOver={e => handleReorderDragOver(e, idx)}
                      onDrop={e => handleReorderDrop(e, idx, orderedVideos, 'videos')}
                      className={`${assetSelectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${dragOverIndex === idx && dragItem ? 'ring-2 ring-teal-400 rounded-xl' : ''}`}
                    >
                      <MediaCard
                        selected={selectedItem?.kind === 'asset' && selectedItem.data.id === item.data.id}
                        onClick={() => assetSelectMode ? toggleAssetSelect('asset', item.data.id) : selectItem('asset', item.data)}
                        onRemove={() => setDeleteAssetTarget(item.data)}
                        excluded={currentVariant ? !isIncludedInVariant(item.data.id, 'asset') : false}
                        onToggleInclude={currentVariant ? () => toggleVariantInclusion(item.data.id, 'asset') : undefined}
                        selectMode={assetSelectMode}
                        anySelected={anyAssetSelected}
                        checked={selectedAssetIds.has(makeAssetKey('asset', item.data.id))}
                        onCheck={() => toggleAssetSelect('asset', item.data.id)}
                      >
                        <video src={item.data.file_path} className="w-full h-full object-cover" muted />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <span className="text-white text-xl drop-shadow">▷</span>
                        </div>
                      </MediaCard>
                    </div>
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
                linkLabel="Browse Library"
              />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {orderedAudio.map((item, idx) => {
                    const isAsset = item.kind === 'asset'
                    const isSelected = selectedItem?.kind === item.kind && selectedItem.data.id === item.data.id
                    const ext = isAsset ? (item.data.file_path?.split('.').pop()?.split('?')[0] || '') : ''
                    const audioExcluded = currentVariant ? !isIncludedInVariant(item.data.id, item.kind) : false
                    const audioChecked = selectedAssetIds.has(makeAssetKey(item.kind, item.data.id))
                    return (
                      <div
                        key={`${item.kind}-${item.data.id}`}
                        draggable={!assetSelectMode}
                        onDragStart={e => !assetSelectMode && handleReorderDragStart(e, item, idx)}
                        onDragEnd={handleReorderDragEnd}
                        onDragOver={e => handleReorderDragOver(e, idx)}
                        onDrop={e => handleReorderDrop(e, idx, orderedAudio, 'audio')}
                        className={`${assetSelectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${dragOverIndex === idx && dragItem ? 'ring-2 ring-teal-400 rounded-xl' : ''}`}
                      >
                        <button
                          onClick={() => assetSelectMode ? toggleAssetSelect(item.kind, item.data.id) : selectItem(item.kind, item.data)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition group ${
                            audioChecked ? 'border-teal-400 bg-teal-50' : audioExcluded ? 'opacity-40 border-stone-200' : isSelected ? 'border-teal-500 bg-teal-50' : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          {(assetSelectMode || anyAssetSelected) ? (
                            <input
                              type="checkbox"
                              checked={audioChecked}
                              onChange={(e) => { e.stopPropagation(); toggleAssetSelect(item.kind, item.data.id) }}
                              onClick={e => e.stopPropagation()}
                              className="accent-teal-500 flex-shrink-0"
                            />
                          ) : currentVariant ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleVariantInclusion(item.data.id, item.kind) }}
                              className={`w-5 h-5 rounded border flex items-center justify-center text-[9px] flex-shrink-0 transition-colors ${
                                audioExcluded ? 'border-stone-300 bg-white text-stone-400' : 'border-green-500 bg-green-500 text-white'
                              }`}
                            >
                              {!audioExcluded && '✓'}
                            </button>
                          ) : null}
                          <span className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-xs flex-shrink-0">♩</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700 truncate">
                              {isAsset ? `Audio${ext ? `.${ext}` : ''}` : item.data.name}
                            </p>
                            <p className="text-[10px] text-stone-400">
                              {isAsset ? 'Uploaded' : (item.data.audio_projects?.name ? `from ${item.data.audio_projects.name}` : 'Linked')}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              isAsset ? setDeleteAssetTarget(item.data) : unlinkTrack(item.data.id)
                            }}
                            className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block flex-shrink-0"
                          >
                            ✕
                          </button>
                        </button>
                      </div>
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
                  <button onClick={triggerUpload} className="text-xs text-stone-400 hover:text-teal-700 transition-colors">
                    + Upload Audio
                  </button>
                  <button
                    onClick={() => { setLibraryLinkerTab('audio'); setShowLibraryLinker(true) }}
                    className="text-xs text-stone-400 hover:text-teal-700 transition-colors"
                  >
                    + Browse Library
                  </button>
                </div>
              </>
            )
          )}

          {/* ── Activity tab ── */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              {/* Input */}
              <div className="flex gap-2">
                <input
                  value={activityInput}
                  onChange={e => setActivityInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addActivityEntry()}
                  placeholder="Log a note, change, or update…"
                  className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400 text-stone-700 placeholder-stone-300"
                />
                <button
                  onClick={addActivityEntry}
                  disabled={!activityInput.trim() || savingActivity}
                  className="text-xs bg-teal-500 text-white px-3 py-2 rounded-lg hover:bg-teal-600 disabled:opacity-40 transition-colors"
                >
                  Log
                </button>
              </div>
              {/* Log entries */}
              {activityLog.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">No activity logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {activityLog.map(entry => (
                    <div key={entry.id} className="flex gap-3 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-stone-700">{entry.text}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Preview tab ── */}
          {activeTab === 'preview' && post && (
            <PostPreview post={post} assets={assets} linkedPhotos={linkedPhotos} />
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
      {!focusMode && <div className="w-64 border-l border-stone-200 bg-white flex flex-col overflow-y-auto flex-shrink-0">
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
                className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 transition-colors mt-2"
              >
                <span className="text-stone-300">◻</span>
                From: {selectedItem.data.collections.name} →
              </button>
            )}
            {selectedItem.kind === 'linked_track' && selectedItem.data.audio_projects && (
              <button
                onClick={() => navigate(`/sounds/${selectedItem.data.audio_projects.id}`)}
                className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 transition-colors mt-2"
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
              {POST_TYPES.map(t => {
                const selected = (post.type || []).includes(t)
                return (
                  <button
                    key={t}
                    onClick={() => {
                      const cur = post.type || []
                      const next = selected ? cur.filter(v => v !== t) : [...cur, t]
                      updateField('type', next.length > 0 ? next : null)
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? 'bg-teal-500 text-white border-teal-500'
                        : 'border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Platform</p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => {
                const selected = (post.platform || []).includes(p)
                return (
                  <button
                    key={p}
                    onClick={() => {
                      const cur = post.platform || []
                      const next = selected ? cur.filter(v => v !== p) : [...cur, p]
                      updateField('platform', next.length > 0 ? next : null)
                      // Clean up variant when platform removed
                      if (selected) {
                        const v = variants.find(va => va.platform === p)
                        if (v) deleteVariant(v.id)
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? 'bg-teal-500 text-white border-teal-500'
                        : 'border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scheduled Date */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Schedule Date</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={post.scheduled_date || ''}
                onChange={e => updateField('scheduled_date', e.target.value || null)}
                className="flex-1 border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
              />
              {post.scheduled_date && (
                <button
                  onClick={() => updateField('scheduled_date', null)}
                  className="text-stone-300 hover:text-stone-500 text-sm transition-colors"
                  title="Clear date"
                >
                  ×
                </button>
              )}
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

          {/* Content Pillar */}
          {allPillars.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Content Pillar</p>
              <div className="flex flex-col gap-1">
                {/* None option */}
                <button
                  onClick={() => updateField('pillar_id', null)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    !post.pillar_id ? 'bg-stone-100' : 'hover:bg-stone-50'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-stone-200 flex-shrink-0" />
                  <span className="flex-1 text-left text-stone-400 italic">None</span>
                  {!post.pillar_id && <span className="text-stone-400">✓</span>}
                </button>
                {allPillars.map(pillar => (
                  <button
                    key={pillar.id}
                    onClick={() => updateField('pillar_id', pillar.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      post.pillar_id === pillar.id ? 'bg-stone-100' : 'hover:bg-stone-50'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pillar.color }} />
                    <span className="flex-1 text-left text-stone-600">{pillar.emoji && `${pillar.emoji} `}{pillar.name}</span>
                    {post.pillar_id === pillar.id && <span className="text-stone-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-stone-400">Categories</p>
              <button
                onClick={() => setShowCategoryPanel(p => !p)}
                className="text-[10px] text-stone-400 hover:text-teal-700 transition-colors"
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

          {/* Campaigns */}
          {postCampaigns.length > 0 && (
            <div className="px-5 py-4 border-b border-stone-100">
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Part of Campaigns</p>
              <div className="flex flex-col gap-1">
                {postCampaigns.map(campaign => (
                  <button
                    key={campaign.id}
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-stone-600 hover:bg-stone-50 transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: campaign.color || '#9ca5b2' }} />
                    <span className="truncate">{campaign.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live URL — shown when published */}
          {post.status === 'published' && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Live URL</p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={liveUrlDraft}
                  onChange={e => { setLiveUrlDraft(e.target.value); setLiveUrlSaved(false) }}
                  onBlur={() => {
                    if (liveUrlDraft !== (post.live_url || '')) {
                      updateField('live_url', liveUrlDraft || null)
                      setLiveUrlSaved(true)
                      setTimeout(() => setLiveUrlSaved(false), 2000)
                    }
                  }}
                  placeholder="https://..."
                  className="flex-1 text-xs border border-stone-200 rounded-md px-2.5 py-1.5 outline-none focus:border-teal-400 text-stone-700 placeholder-stone-300"
                />
                {liveUrlDraft && (
                  <a
                    href={liveUrlDraft}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-teal-500 hover:text-teal-700 flex-shrink-0"
                    title="Open live URL"
                  >↗</a>
                )}
              </div>
              {liveUrlSaved && <p className="text-[10px] text-teal-500 mt-1">Saved</p>}
            </div>
          )}

          {/* Publish */}
          {(post.platform || []).length > 0 && (
            <PublishSection platforms={post.platform || []} />
          )}

          {/* Repurposing */}
          <RepurposeTracker postId={postId} />

          {/* Publish Checklist */}
          <PublishChecklist
            post={post}
            assets={assets}
            linkedPhotos={linkedPhotos}
            variants={variants}
            categories={categories}
          />

          {/* Platform Requirements */}
          <PlatformRequirements platforms={post?.platform} />

          {/* Performance Metrics */}
          <PostMetrics postId={postId} platforms={post.platform} />

          {/* Dates */}
          <div className="text-xs text-stone-300 pt-2 border-t border-stone-100">
            <p>Created {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </div>}

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

      {/* Library linker drawer */}
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

      {/* Repurpose modal */}
      {showRepurpose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowRepurpose(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="text-2xl mb-3">↗</div>
            <h2 className="font-serif text-xl text-stone-800 mb-1">Repurpose post</h2>
            <p className="text-sm text-stone-400 mb-5">
              Clone this post for a different platform. Linked assets, caption, and categories will be copied. Status resets to Idea.
            </p>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Choose platform</p>
            <div className="space-y-2">
              {PLATFORMS.filter(p => !(post.platform || []).includes(p)).map(platform => (
                <button
                  key={platform}
                  onClick={() => !repurposing && handleRepurpose(platform)}
                  disabled={repurposing}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 border border-stone-200 rounded-xl hover:border-teal-300 hover:bg-teal-50 transition-all disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-stone-700">{platform}</span>
                  <span className="ml-auto text-xs text-stone-300">→</span>
                </button>
              ))}
              {PLATFORMS.filter(p => !(post.platform || []).includes(p)).length === 0 && (
                <p className="text-sm text-stone-400 text-center py-3">This post already targets all platforms.</p>
              )}
            </div>
            <button
              onClick={() => setShowRepurpose(false)}
              className="w-full mt-4 text-xs text-stone-400 hover:text-stone-600 transition-colors py-2"
            >
              Cancel
            </button>
          </div>
        </div>
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

// ── Publish Section ─────────────────────────────────────────────────────────

const PLATFORM_REQUIREMENTS = {
  Instagram: [
    'Square (1:1) or portrait (4:5) crop for feed posts',
    'Caption max 2,200 characters',
    'Up to 30 hashtags',
    'MP4 video, max 60s for Reels',
  ],
  TikTok: [
    'Vertical (9:16) aspect ratio required',
    'Caption max 2,200 characters',
    'MP4 or MOV, max 10 min',
    'Min resolution 720×1280',
  ],
  YouTube: [
    '16:9 thumbnail (1280×720 recommended)',
    'Title max 100 characters',
    'Description max 5,000 characters',
    'Tags max 500 characters total',
  ],
  'Twitter/X': [
    'Caption max 280 characters (25,000 with Premium)',
    'Up to 4 images or 1 video per post',
    'Video max 2:20, 512 MB',
    'Image max 5 MB',
  ],
  Facebook: [
    'Caption up to 63,206 characters',
    'Square or landscape images preferred',
    'MP4 video, max 240 min',
    'Recommended image: 1200×630',
  ],
}

function PublishSection({ platforms }) {
  const [showComingSoon, setShowComingSoon] = useState(null) // platform name
  const [expanded, setExpanded] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-stone-400">Publish</p>
      </div>
      <div className="space-y-2">
        {platforms.map(platform => (
          <div key={platform} className="border border-stone-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <button
                className="flex-1 flex items-center gap-2 text-left"
                onClick={() => setExpanded(expanded === platform ? null : platform)}
              >
                <span className="text-stone-300 text-[10px]">{expanded === platform ? '▾' : '▸'}</span>
                <span className="text-sm font-medium text-stone-700">{platform}</span>
              </button>
              <button
                onClick={() => setShowComingSoon(platform)}
                className="text-[10px] text-stone-400 hover:text-teal-600 border border-stone-200 hover:border-teal-300 px-2 py-1 rounded transition-all flex-shrink-0"
              >
                Connect account
              </button>
            </div>
            {expanded === platform && PLATFORM_REQUIREMENTS[platform] && (
              <div className="border-t border-stone-100 px-3 py-3 bg-stone-50">
                <p className="text-[10px] uppercase tracking-widest text-stone-300 mb-2">Requirements</p>
                <ul className="space-y-1.5">
                  {PLATFORM_REQUIREMENTS[platform].map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-stone-500">
                      <span className="text-stone-300 mt-0.5 flex-shrink-0">◦</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Coming soon modal */}
      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowComingSoon(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-2xl mb-4">🔗</div>
            <h2 className="font-serif text-xl text-stone-800 mb-2">Connect {showComingSoon}</h2>
            <p className="text-sm text-stone-500 mb-4">
              Direct publishing to {showComingSoon} is coming in a future update. When available, you'll be able to authorize your account here and publish posts directly from Lume.
            </p>
            <div className="p-3 bg-stone-50 rounded-lg mb-5">
              <p className="text-xs text-stone-400">For now, use the platform requirements checklist above to prepare your content before publishing manually.</p>
            </div>
            <button
              onClick={() => setShowComingSoon(null)}
              className="w-full bg-stone-100 text-stone-600 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Media card (grid item) ──────────────────────────────────────────────────────

function MediaCard({ selected, onClick, onRemove, badge, excluded, onToggleInclude, checked, selectMode, anySelected, onCheck, children }) {
  return (
    <div
      onClick={onClick}
      className={`group relative aspect-square rounded-xl overflow-hidden bg-stone-100 cursor-pointer ring-2 transition ${
        checked ? 'ring-teal-400' : excluded ? 'ring-transparent opacity-40' : selected ? 'ring-teal-500' : 'ring-transparent hover:ring-stone-300'
      }`}
    >
      {children}
      {badge && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/50 to-transparent">
          <p className="text-[10px] text-white/80 truncate">{badge}</p>
        </div>
      )}
      {(selectMode || anySelected) ? (
        <div
          className="absolute top-1.5 left-1.5"
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            className="accent-teal-500"
          />
        </div>
      ) : onToggleInclude ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleInclude() }}
          className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border flex items-center justify-center text-[9px] transition-colors ${
            excluded ? 'border-stone-300 bg-white/80 text-stone-400' : 'border-green-500 bg-green-500 text-white'
          }`}
        >
          {!excluded && '✓'}
        </button>
      ) : null}
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
          className="bg-teal-500 text-white text-xs px-4 py-2 rounded-md hover:bg-teal-600 transition-colors"
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

  const saveFn = useCallback(async (val) => { await onSave(val) }, [onSave])
  const { saved, triggerSave, flush } = useDebouncedSave(saveFn)

  useEffect(() => { setDraft(value) }, [value])

  return editing ? (
    <div>
      <textarea
        autoFocus
        value={draft}
        onChange={e => { setDraft(e.target.value); triggerSave(e.target.value) }}
        onBlur={() => { flush(); setEditing(false) }}
        rows={4}
        className="w-full text-xs text-stone-600 border border-stone-200 rounded-md p-2 outline-none focus:border-stone-400 resize-none transition-colors"
        placeholder="Add notes…"
      />
      <p className={`mt-1 text-[10px] text-green-600 text-center transition-opacity duration-300 ${saved ? 'opacity-100' : 'opacity-0'}`}>Saved</p>
    </div>
  ) : (
    <div
      onClick={() => setEditing(true)}
      className="text-xs text-stone-500 cursor-pointer hover:text-stone-700 transition-colors min-h-[2.5rem] whitespace-pre-wrap"
    >
      {value || <span className="text-stone-300 italic">Add notes…</span>}
    </div>
  )
}

// ── Caption editor ──────────────────────────────────────────────────────────

function CaptionEditor({ value, onSave, placeholder = 'Write your caption…', platform = null }) {
  const [draft, setDraft] = useState(value)
  const [showHashtags, setShowHashtags] = useState(false)
  const [hashtagGroups, setHashtagGroups] = useState([])
  const saveFn = useCallback(async (val) => { await onSave(val) }, [onSave])
  const { saved, triggerSave, flush } = useDebouncedSave(saveFn)

  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    supabase.from('hashtag_groups').select('*').order('name').then(({ data }) => {
      setHashtagGroups(data || [])
    })
  }, [])

  function insertHashtags(group) {
    const tags = (group.hashtags || []).join(' ')
    const newVal = draft ? `${draft}\n${tags}` : tags
    setDraft(newVal)
    triggerSave(newVal)
    setShowHashtags(false)
  }

  const limit = platform ? PLATFORM_CHAR_LIMITS[platform] : null
  const count = draft.length
  const over = limit && count > limit
  const nearLimit = limit && count > limit * 0.9

  return (
    <div className="relative">
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); triggerSave(e.target.value) }}
        onBlur={flush}
        rows={3}
        className="w-full text-sm text-stone-700 placeholder-stone-300 outline-none resize-none bg-transparent leading-relaxed"
        placeholder={placeholder}
      />
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          {hashtagGroups.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHashtags(p => !p)}
                className="text-[10px] text-stone-400 hover:text-teal-600 transition-colors"
              >
                # Hashtags
              </button>
              {showHashtags && (
                <div className="absolute left-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg min-w-[180px] py-1 z-20">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 px-3 py-1.5">Insert group</p>
                  {hashtagGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => insertHashtags(g)}
                      className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-between gap-3"
                    >
                      <span>{g.name}</span>
                      {g.platform && <span className="text-[10px] text-stone-400">{g.platform}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className={`text-[10px] text-green-600 transition-opacity duration-300 ${saved ? 'opacity-100' : 'opacity-0'}`}>Saved</p>
        </div>
        {limit ? (
          <span className={`text-[10px] tabular-nums ${over ? 'text-red-500 font-medium' : nearLimit ? 'text-amber-500' : 'text-stone-300'}`}>
            {count}/{limit}
          </span>
        ) : (
          <span className="text-[10px] text-stone-300 tabular-nums">{count}</span>
        )}
      </div>
    </div>
  )
}

// ── Crop notes editor ────────────────────────────────────────────────────────────

function CropNotesEditor({ value, onSave }) {
  const [draft, setDraft] = useState(value)
  const saveFn = useCallback(async (val) => { await onSave(val) }, [onSave])
  const { saved, triggerSave, flush } = useDebouncedSave(saveFn)

  useEffect(() => { setDraft(value) }, [value])

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1.5">Crop Notes</p>
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); triggerSave(e.target.value) }}
        onBlur={flush}
        rows={2}
        className="w-full text-xs text-stone-600 placeholder-stone-300 outline-none resize-none bg-stone-50 rounded-md px-2.5 py-2 border border-stone-200 focus:border-stone-400 transition-colors"
        placeholder="e.g. 9:16 vertical for Reels, 1:1 for feed…"
      />
      <p className={`mt-0.5 text-[10px] text-green-600 transition-opacity duration-300 ${saved ? 'opacity-100' : 'opacity-0'}`}>Saved</p>
    </div>
  )
}

// ── Category panel ──────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#78716c']

function CategoryPanel({ categories, type, onClose, onCreate, onDelete }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

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
              {deleteTarget === cat.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { onDelete(cat.id); setDeleteTarget(null) }}
                    className="text-[10px] text-red-500 hover:text-red-600 font-medium transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteTarget(cat.id)}
                  className="text-stone-200 hover:text-red-400 text-xs transition-colors hidden group-hover:block"
                >
                  ✕
                </button>
              )}
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
              className="bg-teal-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-teal-600 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Library linker (slide-in drawer) ─────────────────────────────────────────────

function LibraryLinker({ initialTab = 'photos', linkedPhotos, linkedTracks, onLinkPhoto, onUnlinkPhoto, onLinkTrack, onUnlinkTrack, onClose }) {
  const [tab, setTab] = useState(initialTab)
  const [search, setSearch] = useState('')
  const [collections, setCollections] = useState([])
  const [audioProjects, setAudioProjects] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [selected, setSelected] = useState(new Set()) // ids for multi-select
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('collections').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('audio_projects').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
    ]).then(([{ data: cols }, { data: projs }]) => {
      setCollections(cols || [])
      setAudioProjects(projs || [])
    })
  }, [])

  // Reset selection when switching tabs
  useEffect(() => {
    setSelected(new Set())
    setExpandedId(null)
    setItems([])
    setSearch('')
  }, [tab])

  async function expand(type, id) {
    if (expandedId === id) { setExpandedId(null); setSelected(new Set()); return }
    setExpandedId(id)
    setLoadingItems(true)
    setSelected(new Set())
    if (type === 'collection') {
      const { data } = await supabase.from('photos').select('id, name, file_path, collection_id').eq('collection_id', id).is('deleted_at', null).order('created_at')
      setItems(data || [])
    } else {
      const { data } = await supabase.from('audio_tracks').select('id, name, project_id').eq('project_id', id).is('deleted_at', null).order('created_at')
      setItems(data || [])
    }
    setLoadingItems(false)
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible(filteredItems, linkedIds) {
    const unlinkable = filteredItems.filter(i => !linkedIds.has(i.id))
    if (unlinkable.length === 0) return
    const allSelected = unlinkable.every(i => selected.has(i.id))
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        unlinkable.forEach(i => next.delete(i.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        unlinkable.forEach(i => next.add(i.id))
        return next
      })
    }
  }

  async function linkSelected() {
    if (selected.size === 0) return
    setLinking(true)
    const selectedItems = items.filter(i => selected.has(i.id))
    for (const item of selectedItems) {
      if (tab === 'photos') await onLinkPhoto(item)
      else await onLinkTrack(item)
    }
    setSelected(new Set())
    setLinking(false)
  }

  const linkedPhotoIds = new Set(linkedPhotos.map(p => p.id))
  const linkedTrackIds = new Set(linkedTracks.map(t => t.id))
  const linkedIds = tab === 'photos' ? linkedPhotoIds : linkedTrackIds

  const searchLower = search.toLowerCase()
  const filteredContainers = tab === 'photos'
    ? collections.filter(c => !search || c.name.toLowerCase().includes(searchLower))
    : audioProjects.filter(p => !search || p.name.toLowerCase().includes(searchLower))

  const filteredItems = items.filter(i => !search || (i.name || '').toLowerCase().includes(searchLower))

  // Count unlinked selected
  const unlinkableSelected = [...selected].filter(id => !linkedIds.has(id)).length

  return (
    <div className="absolute inset-y-0 right-0 z-30 w-80 bg-white border-l border-stone-200 shadow-lg flex flex-col animate-slide-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg text-stone-800">Library</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm transition-colors">✕</button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={expandedId ? 'Filter items…' : (tab === 'photos' ? 'Search albums…' : 'Search projects…')}
          className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors mb-3"
        />

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setTab('photos')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'photos' ? 'bg-teal-500 text-white' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Albums
          </button>
          <button
            onClick={() => setTab('audio')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'audio' ? 'bg-teal-500 text-white' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Sounds
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Breadcrumb when expanded */}
        {expandedId && (
          <button
            onClick={() => { setExpandedId(null); setItems([]); setSelected(new Set()) }}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors mb-3"
          >
            ← All {tab === 'photos' ? 'Albums' : 'Projects'}
          </button>
        )}

        {!expandedId ? (
          /* Container list */
          filteredContainers.length === 0 ? (
            <p className="text-xs text-stone-300 italic text-center py-6">
              {search ? 'No matches' : (tab === 'photos' ? 'No albums' : 'No sound projects')}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filteredContainers.map(container => (
                <button
                  key={container.id}
                  onClick={() => expand(tab === 'photos' ? 'collection' : 'audio', container.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors text-left"
                >
                  <span className="w-5 h-5 rounded bg-stone-100 flex items-center justify-center text-stone-400 text-[10px] flex-shrink-0">
                    {tab === 'photos' ? '◻' : '♩'}
                  </span>
                  <span className="truncate flex-1">{container.name}</span>
                  <span className="text-[10px] text-stone-300">▸</span>
                </button>
              ))}
            </div>
          )
        ) : (
          /* Expanded items */
          loadingItems ? (
            <p className="text-xs text-stone-300 text-center py-6">Loading…</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs text-stone-300 italic text-center py-6">
              {search ? 'No matches' : (tab === 'photos' ? 'No photos' : 'No tracks')}
            </p>
          ) : tab === 'photos' ? (
            /* Photo grid with thumbnails */
            <>
              <button
                onClick={() => selectAllVisible(filteredItems, linkedIds)}
                className="text-[10px] text-stone-400 hover:text-teal-700 transition-colors mb-2"
              >
                {filteredItems.filter(i => !linkedIds.has(i.id)).every(i => selected.has(i.id)) ? 'Deselect all' : 'Select all unlinked'}
              </button>
              <div className="grid grid-cols-3 gap-2">
                {filteredItems.map(photo => {
                  const linked = linkedPhotoIds.has(photo.id)
                  const isSelected = selected.has(photo.id)
                  const url = supabase.storage.from('Photos').getPublicUrl(photo.file_path).data.publicUrl
                  return (
                    <button
                      key={photo.id}
                      onClick={() => {
                        if (linked) { onUnlinkPhoto(photo.id); return }
                        toggleSelect(photo.id)
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden bg-stone-100 ring-2 transition ${
                        linked ? 'ring-green-400 opacity-70' : isSelected ? 'ring-teal-500' : 'ring-transparent hover:ring-stone-300'
                      }`}
                    >
                      <img src={url} alt={photo.name || ''} className="w-full h-full object-cover" loading="lazy" />
                      {/* Checkbox overlay */}
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded border flex items-center justify-center text-[8px] ${
                        linked ? 'bg-green-500 border-green-500 text-white' : isSelected ? 'bg-teal-500 border-teal-500 text-white' : 'border-white/70 bg-black/20'
                      }`}>
                        {(linked || isSelected) && '✓'}
                      </div>
                      {/* Name tooltip on hover */}
                      {photo.name && (
                        <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/50 to-transparent">
                          <p className="text-[8px] text-white/80 truncate">{photo.name}</p>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            /* Audio list */
            <>
              <button
                onClick={() => selectAllVisible(filteredItems, linkedIds)}
                className="text-[10px] text-stone-400 hover:text-teal-700 transition-colors mb-2"
              >
                {filteredItems.filter(i => !linkedIds.has(i.id)).every(i => selected.has(i.id)) ? 'Deselect all' : 'Select all unlinked'}
              </button>
              <div className="flex flex-col gap-1">
                {filteredItems.map(track => {
                  const linked = linkedTrackIds.has(track.id)
                  const isSelected = selected.has(track.id)
                  return (
                    <button
                      key={track.id}
                      onClick={() => {
                        if (linked) { onUnlinkTrack(track.id); return }
                        toggleSelect(track.id)
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                        linked ? 'bg-green-50 text-green-700' : isSelected ? 'bg-teal-50 border border-teal-300' : 'hover:bg-stone-50 text-stone-600'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] flex-shrink-0 ${
                        linked ? 'bg-green-500 border-green-500 text-white' : isSelected ? 'bg-teal-500 border-teal-500 text-white' : 'border-stone-300'
                      }`}>
                        {(linked || isSelected) && '✓'}
                      </div>
                      <span className="w-6 h-6 rounded bg-stone-100 flex items-center justify-center text-stone-400 text-[10px] flex-shrink-0">♩</span>
                      <span className="flex-1 truncate">{track.name}</span>
                      {linked && <span className="text-[10px] text-green-500">Linked</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>

      {/* Footer action bar — shown when items are selected */}
      {unlinkableSelected > 0 && (
        <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex-shrink-0">
          <button
            onClick={linkSelected}
            disabled={linking}
            className="w-full bg-teal-600 text-white text-xs py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
          >
            {linking ? 'Linking…' : `Link ${unlinkableSelected} ${unlinkableSelected === 1 ? 'item' : 'items'}`}
          </button>
        </div>
      )}
    </div>
  )
}
