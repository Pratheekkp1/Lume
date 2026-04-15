import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import GlobalDropZone from './components/layout/GlobalDropZone'
import Toast from './components/ui/Toast'
import Topbar from './components/layout/Topbar'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import AlbumView from './pages/AlbumView'
import Posts from './pages/Posts'
import PostView from './pages/PostView'
import SoundView from './pages/SoundView'
import Library from './pages/Library'
import Settings from './pages/Settings'
import SearchResults from './pages/SearchResults'
import Campaigns from './pages/Campaigns'
import CampaignView from './pages/CampaignView'
import Brand from './pages/Brand'
import Analytics from './pages/Analytics'
import Ideas from './pages/Ideas'
import Inspiration from './pages/Inspiration'
import { purgeExpired } from './lib/trash'

function AlbumRedirect() {
  const { collectionId } = useParams()
  return <Navigate to={`/media/${collectionId}`} replace />
}

function SoundRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/sounds/${projectId}`} replace />
}

export default function App() {
  useEffect(() => { purgeExpired() }, [])

  return (
    <BrowserRouter>
      <GlobalDropZone>
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/posts" />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/media/:albumId" element={<AlbumView />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/posts/:postId" element={<PostView />} />
              <Route path="/sounds/:projectId" element={<SoundView />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/brand" element={<Brand />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/inspiration" element={<Inspiration />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/:campaignId" element={<CampaignView />} />
              <Route path="/ideas" element={<Ideas />} />

              {/* Redirects from old routes */}
              <Route path="/media" element={<Navigate to="/library" replace />} />
              <Route path="/sounds" element={<Navigate to="/library" replace />} />
              <Route path="/collections" element={<Navigate to="/library" replace />} />
              <Route path="/collections/:collectionId" element={<AlbumRedirect />} />
              <Route path="/audio" element={<Navigate to="/sounds" replace />} />
              <Route path="/audio/:projectId" element={<SoundRedirect />} />
              <Route path="/events" element={<Navigate to="/library" replace />} />
              <Route path="/events/:eventId" element={<Navigate to="/library" replace />} />
            </Routes>
          </main>
        </div>
      </GlobalDropZone>
      <Toast />
    </BrowserRouter>
  )
}
