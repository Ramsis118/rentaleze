jsx
import React from 'react'

const PILLARS = [
    { title: 'Insured Every Rental', icon: '🛡️', highlight: true, desc: 'Every transaction includes built-in damage and theft protection. Owners earn with confidence. Renters borrow without risk.' },
    { title: 'Verified Identities', icon: '🪪', desc: 'All users complete ID verification before their first transaction. Full accountability on both sides.' },
    { title: 'Secure Payments', icon: '🔒', desc: 'Payments held in escrow, released after successful handoff. Automatic payouts to owners after every rental.' },
    { title: 'Dual Review System', icon: '⭐', desc: 'Owners rate renters. Renters rate owners. Both scores are visible, building trust over time.' },
    { title: 'In-App Messaging', icon: '💬', desc: 'Coordinate directly through secure in-app chat — no need to share personal contact info.' },
    { title: 'Dispute Resolution', icon: '⚖️', desc: "If something goes wrong, Rentaleze's Trust & Safety team mediates for fair outcomes." },
]

export default function TrustSection() {
    return (
        <section className="py-20 bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-12">
                    <div className="section-label mb-3">Why Rentaleze</div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-rl-dark mb-4">
                        Trust is built into everything
                    </h2>
                    <p className="text-rl-gray max-w-xl mx-auto">
                        Insurance, verification, and fair dispute resolution are baked into every transaction from day one.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {PILLARS.map((pillar, i) => (
                        <div
                            key={i}
                            className={`p-6 rounded-2xl border transition-all hover:shadow-card ${pillar.highlight
                                    ? 'bg-rl-blue-50 border-rl-blue-200'
                                    : 'bg-rl-gray-4/50 border-rl-gray-3'
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-2xl ${pillar.highlight ? 'bg-rl-blue text-white' : 'bg-white border border-rl-gray-3'
                                }`}>
                                {pillar.icon}
                            </div>
                            <h3 className="font-bold text-rl-dark mb-2">{pillar.title}</h3>
                            <p className="text-sm text-rl-gray leading-relaxed">{pillar.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}