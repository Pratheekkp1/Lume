import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import GlobalDropZone from './components/layout/GlobalDropZone'
import Toast from './components/ui/Toast'
import Topbar from './components/layout/Topbar'
import Sidebar from './components/layout/Sidebar'
import { purgeExpired } from './lib/trash'
import CommandPalette from './components/ui/CommandPalette'
import KeyboardShortcuts from './components/ui/KeyboardShortcuts'
import Login from './pages/Login'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import { isConfigured } from './lib/supabase'

// Pages are split into their own chunks so the first load only pulls in the shell
// and the route being opened.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AlbumView = lazy(() => import('./pages/AlbumView'))
const Posts = lazy(() => import('./pages/Posts'))
const PostView = lazy(() => import('./pages/PostView'))
const SoundView = lazy(() => import('./pages/SoundView'))
const Library = lazy(() => import('./pages/Library'))
const Settings = lazy(() => import('./pages/Settings'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const CampaignView = lazy(() => import('./pages/CampaignView'))
const Brand = lazy(() => import('./pages/Brand'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Ideas = lazy(() => import('./pages/Ideas'))
const Inspiration = lazy(() => import('./pages/Inspiration'))
const Notes = lazy(() => import('./pages/Notes'))
const Trash = lazy(() => import('./pages/Trash'))

function AlbumRedirect() {
  const { collectionId } = useParams()
  return <Navigate to={`/media/${collectionId}`} replace />
}

function SoundRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/sounds/${projectId}`} replace />
}

function SetupNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-stone-800 mb-3">Connect a Supabase project</h1>
        <p className="text-sm text-stone-500">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>lume-studio/.env.local</code>, run <code>supabase/schema.sql</code> in the SQL editor,
          then restart the dev server.
        </p>
      </div>
    </div>
  )
}

function PageFallback() {
  return <div className="p-7 text-sm text-stone-400">Loading…</div>
}

function AuthGate({ children }) {
  const { session, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-stone-400">Loading…</div>
  }
  return session ? children : <Login />
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <AuthProvider>
      <AuthGate>
        <Studio />
      </AuthGate>
    </AuthProvider>
  )
}

function Studio() {
  useEffect(() => { purgeExpired() }, [])

  return (
    <BrowserRouter>
      <GlobalDropZone>
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={<PageFallback />}>
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
              <Route path="/notes" element={<Notes />} />
              <Route path="/trash" element={<Trash />} />

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
            </Suspense>
          </main>
        </div>
      </GlobalDropZone>
      <CommandPalette />
      <KeyboardShortcuts />
      <Toast />
    </BrowserRouter>
  )
}
