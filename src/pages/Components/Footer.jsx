jsx
import React from 'react'
import { Link } from 'react-router-dom'

const FooterLink = ({ to, children }) => (
    <li>
        <Link to={to} className="text-rl-gray-2 hover:text-rl-blue-300 transition-colors text-sm">
            {children}
        </Link>
    </li>
)

export default function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="bg-rl-dark text-rl-gray-2 mt-auto">
            {/* CTA Banner */}
            <div className="bg-rl-blue">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-white text-xl font-bold mb-1">Have something worth renting?</h3>
                        <p className="text-rl-blue-100 text-sm">List your item for free — no subscription required.</p>
                    </div>
                    <button className="bg-white text-rl-blue-600 font-bold px-7 py-3 rounded-xl hover:bg-rl-blue-50 transition-colors shrink-0 text-sm">
                        Start Listing Free →
                    </button>
                </div>
            </div>

            {/* Links */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
                    {/* Brand */}
                    <div className="max-w-xs">
                        <Link to="/" className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-rl-blue rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">R</span>
                            </div>
                            <span className="font-bold text-white text-base">Rental<span className="text-rl-blue-300">eze</span></span>
                        </Link>
                        <p className="text-sm leading-relaxed text-rl-gray-2 mb-3">
                            The trusted marketplace to rent anything or earn from everything you own.
                        </p>
                        <div className="text-xs text-rl-gray">
                            🛡️ Every rental insured &nbsp;•&nbsp; 🇺🇸 US Nationwide
                        </div>
                    </div>

                    {/* Link Columns */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3">Renters</h4>
                            <ul className="space-y-2">
                                <FooterLink to="/browse">Browse Items</FooterLink>
                                <FooterLink to="/how-it-works">How to Rent</FooterLink>
                                <FooterLink to="/insurance">Insurance</FooterLink>
                                <FooterLink to="/shipping">Shipping Guide</FooterLink>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3">Owners</h4>
                            <ul className="space-y-2">
                                <FooterLink to="/list">List Your Item</FooterLink>
                                <FooterLink to="/pricing-tips">Pricing Tips</FooterLink>
                                <FooterLink to="/dashboard">Dashboard</FooterLink>
                                <FooterLink to="/payout-faq">Payout FAQ</FooterLink>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3">Company</h4>
                            <ul className="space-y-2">
                                <FooterLink to="/about">About</FooterLink>
                                <FooterLink to="/how-it-works">How It Works</FooterLink>
                                <FooterLink to="/press">Press</FooterLink>
                                <FooterLink to="/contact">Contact</FooterLink>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3">Legal</h4>
                            <ul className="space-y-2">
                                <FooterLink to="/terms">Terms</FooterLink>
                                <FooterLink to="/privacy">Privacy</FooterLink>
                                <FooterLink to="/insurance-policy">Insurance Policy</FooterLink>
                                <FooterLink to="/cookies">Cookies</FooterLink>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="border-t border-white/10 mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-rl-gray">
                    <span>© {currentYear} Rentaleze, Inc. All rights reserved.</span>
                    <span>Built with trust in Austin, TX 🤘</span>
                </div>
            </div>
        </footer>
    )
}