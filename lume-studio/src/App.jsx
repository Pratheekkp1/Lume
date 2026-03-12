import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Topbar from './components/layout/Topbar'
import Sidebar from './components/layout/Sidebar'
import PhotoCollections from './pages/PhotoCollections'

// Placeholder pages for now
const Placeholder = ({ title }) => (
  <div className="min-h-screen bg-amber-50 flex items-center justify-center">
    <h1 className="text-3xl font-serif text-amber-900">{title} — coming soon</h1>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-stone-50">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/photos" />} />
              <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
              <Route path="/photos" element={<PhotoCollections />} />
              <Route path="/photos/:collectionId" element={<Placeholder title="Collection" />} />
              <Route path="/video" element={<Placeholder title="Video Projects" />} />
              <Route path="/audio" element={<Placeholder title="Music / Audio" />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}