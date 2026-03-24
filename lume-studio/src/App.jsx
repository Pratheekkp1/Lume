import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Topbar from './components/layout/Topbar'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Media from './pages/Media'
import AlbumView from './pages/AlbumView'
import Posts from './pages/Posts'
import PostView from './pages/PostView'
import Sounds from './pages/Sounds'
import SoundView from './pages/SoundView'
import Settings from './pages/Settings'

function AlbumRedirect() {
  const { collectionId } = useParams()
  return <Navigate to={`/media/${collectionId}`} replace />
}

function SoundRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/sounds/${projectId}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-stone-50">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/posts" />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/media" element={<Media />} />
              <Route path="/media/:albumId" element={<AlbumView />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/posts/:postId" element={<PostView />} />
              <Route path="/sounds" element={<Sounds />} />
              <Route path="/sounds/:projectId" element={<SoundView />} />
              <Route path="/settings" element={<Settings />} />

              {/* Redirects from old routes */}
              <Route path="/collections" element={<Navigate to="/media" replace />} />
              <Route path="/collections/:collectionId" element={<AlbumRedirect />} />
              <Route path="/audio" element={<Navigate to="/sounds" replace />} />
              <Route path="/audio/:projectId" element={<SoundRedirect />} />
              <Route path="/events" element={<Navigate to="/media" replace />} />
              <Route path="/events/:eventId" element={<Navigate to="/media" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
