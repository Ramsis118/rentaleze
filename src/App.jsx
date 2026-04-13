import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import Navbar from './components/Navbar'
import CartDrawer from './components/CartDrawer'
import HomePage from './pages/HomePage'
import BrowsePage from './pages/BrowsePage'
import ListingDetailPage from './pages/ListingDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardLayout from './pages/Dashboard/DashboardLayout'
import ProfilePage from './pages/Dashboard/ProfilePage'
import MessagesPage from './pages/Dashboard/MessagesPage'
import BookingsPage from './pages/Dashboard/BookingsPage'
import SavedListingsPage from './pages/Dashboard/SavedListingsPage'
import PaymentsPage from './pages/Dashboard/PaymentsPage'
import VerificationPage from './pages/Dashboard/VerificationPage'
import { useCart } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-rl-off-white">
      <div className="text-center px-4">
        <div className="text-6xl font-black text-rl-blue-200 mb-2">404</div>
        <h2 className="text-xl font-extrabold text-rl-dark mb-2">Page not found</h2>
        <p className="text-rl-gray text-sm mb-6">This page doesn't exist yet.</p>
        <a href="/" className="btn-primary text-sm">← Back to Homepage</a>
      </div>
    </div>
  )
}

function AppContent() {
  const { cartCount, openCart } = useCart()

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar cartCount={cartCount} onCartClick={openCart} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<ProfilePage />} />
            <Route path="verification" element={<VerificationPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="saved" element={<SavedListingsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <CartDrawer />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  )
}