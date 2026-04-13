import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const onBrowse = location.pathname === '/browse'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    navigate(`/browse?q=${encodeURIComponent(searchVal)}`)
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled || onBrowse
          ? 'bg-white shadow-nav'
          : 'bg-white/95 backdrop-blur-sm shadow-nav'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-rl-blue rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm tracking-tight">R</span>
            </div>
            <span className="font-bold text-rl-dark text-lg tracking-tight">
              Rental<span className="text-rl-blue">eze</span>
            </span>
          </Link>

          {/* Center search bar (desktop) */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-md items-center bg-rl-gray-4 rounded-xl border border-rl-gray-3 focus-within:border-rl-blue focus-within:ring-2 focus-within:ring-rl-blue-200 transition-all overflow-hidden"
          >
            <span className="pl-3.5 text-rl-gray-2">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search for anything to rent..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              className="flex-1 px-3 py-2 bg-transparent text-sm text-rl-dark placeholder-rl-gray-2 outline-none"
            />
            {searchVal && (
              <button
                type="submit"
                className="mr-1 bg-rl-blue text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rl-blue-500 transition-colors"
              >
                Search
              </button>
            )}
          </form>

          {/* Right nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/browse"
              className="px-3.5 py-2 text-sm font-medium text-rl-dark-3 hover:text-rl-blue-600 hover:bg-rl-blue-50 rounded-lg transition-colors"
            >
              Browse
            </Link>
            <a
              href="/#how-it-works"
              className="px-3.5 py-2 text-sm font-medium text-rl-dark-3 hover:text-rl-blue-600 hover:bg-rl-blue-50 rounded-lg transition-colors"
            >
              How It Works
            </a>
            <div className="w-px h-5 bg-rl-gray-3 mx-1" />
            <Link to="/login" className="px-3.5 py-2 text-sm font-medium text-rl-dark-3 hover:text-rl-blue-600 hover:bg-rl-blue-50 rounded-lg transition-colors">
              Sign In
            </Link>
            <Link
              to="/signup"
              className="btn-primary text-sm py-2 px-4"
            >
              List Your Item
            </Link>
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-rl-dark-3 hover:bg-rl-gray-4"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile search */}
        <div className="md:hidden pb-3">
          <form
            onSubmit={handleSearch}
            className="flex items-center bg-rl-gray-4 rounded-xl border border-rl-gray-3 overflow-hidden"
          >
            <span className="pl-3.5 text-rl-gray-2"><SearchIcon /></span>
            <input
              type="text"
              placeholder="Search for anything..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-transparent text-sm text-rl-dark placeholder-rl-gray-2 outline-none"
            />
          </form>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-rl-gray-3 px-4 pb-4 pt-2 space-y-1">
          <Link to="/browse" className="block py-2.5 px-3 text-sm font-medium text-rl-dark-3 hover:bg-rl-blue-50 rounded-lg" onClick={() => setMobileOpen(false)}>Browse Items</Link>
          <a href="/#how-it-works" className="block py-2.5 px-3 text-sm font-medium text-rl-dark-3 hover:bg-rl-blue-50 rounded-lg" onClick={() => setMobileOpen(false)}>How It Works</a>
          <div className="pt-2 flex flex-col gap-2">
            <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-outline w-full text-center flex items-center justify-center text-sm py-2.5">Sign In</Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-center flex items-center justify-center text-sm py-2.5">List Your Item</Link>
          </div>
        </div>
      )}
    </header>
  )
}
