import React, { useState } from 'react'
import { CATEGORIES } from '../data/listings'

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const ChevronIcon = ({ open }) => (
  <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-rl-gray-3 pb-5 mb-5 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full mb-3 group"
      >
        <span className="text-sm font-bold text-rl-dark">{title}</span>
        <span className="text-rl-gray group-hover:text-rl-dark transition-colors"><ChevronIcon open={open} /></span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best Match' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest Listings' },
]

export default function SearchFilters({ filters, onChange }) {
  const {
    category = 'all',
    minPrice = 0,
    maxPrice = 200,
    instantBook = false,
    shipping = false,
    verified = false,
    sort = 'relevance',
  } = filters

  const set = (key, val) => onChange({ ...filters, [key]: val })

  const activeFilterCount = [
    category !== 'all',
    minPrice > 0 || maxPrice < 200,
    instantBook,
    shipping,
    verified,
  ].filter(Boolean).length

  const resetAll = () => onChange({
    category: 'all', minPrice: 0, maxPrice: 200,
    instantBook: false, shipping: false, verified: false, sort: 'relevance',
  })

  return (
    <aside className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-rl-dark text-sm">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="bg-rl-blue text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button onClick={resetAll} className="text-xs text-rl-blue-600 font-semibold hover:underline flex items-center gap-1">
            <XIcon /> Clear all
          </button>
        )}
      </div>

      {/* Sort (mobile only in sidebar, desktop in top bar) */}
      <div className="lg:hidden mb-5 pb-5 border-b border-rl-gray-3">
        <label className="text-sm font-bold text-rl-dark block mb-2">Sort by</label>
        <select
          value={sort}
          onChange={e => set('sort', e.target.value)}
          className="input-field text-sm py-2.5"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <FilterSection title="Category">
        <div className="space-y-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => set('category', cat.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                category === cat.id
                  ? 'bg-rl-blue-100 text-rl-blue-600 font-semibold'
                  : 'text-rl-dark-3 hover:bg-rl-gray-4'
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              <span>{cat.label}</span>
              {category === cat.id && <span className="ml-auto"><svg className="w-3.5 h-3.5 text-rl-blue" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Price range */}
      <FilterSection title="Price Per Day">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-rl-gray-2 mb-1 block">Min</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-gray text-sm">$</span>
                <input
                  type="number"
                  min="0" max={maxPrice}
                  value={minPrice}
                  onChange={e => set('minPrice', Number(e.target.value))}
                  className="input-field pl-7 py-2 text-sm"
                />
              </div>
            </div>
            <span className="text-rl-gray-2 text-sm mt-5">—</span>
            <div className="flex-1">
              <label className="text-xs text-rl-gray-2 mb-1 block">Max</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-gray text-sm">$</span>
                <input
                  type="number"
                  min={minPrice} max="500"
                  value={maxPrice}
                  onChange={e => set('maxPrice', Number(e.target.value))}
                  className="input-field pl-7 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <input
            type="range"
            min="0" max="200"
            value={maxPrice}
            onChange={e => set('maxPrice', Number(e.target.value))}
            className="w-full accent-rl-blue"
          />
          <p className="text-xs text-rl-gray-2 text-center">Up to ${maxPrice}/day</p>
        </div>
      </FilterSection>

      {/* Features */}
      <FilterSection title="Features">
        <div className="space-y-3">
          {[
            { key: 'instantBook', label: 'Instant Book', desc: 'Book without owner approval', icon: '⚡' },
            { key: 'shipping',    label: 'Ships to me',   desc: 'Owner ships the item',       icon: '📦' },
            { key: 'verified',    label: 'Verified Owner', desc: 'ID-verified listing owner', icon: '✅' },
          ].map(item => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={filters[item.key]}
                  onChange={e => set(item.key, e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                  filters[item.key]
                    ? 'bg-rl-blue border-rl-blue'
                    : 'border-rl-gray-3 group-hover:border-rl-blue-300'
                }`}>
                  {filters[item.key] && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-rl-dark">{item.icon} {item.label}</span>
                <p className="text-xs text-rl-gray-2">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </FilterSection>
    </aside>
  )
}
