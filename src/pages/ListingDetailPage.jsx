import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { LISTINGS } from '../data/listings'
import { getListingDetails } from '../data/listingDetails'
import Footer from '../components/Footer'

// ─── Icon helpers ──────────────────────────────────────────────────────────────
const StarIcon = ({ filled = true }) => (
  <svg className={`w-4 h-4 ${filled ? 'text-amber-400' : 'text-rl-gray-3'}`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
)
const CheckIcon = () => (
  <svg className="w-4 h-4 text-rl-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)
const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)
const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)
const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)
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
const HeartIcon = ({ active }) => (
  <svg className={`w-5 h-5 transition-colors ${active ? 'text-rose-500' : 'text-rl-gray'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
)
const ShareIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
)

// ─── Image Gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ images, title }) {
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  const prev = () => setActive(i => (i - 1 + images.length) % images.length)
  const next = () => setActive(i => (i + 1) % images.length)

  useEffect(() => {
    if (!lightbox) return
    const handler = (e) => { if (e.key === 'Escape') setLightbox(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox])

  return (
    <>
      {/* Desktop: 2-column grid */}
      <div className="hidden md:grid grid-cols-2 gap-2 rounded-2xl overflow-hidden h-[420px]">
        {/* Main image */}
        <div
          className="relative cursor-pointer group col-span-1 row-span-2"
          onClick={() => setLightbox(true)}
        >
          <img
            src={images[0]}
            alt={title}
            className="w-full h-full object-cover group-hover:brightness-95 transition-all"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all" />
        </div>

        {/* Side thumbnails */}
        <div className="grid grid-rows-2 gap-2 h-full">
          {images.slice(1, 3).map((img, i) => (
            <div
              key={i}
              className="relative cursor-pointer group overflow-hidden"
              onClick={() => { setActive(i + 1); setLightbox(true) }}
            >
              <img src={img} alt={`${title} ${i + 2}`} className="w-full h-full object-cover group-hover:brightness-95 transition-all" />
              {i === 1 && images.length > 3 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">+{images.length - 3} more</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: single image with arrows */}
      <div className="md:hidden relative rounded-2xl overflow-hidden h-72 bg-rl-gray-4">
        <img src={images[active]} alt={title} className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <ChevronLeftIcon />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <ChevronRightIcon />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`rounded-full transition-all ${active === i ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-light w-10 h-10 flex items-center justify-center"
            onClick={() => setLightbox(false)}
          >✕</button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={e => { e.stopPropagation(); prev() }}
          ><ChevronLeftIcon /></button>
          <img
            src={images[active]}
            alt={title}
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={e => { e.stopPropagation(); next() }}
          ><ChevronRightIcon /></button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setActive(i) }}
                className={`rounded-full transition-all ${active === i ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Booking Card ──────────────────────────────────────────────────────────────
function BookingCard({ listing }) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(today.getDate() + 3)

  const fmt = (d) => d.toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(fmt(tomorrow))
  const [endDate, setEndDate] = useState(fmt(dayAfter))
  const [booked, setBooked] = useState(false)

  const msPerDay = 86400000
  const days = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / msPerDay))
  const rentalTotal = days * listing.pricePerDay
  const insuranceFee = Math.round(rentalTotal * 0.08)
  const serviceFee = Math.round(rentalTotal * 0.12)
  const total = rentalTotal + insuranceFee + serviceFee
  const instantBook = listing.badges.includes('Instant Book')

  if (booked) {
    return (
      <div className="bg-white border border-rl-gray-3 rounded-2xl p-6 shadow-card text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-extrabold text-rl-dark mb-1">
          {instantBook ? 'Booking Confirmed!' : 'Request Sent!'}
        </h3>
        <p className="text-sm text-rl-gray mb-5">
          {instantBook
            ? `Your rental is confirmed for ${days} day${days !== 1 ? 's' : ''}. Check your email for details.`
            : `${listing.ownerName} will respond within 24 hours.`}
        </p>
        <button onClick={() => setBooked(false)} className="btn-outline text-sm w-full">
          Modify Booking
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-rl-gray-3 rounded-2xl shadow-card overflow-hidden">
      {/* Price header */}
      <div className="px-6 pt-5 pb-4 border-b border-rl-gray-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-extrabold text-rl-dark">${listing.pricePerDay}</span>
          <span className="text-rl-gray text-sm">/ day</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <StarIcon />
          <span className="text-sm font-semibold text-rl-dark">{listing.rating}</span>
          <span className="text-xs text-rl-gray-2">({listing.reviewCount} reviews)</span>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Date pickers */}
        <div>
          <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-2">Rental Dates</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-rl-gray-2 mb-1 block">Start</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-gray"><CalendarIcon /></span>
                <input
                  type="date"
                  value={startDate}
                  min={fmt(tomorrow)}
                  onChange={e => {
                    setStartDate(e.target.value)
                    const newEnd = new Date(e.target.value)
                    newEnd.setDate(newEnd.getDate() + Math.max(1, days))
                    setEndDate(fmt(newEnd))
                  }}
                  className="input-field pl-9 py-2 text-sm w-full"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-rl-gray-2 mb-1 block">End</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-gray"><CalendarIcon /></span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="input-field pl-9 py-2 text-sm w-full"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-rl-blue-600 font-medium mt-2 text-center">
            {days} day{days !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Price breakdown */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-sm">
            <span className="text-rl-gray">${listing.pricePerDay} × {days} day{days !== 1 ? 's' : ''}</span>
            <span className="text-rl-dark font-medium">${rentalTotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-rl-gray flex items-center gap-1">
              <span className="text-xs">🛡️</span> Insurance fee
            </span>
            <span className="text-rl-dark font-medium">${insuranceFee}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-rl-gray">Service fee</span>
            <span className="text-rl-dark font-medium">${serviceFee}</span>
          </div>
          <div className="flex justify-between font-bold pt-2 border-t border-rl-gray-3">
            <span className="text-rl-dark">Total</span>
            <span className="text-rl-dark">${total}</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => setBooked(true)}
          className="btn-primary w-full py-3 text-sm font-bold"
        >
          {instantBook ? '⚡ Book Instantly' : '→ Request to Book'}
        </button>

        {instantBook && (
          <p className="text-xs text-center text-rl-gray-2">
            You won't be charged until the owner confirms
          </p>
        )}

        {/* Contact owner */}
        <button className="btn-outline w-full py-2.5 text-sm">
          Message {listing.ownerName.split(' ')[0]}
        </button>

        {/* Trust note */}
        <div className="flex items-start gap-2 pt-1">
          <span className="text-rl-blue shrink-0 mt-0.5"><ShieldIcon /></span>
          <p className="text-xs text-rl-gray-2 leading-relaxed">
            Every rental includes <span className="font-semibold text-rl-dark">damage insurance</span> and is backed by the <span className="font-semibold text-rl-dark">Rentaleze Guarantee</span>. Free cancellation up to 48 hrs before rental.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Owner Card ────────────────────────────────────────────────────────────────
function OwnerCard({ listing, details }) {
  return (
    <div className="border border-rl-gray-3 rounded-2xl p-6 bg-white">
      <div className="flex items-start gap-4 mb-5">
        <div className="relative shrink-0">
          <img
            src={listing.ownerAvatar.replace('?img=', '?img=')}
            alt={listing.ownerName}
            className="w-16 h-16 rounded-full object-cover border-2 border-rl-blue-100"
          />
          {listing.verified && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-rl-blue rounded-full flex items-center justify-center border-2 border-white">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-rl-dark">{listing.ownerName}</h3>
            {listing.verified && (
              <span className="bg-rl-blue-100 text-rl-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                Verified
              </span>
            )}
          </div>
          <p className="text-xs text-rl-gray-2 mt-0.5">Member since {details.ownerSince} · {details.ownerTotalReviews} reviews</p>
          <div className="flex items-center gap-1 mt-1">
            <StarIcon />
            <span className="text-sm font-semibold text-rl-dark">{listing.rating}</span>
            <span className="text-xs text-rl-gray-2">avg rating</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-rl-dark-3 leading-relaxed mb-5">
        "{details.ownerBio}"
      </p>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Response rate', value: `${details.ownerResponseRate}%` },
          { label: 'Response time', value: details.ownerResponseTime },
        ].map(item => (
          <div key={item.label} className="bg-rl-off-white rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-extrabold text-rl-dark">{item.value}</p>
            <p className="text-xs text-rl-gray-2 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
function ReviewsSection({ listing, reviews }) {
  const [showAll, setShowAll] = useState(false)
  const display = showAll ? reviews : reviews.slice(0, 3)

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="text-4xl font-black text-rl-dark">{listing.rating.toFixed(1)}</div>
        <div>
          <div className="flex gap-0.5 mb-1">
            {[1,2,3,4,5].map(i => (
              <StarIcon key={i} filled={i <= Math.round(listing.rating)} />
            ))}
          </div>
          <p className="text-sm text-rl-gray">{listing.reviewCount} reviews</p>
        </div>
      </div>

      {/* Review cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {display.map((r, i) => (
          <div key={i} className="bg-rl-off-white rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <img src={r.avatar} alt={r.name} className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold text-rl-dark">{r.name}</p>
                <p className="text-xs text-rl-gray-2">{r.date}</p>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[1,2,3,4,5].map(j => (
                  <StarIcon key={j} filled={j <= r.rating} />
                ))}
              </div>
            </div>
            <p className="text-sm text-rl-dark-3 leading-relaxed">"{r.text}"</p>
          </div>
        ))}
      </div>

      {reviews.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="btn-outline mt-5 text-sm"
        >
          Show all {reviews.length} reviews
        </button>
      )}
    </div>
  )
}

// ─── Mobile Booking Bar ────────────────────────────────────────────────────────
function MobileBookingBar({ listing, onOpenModal }) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-rl-gray-3 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex-1">
        <p className="text-lg font-extrabold text-rl-dark">${listing.pricePerDay}<span className="text-sm font-medium text-rl-gray">/day</span></p>
        <div className="flex items-center gap-1">
          <StarIcon />
          <span className="text-xs font-semibold text-rl-dark">{listing.rating}</span>
          <span className="text-xs text-rl-gray-2">({listing.reviewCount})</span>
        </div>
      </div>
      <button onClick={onOpenModal} className="btn-primary px-8 py-3 text-sm">
        {listing.badges.includes('Instant Book') ? '⚡ Book Now' : 'Check Availability'}
      </button>
    </div>
  )
}

// ─── Mobile Booking Modal ──────────────────────────────────────────────────────
function BookingModal({ listing, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-6 pb-8 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-rl-dark">Book this Item</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-rl-gray-4 flex items-center justify-center text-rl-gray hover:text-rl-dark">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <BookingCard listing={listing} />
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [wishlist, setWishlist] = useState(false)
  const [bookingModal, setBookingModal] = useState(false)

  const listingId = parseInt(id, 10)
  const listing = LISTINGS.find(l => l.id === listingId)
  const details = getListingDetails(listingId)

  if (!listing || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rl-off-white">
        <div className="text-center px-4">
          <div className="text-5xl mb-3">🔍</div>
          <h2 className="text-xl font-extrabold text-rl-dark mb-2">Listing not found</h2>
          <p className="text-rl-gray text-sm mb-6">This item may no longer be available.</p>
          <button onClick={() => navigate('/browse')} className="btn-primary text-sm">Browse Listings</button>
        </div>
      </div>
    )
  }

  const categoryLabel = listing.category.charAt(0).toUpperCase() + listing.category.slice(1)

  return (
    <div className="bg-rl-off-white min-h-screen pb-28 lg:pb-0">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-rl-gray-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex items-center gap-2 text-xs text-rl-gray-2">
            <Link to="/" className="hover:text-rl-blue transition-colors">Home</Link>
            <span>/</span>
            <Link to="/browse" className="hover:text-rl-blue transition-colors">Browse</Link>
            <span>/</span>
            <Link to={`/browse?category=${listing.category}`} className="hover:text-rl-blue transition-colors capitalize">{categoryLabel}</Link>
            <span>/</span>
            <span className="text-rl-dark font-medium truncate max-w-[180px]">{listing.title}</span>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── Left column ── */}
          <div className="lg:col-span-7 space-y-8">

            {/* Image gallery */}
            <ImageGallery images={details.images} title={listing.title} />

            {/* Title & meta */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-rl-dark leading-tight flex-1">
                  {listing.title}
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setWishlist(w => !w)}
                    className="w-9 h-9 rounded-full border border-rl-gray-3 flex items-center justify-center bg-white hover:border-rl-gray-2 transition-colors"
                    aria-label="Save to wishlist"
                  >
                    <HeartIcon active={wishlist} />
                  </button>
                  <button
                    className="w-9 h-9 rounded-full border border-rl-gray-3 flex items-center justify-center bg-white hover:border-rl-gray-2 transition-colors text-rl-gray"
                    aria-label="Share"
                  >
                    <ShareIcon />
                  </button>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                <div className="flex items-center gap-1">
                  <StarIcon />
                  <span className="font-bold text-rl-dark text-sm">{listing.rating}</span>
                  <span className="text-xs text-rl-gray-2">({listing.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1 text-rl-gray-2">
                  <LocationIcon />
                  <span className="text-sm">{listing.location} · {listing.distance} away</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {listing.verified && (
                  <span className="inline-flex items-center gap-1.5 bg-rl-blue-100 text-rl-blue-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Verified Owner
                  </span>
                )}
                {listing.badges.includes('Insured') && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
                    🛡️ Insured
                  </span>
                )}
                {listing.badges.includes('Instant Book') && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200">
                    ⚡ Instant Book
                  </span>
                )}
                {listing.shipping && (
                  <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200">
                    📦 Ships to You
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <hr className="border-rl-gray-3" />

            {/* Description */}
            <div>
              <h2 className="text-lg font-extrabold text-rl-dark mb-3">About this item</h2>
              <p className="text-rl-dark-3 leading-relaxed">{details.description}</p>
            </div>

            {/* What's Included */}
            <div>
              <h2 className="text-lg font-extrabold text-rl-dark mb-4">What's included</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {details.includes.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-white border border-rl-gray-3 rounded-xl px-4 py-2.5">
                    <CheckIcon />
                    <span className="text-sm text-rl-dark">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Specifications */}
            <div>
              <h2 className="text-lg font-extrabold text-rl-dark mb-4">Specifications</h2>
              <div className="bg-white border border-rl-gray-3 rounded-2xl overflow-hidden">
                {Object.entries(details.specs).map(([key, val], i, arr) => (
                  <div
                    key={key}
                    className={`flex items-center px-5 py-3 ${i < arr.length - 1 ? 'border-b border-rl-gray-3' : ''}`}
                  >
                    <span className="text-sm text-rl-gray w-40 shrink-0">{key}</span>
                    <span className="text-sm font-semibold text-rl-dark">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rental Rules */}
            <div>
              <h2 className="text-lg font-extrabold text-rl-dark mb-4">Rental rules</h2>
              <div className="bg-white border border-rl-gray-3 rounded-2xl p-5 space-y-3">
                {details.rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-rl-gray-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-rl-gray">{i + 1}</span>
                    </div>
                    <p className="text-sm text-rl-dark-3">{rule}</p>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-rl-gray-3">
                  <p className="text-xs text-rl-gray-2 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Free cancellation up to 48 hours before rental start. See full cancellation policy.</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Owner */}
            <div>
              <h2 className="text-lg font-extrabold text-rl-dark mb-4">About the owner</h2>
              <OwnerCard listing={listing} details={details} />
            </div>

            {/* Map placeholder */}
            <div>
              <h2 className="text-lg font-extrabold text-rl-dark mb-4">
                Location
                <span className="text-sm text-rl-gray font-normal ml-2">{listing.location} · {listing.distance} from you</span>
              </h2>
              <div className="bg-white border border-rl-gray-3 rounded-2xl overflow-hidden h-48 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl mb-2">📍</div>
                  <p className="text-sm text-rl-gray font-medium">{listing.location}</p>
                  <p className="text-xs text-rl-gray-2 mt-1">Exact address provided after booking</p>
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-extrabold text-rl-dark">Reviews</h2>
              </div>
              <ReviewsSection listing={listing} reviews={details.reviews} />
            </div>

          </div>

          {/* ── Right column: Booking card (sticky) ── */}
          <div className="hidden lg:block lg:col-span-5">
            <div className="sticky top-24">
              <BookingCard listing={listing} />

              {/* Quick trust row */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: '🛡️', label: 'Insured' },
                  { icon: '💳', label: 'Secure Pay' },
                  { icon: '↩️', label: 'Free Cancel' },
                ].map(item => (
                  <div key={item.label} className="bg-white border border-rl-gray-3 rounded-xl py-3 px-2">
                    <div className="text-lg mb-1">{item.icon}</div>
                    <p className="text-xs font-semibold text-rl-dark">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Similar listings */}
        <SimilarListings listing={listing} />
      </div>

      {/* Mobile booking bar */}
      <MobileBookingBar listing={listing} onOpenModal={() => setBookingModal(true)} />
      {bookingModal && <BookingModal listing={listing} onClose={() => setBookingModal(false)} />}

      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  )
}

// ─── Similar Listings ─────────────────────────────────────────────────────────
function SimilarListings({ listing }) {
  const similar = LISTINGS
    .filter(l => l.id !== listing.id && l.category === listing.category)
    .slice(0, 4)

  if (similar.length === 0) return null

  return (
    <div className="mt-16 pt-10 border-t border-rl-gray-3">
      <h2 className="text-xl font-extrabold text-rl-dark mb-6">Similar items nearby</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {similar.map(item => (
          <Link
            key={item.id}
            to={`/listing/${item.id}`}
            className="bg-white border border-rl-gray-3 rounded-2xl overflow-hidden hover:shadow-card-hover transition-shadow group"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-rl-dark truncate mb-1">{item.title}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-rl-blue">${item.pricePerDay}<span className="text-xs font-normal text-rl-gray">/day</span></span>
                <div className="flex items-center gap-0.5">
                  <StarIcon />
                  <span className="text-xs font-semibold text-rl-dark">{item.rating}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
