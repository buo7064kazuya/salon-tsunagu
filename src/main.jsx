import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import BookingPage from './components/BookingPage.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/book/:salonId" element={<BookingPage />} />
        <Route path="*" element={
          <AuthProvider>
            <App />
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
