import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

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
const CartIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
)

export default function Navbar({ cartCount = 0, onCartClick }) {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const location = useLocation()

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        setMobileOpen(false)
    }, [location])

    const handleSearch = (e) => {
        e.preventDefault()
        if (searchQuery.trim()) {
            window.location.href = `/browse?q=${encodeURIComponent(searchQuery)}`
        }
    }

    const navLinks = [
        { to: '/browse', label: 'Browse' },
        { to: '/how-it-works', label: 'How It Works' },
    ]

    return (
        <header className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-md' : 'border-b border-rl-gray-3'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex items-center h-16 gap-4">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 shrink-0">
                        <div className="w-9 h-9 bg-rl-blue rounded-xl flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-lg">R</span>
                        </div>
                        <span className="font-bold text-rl-dark text-xl tracking-tight hidden sm:block">
                            Rental<span className="text-rl-blue">eze</span>
                        </span>
                    </Link>

                    {/* Desktop Search */}
                    <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md items-center bg-rl-gray-4 rounded-xl border border-rl-gray-3 focus-within:border-rl-blue focus-within:ring-2 focus-within:ring-rl-blue-200 transition-all overflow-hidden">
                        <span className="pl-3.5 text-rl-gray-2"><SearchIcon /></span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for anything..."
                            className="flex-1 px-3 py-2 bg-transparent text-sm text-rl-dark placeholder-rl-gray-2 outline-none"
                        />
                        {searchQuery && (
                            <button type="submit" className="mr-2 bg-rl-blue text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rl-blue-500">
                                Search
                            </button>
                        )}
                    </form>

                    {/* Desktop Nav Links */}
                    <nav className="hidden md:flex items-center gap-1 shrink-0 ml-auto">
                        {navLinks.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${location.pathname === link.to
                                        ? 'text-rl-blue bg-rl-blue-50'
                                        : 'text-rl-dark-3 hover:text-rl-blue-600 hover:bg-rl-blue-50'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}

                        <div className="w-px h-5 bg-rl-gray-3 mx-1" />

                        {/* Sign In */}
                        <button className="px-3.5 py-2 text-sm font-medium text-rl-dark-3 hover:text-rl-blue-600 hover:bg-rl-blue-50 rounded-lg transition-colors">
                            Sign In
                        </button>

                        {/* Cart Button */}
                        <button
                            onClick={onCartClick}
                            className="relative w-10 h-10 rounded-xl border border-rl-gray-3 flex items-center justify-center text-rl-dark hover:border-rl-blue hover:text-rl-blue transition-colors ml-1"
                            aria-label="Shopping cart"
                        >
                            <CartIcon />
                            {cartCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rl-blue text-white text-xs font-bold rounded-full flex items-center justify-center">
                                    {cartCount}
                                </span>
                            )}
                        </button>

                        {/* List Your Item CTA */}
                        <button className="bg-rl-blue text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-rl-blue-500 transition-colors ml-2">
                            List Your Item
                        </button>
                    </nav>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="md:hidden p-2 rounded-lg text-rl-dark hover:bg-rl-gray-4 ml-auto"
                        aria-label="Menu"
                    >
                        {mobileOpen ? <XIcon /> : <MenuIcon />}
                    </button>
                </div>

                {/* Mobile Search */}
                <div className="md:hidden pb-3">
                    <form onSubmit={handleSearch} className="flex items-center bg-rl-gray-4 rounded-xl border border-rl-gray-3 overflow-hidden">
                        <span className="pl-3.5 text-rl-gray-2"><SearchIcon /></span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for anything..."
                            className="flex-1 px-3 py-2.5 bg-transparent text-sm outline-none"
                        />
                    </form>
                </div>
            </div>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="md:hidden bg-white border-t border-rl-gray-3 px-4 pb-4 pt-2 space-y-1">
                    {navLinks.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className="block w-full text-left py-2.5 px-3 text-sm font-medium text-rl-dark-3 hover:bg-rl-blue-50 rounded-lg"
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="pt-4 flex flex-col gap-2 border-t border-rl-gray-3 mt-2">
                        <button className="border border-rl-gray-3 text-rl-dark-3 font-medium px-5 py-2.5 rounded-xl text-sm">
                            Sign In
                        </button>
                        <button className="bg-rl-blue text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
                            List Your Item
                        </button>
                    </div>
                </div>
            )}
        </header>
    )
}
