import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Topbar from './components/layout/Topbar'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import PhotoCollections from './pages/PhotoCollections'
import CollectionView from './pages/CollectionView'
import Posts from './pages/Posts'
import PostView from './pages/PostView'
import AllAudio from './pages/AllAudio'
import AudioProjectView from './pages/AudioProjectView'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-stone-50">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/collections" element={<PhotoCollections />} />
              <Route path="/collections/:collectionId" element={<CollectionView />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/posts/:postId" element={<PostView />} />
              <Route path="/audio" element={<AllAudio />} />
              <Route path="/audio/:projectId" element={<AudioProjectView />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
