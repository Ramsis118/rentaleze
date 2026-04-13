import React from 'react'
import { CATEGORIES } from '../data/listings'

export default function CategoryPills({ active, onSelect }) {
    return (
        <div className="w-full overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 pb-1" style={{ minWidth: 'max-content' }}>
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => onSelect(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${active === cat.id
                                ? 'bg-rl-blue text-white border-rl-blue shadow-sm'
                                : 'bg-white text-rl-dark-3 border-rl-gray-3 hover:border-rl-blue hover:text-rl-blue-600 hover:bg-rl-blue-50'
                            }`}
                    >
                        <span className="text-base leading-none">{cat.icon}</span>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
