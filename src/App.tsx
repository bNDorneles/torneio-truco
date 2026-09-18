import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { AdminPage } from './pages/AdminPage'
import { PublicPage } from './pages/PublicPage'
import { TvPage } from './pages/TvPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/t/:slug" element={<PublicPage />} />
        <Route path="/t/:slug/admin" element={<AdminPage />} />
        <Route path="/t/:slug/tv" element={<TvPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
