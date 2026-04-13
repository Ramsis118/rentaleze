import React, { useState } from 'react'
import { CATEGORIES } from '../data/listings'

const ChevronIcon = ({ open }) => (
    <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
)
const CheckIcon = () => (
    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
)

export default function SearchFilters({ filters, onChange }) {
    const [openSections, setOpenSections] = useState({ category: true, price: true, features: true })

    const toggleSection = (key) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const set = (key, value) => onChange({ ...filters, [key]: value })

    const formatPrice = (value) => `$${value}`

    return (
        <div className="space-y-5">
            {/* Category */}
            <div className="border-b border-rl-gray-3 pb-5">
                <button onClick={() => toggleSection('category')} className="flex items-center justify-between w-full mb-3">
                    <span className="text-sm font-bold text-rl-dark">Category</span>
                    <ChevronIcon open={openSections.category} />
                </button>
                {openSections.category && (
                    <div className="space-y-1">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => set('category', cat.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${filters.category === cat.id
                                        ? 'bg-rl-blue-100 text-rl-blue-600 font-semibold'
                                        : 'text-rl-dark-3 hover:bg-rl-gray-4'
                                    }`}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.label}</span>
                                {filters.category === cat.id && <span className="ml-auto"><CheckIcon /></span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Price Range */}
            <div className="border-b border-rl-gray-3 pb-5">
                <button onClick={() => toggleSection('price')} className="flex items-center justify-between w-full mb-3">
                    <span className="text-sm font-bold text-rl-dark">Price Per Day</span>
                    <ChevronIcon open={openSections.price} />
                </button>
                {openSections.price && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-rl-gray-2 mb-1 block">Min</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-gray text-sm">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max={filters.maxPrice}
                                        value={filters.minPrice}
                                        onChange={(e) => set('minPrice', Number(e.target.value))}
                                        className="w-full pl-7 pr-3 py-2 border border-rl-gray-3 rounded-xl text-sm text-rl-dark outline-none focus:border-rl-blue"
                                    />
                                </div>
                            </div>
                            <span className="text-rl-gray-2 text-sm mt-4">—</span>
                            <div className="flex-1">
                                <label className="text-xs text-rl-gray-2 mb-1 block">Max</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-gray text-sm">$</span>
                                    <input
                                        type="number"
                                        min={filters.minPrice}
                                        max="500"
                                        value={filters.maxPrice}
                                        onChange={(e) => set('maxPrice', Number(e.target.value))}
                                        className="w-full pl-7 pr-3 py-2 border border-rl-gray-3 rounded-xl text-sm text-rl-dark outline-none focus:border-rl-blue"
                                    />
                                </div>
                            </div>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="200"
                            value={filters.maxPrice}
                            onChange={(e) => set('maxPrice', Number(e.target.value))}
                            className="w-full"
                        />
                        <p className="text-xs text-rl-gray-2 text-center">
                            Up to {formatPrice(filters.maxPrice)}/day
                        </p>
                    </div>
                )}
            </div>

            {/* Features */}
            <div>
                <button onClick={() => toggleSection('features')} className="flex items-center justify-between w-full mb-3">
                    <span className="text-sm font-bold text-rl-dark">Features</span>
                    <ChevronIcon open={openSections.features} />
                </button>
                {openSections.features && (
                    <div className="space-y-3">
                        {[
                            { key: 'instantBook', label: '⚡ Instant Book', desc: 'No owner approval needed' },
                            { key: 'shipping', label: '📦 Ships to me', desc: 'Owner ships the item' },
                            { key: 'verified', label: '✅ Verified Owner', desc: 'ID-verified listing owner' },
                        ].map(({ key, label, desc }) => (
                            <label key={key} className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={filters[key]}
                                        onChange={(e) => set(key, e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${filters[key] ? 'bg-rl-blue border-rl-blue' : 'border-rl-gray-3 group-hover:border-rl-blue-300'
                                        }`}>
                                        {filters[key] && <CheckIcon />}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-rl-dark">{label}</span>
                                    <p className="text-xs text-rl-gray-2">{desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
