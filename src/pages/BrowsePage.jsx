import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import SearchFilters from '../components/SearchFilters'
import Footer from '../components/Footer'
import { LISTINGS, CATEGORIES } from '../data/listings'

const SORT_OPTIONS = [
  { value: 'relevance',  label: 'Best Match' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating',     label: 'Highest Rated' },
  { value: 'newest',     label: 'Newest' },
]

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
)

const GridIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
)

const ListIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
)

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function BrowsePage() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || 'all',
    minPrice: 0,
    maxPrice: 200,
    instantBook: false,
    shipping: false,
    verified: false,
    sort: 'relevance',
  })
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')

  // Sync URL params
  useEffect(() => {
    const q = searchParams.get('q') || ''
    const cat = searchParams.get('category') || 'all'
    setSearchQuery(q)
    setFilters(f => ({ ...f, category: cat }))
  }, [searchParams])

  // Filter & sort listings
  const results = useMemo(() => {
    let list = [...LISTINGS]

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q)
      )
    }

    // Category
    if (filters.category !== 'all') {
      list = list.filter(l => l.category === filters.category)
    }

    // Price
    list = list.filter(l =>
      l.pricePerDay >= filters.minPrice && l.pricePerDay <= filters.maxPrice
    )

    // Features
    if (filters.instantBook) list = list.filter(l => l.badges.includes('Instant Book'))
    if (filters.shipping)    list = list.filter(l => l.shipping)
    if (filters.verified)    list = list.filter(l => l.verified)

    // Sort
    switch (filters.sort) {
      case 'price_asc':  list.sort((a, b) => a.pricePerDay - b.pricePerDay); break
      case 'price_desc': list.sort((a, b) => b.pricePerDay - a.pricePerDay); break
      case 'rating':     list.sort((a, b) => b.rating - a.rating); break
      default: break
    }

    return list
  }, [filters, searchQuery])

  const activeCategory = CATEGORIES.find(c => c.id === filters.category)

  // Active filter chips
  const activeChips = []
  if (filters.category !== 'all') activeChips.push({ label: activeCategory?.label, key: 'category', reset: 'all' })
  if (filters.minPrice > 0 || filters.maxPrice < 200) activeChips.push({ label: `$${filters.minPrice}–$${filters.maxPrice}/day`, key: 'price', reset: null })
  if (filters.instantBook) activeChips.push({ label: 'Instant Book', key: 'instantBook', reset: false })
  if (filters.shipping) activeChips.push({ label: 'Ships to me', key: 'shipping', reset: false })
  if (filters.verified) activeChips.push({ label: 'Verified', key: 'verified', reset: false })

  const removeChip = (chip) => {
    if (chip.key === 'price') setFilters(f => ({ ...f, minPrice: 0, maxPrice: 200 }))
    else setFilters(f => ({ ...f, [chip.key]: chip.reset ?? false }))
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Browse header bar */}
      <div className="bg-white border-b border-rl-gray-3 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex items-center gap-2 btn-outline py-2 text-sm"
          >
            <FilterIcon />
            Filters
            {activeChips.length > 0 && (
              <span className="bg-rl-blue text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {activeChips.length}
              </span>
            )}
          </button>

          {/* Active filter chips */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 bg-rl-dark text-white text-xs font-medium px-3 py-1.5 rounded-full shrink-0">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')}><XIcon /></button>
              </span>
            )}
            {activeChips.map(chip => (
              <button
                key={chip.key}
                onClick={() => removeChip(chip)}
                className="inline-flex items-center gap-1.5 bg-rl-blue-100 text-rl-blue-600 border border-rl-blue-200 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-rl-blue-200 transition-colors shrink-0"
              >
                {chip.label}
                <XIcon />
              </button>
            ))}
          </div>

          {/* Desktop sort + view toggle */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <select
              value={filters.sort}
              onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
              className="input-field py-2 text-sm w-44"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center border border-rl-gray-3 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-rl-blue text-white' : 'text-rl-gray hover:bg-rl-gray-4'}`}
              >
                <GridIcon />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-rl-blue text-white' : 'text-rl-gray hover:bg-rl-gray-4'}`}
              >
                <ListIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex gap-8">
        {/* Sidebar — desktop always visible, mobile drawer */}
        <>
          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/40 z-50"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            fixed lg:static top-0 left-0 h-full lg:h-auto z-50 lg:z-auto
            w-72 lg:w-64 xl:w-72 shrink-0
            bg-white lg:bg-transparent
            shadow-2xl lg:shadow-none
            transition-transform duration-300 ease-in-out
            overflow-y-auto lg:overflow-visible
            p-5 lg:p-0
          `}>
            {/* Mobile close */}
            <div className="lg:hidden flex items-center justify-between mb-5 pb-4 border-b border-rl-gray-3">
              <h2 className="font-bold text-rl-dark">Filters</h2>
              <button onClick={() => setSidebarOpen(false)} className="text-rl-gray p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SearchFilters filters={filters} onChange={setFilters} />
          </aside>
        </>

        {/* Results area */}
        <main className="flex-1 min-w-0">
          {/* Results header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-lg font-bold text-rl-dark">
                {searchQuery ? `Results for "${searchQuery}"` : (activeCategory?.id === 'all' ? 'All Items' : activeCategory?.label)}
              </h1>
              <p className="text-sm text-rl-gray mt-0.5">
                {results.length} {results.length === 1 ? 'item' : 'items'} available
              </p>
            </div>
          </div>

          {/* Grid or empty state */}
          {results.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-rl-dark mb-2">No results found</h3>
              <p className="text-rl-gray text-sm mb-6">Try adjusting your filters or search terms.</p>
              <button
                onClick={() => {
                  setFilters({ category: 'all', minPrice: 0, maxPrice: 200, instantBook: false, shipping: false, verified: false, sort: 'relevance' })
                  setSearchQuery('')
                }}
                className="btn-primary text-sm"
              >
                Clear all filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {results.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {results.map(listing => (
                <ListListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  )
}

// List view card variant
function ListListingCard({ listing }) {
  const [liked, setLiked] = useState(false)

  return (
    <div className="card flex gap-4 p-4 hover:shadow-card-hover transition-all">
      <div className="w-36 h-28 rounded-xl overflow-hidden shrink-0 bg-rl-gray-4">
        <img src={listing.image} alt={listing.title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-rl-dark text-sm leading-snug line-clamp-1 hover:text-rl-blue-600 cursor-pointer">
              {listing.title}
            </h3>
            <button onClick={() => setLiked(!liked)} className="text-rl-gray-2 hover:text-rl-blue shrink-0">
              <svg className="w-4 h-4" fill={liked ? '#6BB8D4' : 'none'} stroke={liked ? '#6BB8D4' : 'currentColor'} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-rl-gray">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              <strong className="text-rl-dark-3">{listing.rating}</strong> ({listing.reviewCount})
            </span>
            <span>{listing.location}</span>
            {listing.distance && <span>{listing.distance} away</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {listing.badges.includes('Insured') && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">🛡️ Insured</span>
            )}
            {listing.badges.includes('Instant Book') && (
              <span className="text-xs font-medium text-rl-blue-600 bg-rl-blue-50 border border-rl-blue-200 px-2 py-0.5 rounded-full">⚡ Instant Book</span>
            )}
            {listing.shipping && (
              <span className="text-xs font-medium text-rl-gray bg-rl-gray-4 border border-rl-gray-3 px-2 py-0.5 rounded-full">📦 Ships</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <img src={listing.ownerAvatar} alt="" className="w-6 h-6 rounded-full" />
            <span className="text-xs text-rl-gray">{listing.ownerName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-rl-dark">
              <span className="text-rl-blue-600">${listing.pricePerDay}</span>
              <span className="text-xs font-normal text-rl-gray"> / day</span>
            </span>
            <button className="btn-primary text-xs py-1.5 px-4">Book</button>
          </div>
        </div>
      </div>
    </div>
  )
}
