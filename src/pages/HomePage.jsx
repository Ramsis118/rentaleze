import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import CategoryPills from '../components/CategoryPills'
import ListingCard from '../components/ListingCard'
import HowItWorks from '../components/HowItWorks'
import TrustSection from '../components/TrustSection'
import Footer from '../components/Footer'
import { LISTINGS, CATEGORIES } from '../data/listings'

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

// Testimonials
const TESTIMONIALS = [
  {
    name: 'Jordan M.',
    location: 'Austin, TX',
    avatar: 'https://i.pravatar.cc/60?img=32',
    rating: 5,
    text: 'Rented a power washer for the weekend — saved $400 vs. buying. The insurance gave me peace of mind and the owner was super responsive.',
  },
  {
    name: 'Samantha P.',
    location: 'Denver, CO',
    avatar: 'https://i.pravatar.cc/60?img=48',
    rating: 5,
    text: 'I listed my camera kit on a whim and made $600 last month while it sat in my closet. Rentaleze handles everything — payments, insurance, all of it.',
  },
  {
    name: 'Marcus L.',
    location: 'Chicago, IL',
    avatar: 'https://i.pravatar.cc/60?img=11',
    rating: 5,
    text: 'Planned a camping trip in 2 days. Found a tent, sleeping bags, and a camp stove all from local owners. Easy, affordable, insured.',
  },
]

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState('all')

  const filtered = activeCategory === 'all'
    ? LISTINGS
    : LISTINGS.filter(l => l.category === activeCategory)

  const displayListings = filtered.slice(0, 8)

  return (
    <div className="min-h-screen">
      <Hero />

      {/* Featured listings section */}
      <section className="py-14 bg-rl-off-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="section-label mb-2">Marketplace</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-rl-dark">
                Popular Near You
              </h2>
            </div>
            <Link
              to="/browse"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-rl-blue-600 hover:text-rl-blue-500 transition-colors"
            >
              View all <ArrowRightIcon />
            </Link>
          </div>

          {/* Category filter */}
          <div className="mb-6">
            <CategoryPills active={activeCategory} onSelect={setActiveCategory} />
          </div>

          {/* Listings grid */}
          {displayListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {displayListings.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-rl-gray">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">No listings in this category yet.</p>
            </div>
          )}

          {/* Mobile "view all" CTA */}
          <div className="sm:hidden text-center mt-8">
            <Link to="/browse" className="btn-secondary">
              View All Items <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* Earn section */}
      <section className="py-20 bg-rl-off-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: content */}
            <div>
              <div className="section-label mb-3">For Owners</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-rl-dark mb-5 leading-tight">
                Your idle assets are<br />
                <span className="text-rl-blue">earning nothing.</span><br />
                Let's fix that.
              </h2>
              <p className="text-rl-gray text-base leading-relaxed mb-8">
                The average American household has $3,000 worth of rarely-used items.
                Rentaleze turns that into passive income — with built-in insurance,
                automatic payments, and a platform that handles everything.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: '💰', stat: 'Avg $450/mo', desc: 'earned by active owners' },
                  { icon: '🛡️', stat: 'Every rental', desc: 'insured, no extra cost to you' },
                  { icon: '⚡', stat: '$0 listing fee', desc: 'forever — only pay when you earn' },
                ].map(item => (
                  <div key={item.stat} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rl-blue-100 rounded-xl flex items-center justify-center text-lg shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <span className="font-bold text-rl-dark text-sm">{item.stat} </span>
                      <span className="text-rl-gray text-sm">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn-primary px-8 py-3 text-sm">
                Start Listing — It's Free
              </button>
            </div>

            {/* Right: earnings preview card */}
            <div className="relative">
              <div className="bg-white rounded-3xl shadow-card-hover border border-rl-gray-3 p-7 max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-rl-gray-2 font-medium mb-0.5">Monthly Earnings</p>
                    <p className="text-3xl font-extrabold text-rl-dark">$847</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
                    +23% this month
                  </div>
                </div>

                {/* Mini chart bars */}
                <div className="flex items-end gap-1.5 h-20 mb-5">
                  {[40, 55, 35, 70, 60, 80, 85, 75, 90, 68, 95, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${h}%`,
                        background: i === 11 ? '#6BB8D4' : '#D6EEF7'
                      }}
                    />
                  ))}
                </div>

                {/* Active listings */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-rl-dark uppercase tracking-wider">Your Top Items</p>
                  {[
                    { name: 'Sony A7III Camera Kit', earned: '$320', days: 4 },
                    { name: 'DeWalt Drill Set', earned: '$198', days: 11 },
                    { name: 'Camping Tent', earned: '$168', days: 6 },
                  ].map(item => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-rl-dark truncate">{item.name}</p>
                        <p className="text-xs text-rl-gray-2">{item.days} rentals this month</p>
                      </div>
                      <span className="text-xs font-bold text-rl-blue-600 shrink-0">{item.earned}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-rl-blue text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg">
                🛡️ All Insured
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="section-label mb-2">Reviews</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-rl-dark">
              Real people, real rentals
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-rl-gray-4/60 border border-rl-gray-3 rounded-2xl p-6">
                {/* Stars */}
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-rl-dark-3 leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-9 h-9 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-rl-dark">{t.name}</p>
                    <p className="text-xs text-rl-gray-2">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust section */}
      <TrustSection />

      <Footer />
    </div>
  )
}
