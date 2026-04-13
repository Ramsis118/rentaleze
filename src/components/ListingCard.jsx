import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const StarIcon = ({ filled = true }) => (
  <svg className={`w-3.5 h-3.5 ${filled ? 'text-amber-400' : 'text-rl-gray-3'}`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
)

const MapPinIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const ShippingIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const HeartIcon = ({ filled }) => (
  <svg className="w-4.5 h-4.5" fill={filled ? '#6BB8D4' : 'none'} stroke={filled ? '#6BB8D4' : 'currentColor'} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
)

const ShieldIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)

export default function ListingCard({ listing }) {
  const [liked, setLiked] = useState(false)
  const [imgError, setImgError] = useState(false)

  const fallbackImg = `https://via.placeholder.com/400x280/D6EEF7/4EA3C0?text=${encodeURIComponent(listing.title.substring(0, 20))}`

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="card group flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-[4/3] bg-rl-gray-4 rounded-t-2xl">
        <img
          src={imgError ? fallbackImg : listing.image}
          alt={listing.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Price badge */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-rl-dark font-bold text-sm px-3 py-1.5 rounded-xl shadow-sm">
          <span className="text-rl-blue-600">${listing.pricePerDay}</span>
          <span className="text-rl-gray font-normal text-xs"> / day</span>
        </div>

        {/* Wishlist button */}
        <button
          onClick={(e) => { e.preventDefault(); setLiked(!liked) }}
          className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
        >
          <HeartIcon filled={liked} />
        </button>

        {/* Verified badge */}
        {listing.verified && (
          <div className="absolute top-3 left-3 bg-rl-blue/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            Verified
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4">
        {/* Title */}
        <h3 className="font-semibold text-rl-dark text-sm leading-snug line-clamp-2 mb-2 group-hover:text-rl-blue-600 transition-colors">
          {listing.title}
        </h3>

        {/* Rating + location row */}
        <div className="flex items-center justify-between text-xs text-rl-gray mb-3">
          <div className="flex items-center gap-1">
            <StarIcon />
            <span className="font-semibold text-rl-dark-3">{listing.rating.toFixed(1)}</span>
            <span className="text-rl-gray-2">({listing.reviewCount})</span>
          </div>
          <div className="flex items-center gap-1 text-rl-gray">
            <MapPinIcon />
            <span>{listing.location}</span>
          </div>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {listing.badges.includes('Insured') && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <ShieldIcon />
              Insured
            </span>
          )}
          {listing.badges.includes('Instant Book') && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-rl-blue-600 bg-rl-blue-50 border border-rl-blue-200 px-2 py-0.5 rounded-full">
              ⚡ Instant Book
            </span>
          )}
          {listing.shipping && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-rl-gray bg-rl-gray-4 border border-rl-gray-3 px-2 py-0.5 rounded-full">
              <ShippingIcon />
              Ships
            </span>
          )}
        </div>
      </div>

      {/* Owner footer */}
      <div className="px-4 pb-3 pt-0 flex items-center gap-2 border-t border-rl-gray-3/60 mt-auto">
        <img
          src={listing.ownerAvatar}
          alt={listing.ownerName}
          className="w-6 h-6 rounded-full object-cover border border-rl-gray-3"
        />
        <span className="text-xs text-rl-gray">{listing.ownerName}</span>
        {listing.distance && (
          <span className="ml-auto text-xs text-rl-gray-2">{listing.distance}</span>
        )}
      </div>
    </Link>
  )
}
