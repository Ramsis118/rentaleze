import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const STEPS = {
    renter: [
        { n: '01', title: 'Search & Filter', desc: 'Browse thousands of items by category, location, date, and price. Find exactly what you need.' },
        { n: '02', title: 'Book Instantly', desc: 'Use Instant Book or send a request. Confirm your dates and pay securely — held in escrow.' },
        { n: '03', title: 'Receive & Use', desc: 'Pick up locally or receive by shipping. Use it, return it, leave a review.' },
    ],
    owner: [
        { n: '01', title: 'List Your Item', desc: 'Add photos, set your price and availability in minutes. Your listing goes live immediately.' },
        { n: '02', title: 'Approve & Hand Off', desc: 'Approve requests or enable Instant Book. Hand off locally or ship it out.' },
        { n: '03', title: 'Get Paid', desc: 'Payment releases automatically after the rental. Every item covered by built-in insurance.' },
    ],
}

export default function HowItWorks() {
    const [tab, setTab] = useState('renter')
    const steps = STEPS[tab]

    return (
        <section id="how-it-works" className="py-20 bg-rl-off-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-12">
                    <div className="section-label mb-3">How It Works</div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-rl-dark mb-4">
                        Simple for everyone involved
                    </h2>
                    <p className="text-rl-gray max-w-xl mx-auto">
                        Whether you're renting or earning, Rentaleze makes the entire experience effortless.
                    </p>

                    {/* Tab Switcher */}
                    <div className="inline-flex items-center bg-rl-gray-4 rounded-xl p-1 mt-8 border border-rl-gray-3">
                        <button
                            onClick={() => setTab('renter')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'renter' ? 'bg-rl-blue text-white shadow-sm' : 'text-rl-dark-3 hover:text-rl-blue-600'
                                }`}
                        >
                            I want to Rent
                        </button>
                        <button
                            onClick={() => setTab('owner')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'owner' ? 'bg-rl-blue text-white shadow-sm' : 'text-rl-dark-3 hover:text-rl-blue-600'
                                }`}
                        >
                            I want to Earn
                        </button>
                    </div>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {steps.map((step, i) => (
                        <div
                            key={step.n}
                            className={`relative flex flex-col items-start p-6 rounded-2xl border transition-all ${i === 1
                                    ? 'bg-rl-blue border-rl-blue-300 text-white'
                                    : 'bg-white border-rl-gray-3'
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${i === 1 ? 'bg-white/20' : 'bg-rl-blue-50'
                                }`}>
                                <span className={`text-2xl font-black ${i === 1 ? 'text-white' : 'text-rl-blue-400'}`}>
                                    {step.n}
                                </span>
                            </div>
                            <div className={`text-xs font-bold tracking-widest mb-1 ${i === 1 ? 'text-rl-blue-100' : 'text-rl-blue-500'}`}>
                                STEP {step.n}
                            </div>
                            <h3 className={`text-base font-bold mb-2 ${i === 1 ? 'text-white' : 'text-rl-dark'}`}>
                                {step.title}
                            </h3>
                            <p className={`text-sm leading-relaxed ${i === 1 ? 'text-rl-blue-100' : 'text-rl-gray'}`}>
                                {step.desc}
                            </p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-10">
                    <Link to={tab === 'renter' ? '/browse' : '/login'} className="inline-block bg-rl-blue text-white font-semibold px-8 py-3 rounded-xl text-sm hover:bg-rl-blue-500 transition-colors">
                        {tab === 'renter' ? 'Start Browsing Items' : 'List Your First Item — Free'}
                    </Link>
                </div>
            </div>
        </section>
    )
}
