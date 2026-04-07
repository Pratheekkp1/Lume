import { useState, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { uploadPhotoToAlbum, uploadTrackToProject } from '../../lib/upload'
import UploadDestinationModal from '../ui/UploadDestinationModal'

function categorizeFiles(files) {
  const media = []
  const audio = []
  for (const f of files) {
    if (f.type.startsWith('image/') || f.type.startsWith('video/')) media.push(f)
    else if (f.type.startsWith('audio/')) audio.push(f)
  }
  return { media, audio }
}

function getRouteContext(pathname) {
  const postMatch = pathname.match(/^\/posts\/([^/]+)$/)
  if (postMatch) return { type: 'post', id: postMatch[1] }

  const albumMatch = pathname.match(/^\/media\/([^/]+)$/)
  if (albumMatch) return { type: 'album', id: albumMatch[1] }

  const soundMatch = pathname.match(/^\/sounds\/([^/]+)$/)
  if (soundMatch) return { type: 'sound', id: soundMatch[1] }

  return { type: 'generic' }
}

export default function GlobalDropZone({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const dragCounter = useRef(0)

  const [isDragging, setIsDragging] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('album')
  const [pendingFiles, setPendingFiles] = useState({ media: [], audio: [] })

  // Toast state
  const [toast, setToast] = useState(null) // { message, link }
  const toastTimer = useRef(null)

  function showToast(message, link) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, link })
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const handleDragEnter = useCallback((e) => {
    // Only react to external file drags
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback((e) => {
    dragCounter.current = 0
    setIsDragging(false)

    // If a child handler (PostView, react-dropzone) already claimed this, skip
    if (e.defaultPrevented) return
    e.preventDefault()

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const { media, audio } = categorizeFiles(files)
    if (media.length === 0 && audio.length === 0) return

    const ctx = getRouteContext(location.pathname)

    // PostView: forward files via CustomEvent
    if (ctx.type === 'post') {
      window.dispatchEvent(new CustomEvent('lume-global-drop', { detail: { files } }))
      return
    }

    // AlbumView: upload media directly, prompt for audio
    if (ctx.type === 'album') {
      if (media.length > 0) {
        uploadMediaToAlbum(media, ctx.id)
      }
      if (audio.length > 0) {
        setPendingFiles({ media: [], audio })
        setModalMode('project')
        setShowModal(true)
      }
      return
    }

    // SoundView: upload audio directly, prompt for media
    if (ctx.type === 'sound') {
      if (audio.length > 0) {
        uploadAudioToProject(audio, ctx.id)
      }
      if (media.length > 0) {
        setPendingFiles({ media, audio: [] })
        setModalMode('album')
        setShowModal(true)
      }
      return
    }

    // Generic pages: prompt for destination
    if (media.length > 0 && audio.length > 0) {
      setPendingFiles({ media, audio })
      setModalMode('both')
    } else if (media.length > 0) {
      setPendingFiles({ media, audio: [] })
      setModalMode('album')
    } else {
      setPendingFiles({ media: [], audio })
      setModalMode('project')
    }
    setShowModal(true)
  }, [location.pathname])

  async function uploadMediaToAlbum(files, albumId) {
    const results = await Promise.all(files.map(f => uploadPhotoToAlbum(f, albumId)))
    const success = results.filter(Boolean).length
    showToast(`${success} ${success === 1 ? 'file' : 'files'} uploaded to album`, `/media/${albumId}`)
    window.dispatchEvent(new CustomEvent('lume-media-updated'))
  }

  async function uploadAudioToProject(files, projectId) {
    const results = await Promise.all(files.map(f => uploadTrackToProject(f, projectId)))
    const success = results.filter(Boolean).length
    showToast(`${success} ${success === 1 ? 'track' : 'tracks'} uploaded to project`, `/sounds/${projectId}`)
    window.dispatchEvent(new CustomEvent('lume-sounds-updated'))
  }

  async function handleModalSelect({ albumId, projectId }) {
    setShowModal(false)
    const { media, audio } = pendingFiles

    if (media.length > 0 && albumId) {
      await uploadMediaToAlbum(media, albumId)
    }
    if (audio.length > 0 && projectId) {
      await uploadAudioToProject(audio, projectId)
    }

    setPendingFiles({ media: [], audio: [] })
  }

  function handleModalCancel() {
    setShowModal(false)
    setPendingFiles({ media: [], audio: [] })
  }

  const ctx = getRouteContext(location.pathname)
  let overlayMessage = 'Drop files to upload'
  if (ctx.type === 'post') overlayMessage = 'Drop to add to this post'
  else if (ctx.type === 'album') overlayMessage = 'Drop to add to this album'
  else if (ctx.type === 'sound') overlayMessage = 'Drop to add to this project'

  return (
    <div
      className="relative h-screen flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[45] bg-stone-900/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl p-12 shadow-2xl text-center">
            <div className="text-4xl mb-4 text-stone-300">&#8593;</div>
            <p className="text-lg font-serif text-stone-700">{overlayMessage}</p>
            <p className="text-sm text-stone-400 mt-2">Photos, videos, or audio files</p>
          </div>
        </div>
      )}

      {/* Destination modal */}
      {showModal && (
        <UploadDestinationModal
          mode={modalMode}
          fileCount={pendingFiles.media.length + pendingFiles.audio.length}
          onSelect={handleModalSelect}
          onCancel={handleModalCancel}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[55] bg-stone-800 text-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <span className="text-sm">{toast.message}</span>
          {toast.link && (
            <button
              onClick={() => { navigate(toast.link); setToast(null) }}
              className="text-xs text-teal-300 hover:text-teal-200 font-medium"
            >
              View
            </button>
          )}
        </div>
      )}
    </div>
  )
}
