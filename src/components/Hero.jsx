import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const LocationIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const POPULAR_SEARCHES = [
  'Power washer', 'Camera kit', 'Camping tent', 'Kayak', 'Party tables', 'Drill set'
]

const TRUST_BADGES = [
  { icon: '🛡️', text: 'Every rental insured' },
  { icon: '✅', text: 'Verified users' },
  { icon: '🇺🇸', text: 'Nationwide' },
]

export default function Hero() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (location) params.set('loc', location)
    navigate(`/browse?${params.toString()}`)
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-rl-dark via-rl-dark-2 to-rl-dark pt-16 pb-20">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-rl-blue rounded-full opacity-10 blur-3xl" />
        <div className="absolute top-32 -left-16 w-72 h-72 bg-rl-blue-300 rounded-full opacity-8 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-48 bg-rl-blue-200 rounded-full opacity-6 blur-3xl" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle, #6BB8D4 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 bg-rl-blue/20 border border-rl-blue/30 text-rl-blue-200 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-rl-blue rounded-full animate-pulse" />
          The Amazon of Rentals — Now Live
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-4">
          Rent Anything.<br />
          <span className="text-rl-blue-300">Earn From Everything.</span>
        </h1>

        <p className="text-lg text-rl-gray-2 max-w-2xl mx-auto mb-10 leading-relaxed">
          The trusted marketplace where anyone can rent what they need or earn
          money from items sitting idle. Every rental is covered by built-in insurance.
        </p>

        {/* Search card */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto mb-6">
          {/* Item search */}
          <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rl-gray-4 border border-rl-gray-3">
            <SearchIcon />
            <input
              type="text"
              placeholder="What do you need to rent?"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-rl-dark placeholder-rl-gray-2 outline-none font-medium"
            />
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-rl-gray-3" />

          {/* Location */}
          <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rl-gray-4 border border-rl-gray-3">
            <span className="text-rl-gray-2"><LocationIcon /></span>
            <input
              type="text"
              placeholder="City or ZIP code"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="flex-1 bg-transparent text-sm text-rl-dark placeholder-rl-gray-2 outline-none font-medium"
            />
          </div>

          <button
            type="submit"
            className="bg-rl-blue text-white font-bold px-7 py-3 rounded-xl hover:bg-rl-blue-500 active:bg-rl-blue-600 transition-colors flex items-center justify-center gap-2 shrink-0 text-sm"
          >
            <SearchIcon />
            Search
          </button>
        </form>

        {/* Popular searches */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          <span className="text-xs text-rl-gray-2 font-medium">Popular:</span>
          {POPULAR_SEARCHES.map(term => (
            <button
              key={term}
              onClick={() => navigate(`/browse?q=${encodeURIComponent(term)}`)}
              className="text-xs text-rl-blue-200 hover:text-white bg-rl-blue/15 hover:bg-rl-blue/25 border border-rl-blue/20 px-3 py-1 rounded-full transition-colors"
            >
              {term}
            </button>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {TRUST_BADGES.map(badge => (
            <div key={badge.text} className="flex items-center gap-2 text-rl-gray-2 text-sm">
              <span>{badge.icon}</span>
              <span>{badge.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero stats bar */}
      <div className="relative mt-14 border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { num: '10,000+', label: 'Items Listed' },
            { num: '$0', label: 'Listing Fee' },
            { num: '100%', label: 'Insured Rentals' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{stat.num}</div>
              <div className="text-xs sm:text-sm text-rl-gray-2 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
