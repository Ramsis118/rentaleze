import React from 'react'
import { useNavigate } from 'react-router-dom'

const RENTER_STEPS = [
  {
    step: '01',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: 'Search & Filter',
    desc: 'Browse thousands of items by category, location, date, and price. Find exactly what you need.',
  },
  {
    step: '02',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Book Instantly',
    desc: 'Use Instant Book or send a request. Confirm your dates and pay securely — held in escrow.',
  },
  {
    step: '03',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'Receive & Use',
    desc: 'Pick up locally or receive your item by shipping. Use it and return it. Leave a review.',
  },
]

const OWNER_STEPS = [
  {
    step: '01',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
      </svg>
    ),
    title: 'List Your Item',
    desc: 'Add photos, set your price and availability in minutes. Your listing goes live immediately.',
  },
  {
    step: '02',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Approve & Hand Off',
    desc: 'Approve rental requests or enable Instant Book. Hand off locally or ship it out.',
  },
  {
    step: '03',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Get Paid',
    desc: 'Payment is released automatically after the rental. Every item is covered by built-in insurance.',
  },
]

function StepCard({ step, icon, title, desc, accent = false }) {
  return (
    <div className={`relative flex flex-col items-start p-6 rounded-2xl border ${accent ? 'bg-rl-blue border-rl-blue-300 text-white' : 'bg-white border-rl-gray-3'}`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${accent ? 'bg-white/20' : 'bg-rl-blue-50 text-rl-blue-500'}`}>
        <span className={accent ? 'text-white' : 'text-rl-blue-500'}>{icon}</span>
      </div>
      <div className={`text-xs font-bold tracking-widest mb-1 ${accent ? 'text-rl-blue-100' : 'text-rl-blue-500'}`}>STEP {step}</div>
      <h3 className={`text-base font-bold mb-2 ${accent ? 'text-white' : 'text-rl-dark'}`}>{title}</h3>
      <p className={`text-sm leading-relaxed ${accent ? 'text-rl-blue-100' : 'text-rl-gray'}`}>{desc}</p>
    </div>
  )
}

export default function HowItWorks() {
  const navigate = useNavigate()
  const [tab, setTab] = React.useState('renter')

  const steps = tab === 'renter' ? RENTER_STEPS : OWNER_STEPS

  return (
    <section id="how-it-works" className="py-20 bg-rl-off-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="section-label mb-3">How It Works</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-rl-dark mb-4">
            Simple for everyone involved
          </h2>
          <p className="text-rl-gray max-w-xl mx-auto text-base">
            Whether you're renting something or earning from what you own, Rentaleze
            makes the entire experience effortless.
          </p>

          {/* Tab toggle */}
          <div className="inline-flex items-center bg-rl-gray-4 rounded-xl p-1 mt-8 border border-rl-gray-3">
            <button
              onClick={() => setTab('renter')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'renter'
                  ? 'bg-rl-blue text-white shadow-sm'
                  : 'text-rl-dark-3 hover:text-rl-blue-600'
              }`}
            >
              I want to Rent
            </button>
            <button
              onClick={() => setTab('owner')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'owner'
                  ? 'bg-rl-blue text-white shadow-sm'
                  : 'text-rl-dark-3 hover:text-rl-blue-600'
              }`}
            >
              I want to Earn
            </button>
          </div>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <StepCard key={i} {...s} accent={i === 1} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          {tab === 'renter' ? (
            <button onClick={() => navigate('/browse')} className="btn-primary px-8 py-3 text-sm">
              Start Browsing Items
            </button>
          ) : (
            <button className="btn-primary px-8 py-3 text-sm">
              List Your First Item — Free
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
