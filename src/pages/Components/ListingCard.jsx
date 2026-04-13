import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const StarIcon = () => (
    <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
)
const HeartIcon = ({ filled }) => (
    <svg className="w-4 h-4" fill={filled ? '#6BB8D4' : 'none'} stroke={filled ? '#6BB8D4' : 'currentColor'} strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
)
const VerifiedBadge = () => (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
)

export default function ListingCard({ listing }) {
    const [liked, setLiked] = useState(false)

    const {
        id, title, pricePerDay, rating, reviewCount,
        location, image, ownerName, ownerAvatar,
        badges, verified, shipping
    } = listing

    return (
        <Link to={`/listing/${id}`} className="card flex flex-col group overflow-hidden">
            {/* Image */}
            <div className="relative aspect-[4/3] overflow-hidden bg-rl-gray-4 rounded-t-2xl">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                />

                {/* Price Tag */}
                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm font-bold text-sm px-3 py-1.5 rounded-xl shadow-sm">
                    <span className="text-rl-blue-600">${pricePerDay}</span>
                    <span className="text-rl-gray font-normal text-xs"> / day</span>
                </div>

                {/* Like Button */}
                <button
                    onClick={(e) => { e.preventDefault(); setLiked(!liked) }}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                    aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                    <HeartIcon filled={liked} />
                </button>

                {/* Verified Badge */}
                {verified && (
                    <div className="absolute top-3 left-3 bg-rl-blue/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <VerifiedBadge />
                        Verified
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-4">
                <h3 className="font-semibold text-rl-dark text-sm leading-snug line-clamp-2 mb-2 group-hover:text-rl-blue-600 transition-colors">
                    {title}
                </h3>

                {/* Rating & Location */}
                <div className="flex items-center justify-between text-xs text-rl-gray mb-3">
                    <div className="flex items-center gap-1">
                        <StarIcon />
                        <span className="font-semibold text-rl-dark-3">{rating.toFixed(1)}</span>
                        <span className="text-rl-gray-2">({reviewCount})</span>
                    </div>
                    <span className="truncate ml-2">{location}</span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mt-auto">
                    {badges.includes('Insured') && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            🛡️ Insured
                        </span>
                    )}
                    {badges.includes('Instant Book') && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rl-blue-600 bg-rl-blue-50 border border-rl-blue-200 px-2 py-0.5 rounded-full">
                            ⚡ Instant Book
                        </span>
                    )}
                    {shipping && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rl-gray bg-rl-gray-4 border border-rl-gray-3 px-2 py-0.5 rounded-full">
                            📦 Ships
                        </span>
                    )}
                </div>
            </div>

            {/* Owner Footer */}
            <div className="px-4 pb-3 pt-0 flex items-center gap-2 border-t border-rl-gray-3/60">
                <img src={ownerAvatar} alt={ownerName} className="w-6 h-6 rounded-full object-cover border border-rl-gray-3" />
                <span className="text-xs text-rl-gray">{ownerName}</span>
            </div>
        </Link>
    )
}
