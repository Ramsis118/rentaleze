import React from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

const LINKS = {
  Renters: [
    { label: 'Browse All Items', to: '/browse' },
    { label: 'How to Rent', to: '#' },
    { label: 'Shipping Guide', to: '#' },
  ],
  Owners: [
    { label: 'List Your Item', to: '#' },
    { label: 'Pricing Tips', to: '#' },
    { label: 'Owner Dashboard', to: '#' },
    { label: 'Payout FAQ', to: '#' },
  ],
  Company: [
    { label: 'About Rentaleze', to: '#' },
    { label: 'How It Works', to: '#' },
    { label: 'Press', to: '#' },
    { label: 'Contact Us', to: '#' },
  ],
  Legal: [
    { label: 'Terms of Service', to: '#' },
    { label: 'Privacy Policy', to: '#' },
    { label: 'Cookie Policy', to: '#' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-rl-midnight text-rl-gray-2">
      {/* CTA Banner */}
      <div className="bg-gradient-to-r from-rl-blue-500 via-rl-blue to-rl-blue-500 border-y border-rl-electric/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-white text-xl font-bold mb-1">Have something worth renting?</h3>
            <p className="text-rl-blue-100 text-sm">List your item for free — no subscription required to get started.</p>
          </div>
          <button className="bg-white text-rl-blue-600 font-bold px-7 py-3 rounded-xl hover:bg-rl-blue-50 transition-colors shrink-0 text-sm">
            Start Listing Free →
          </button>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center mb-4">
              <Logo variant="dark" className="h-8 w-auto" />
            </div>
            <p className="text-sm leading-relaxed text-rl-gray-2 mb-4">
              The trusted marketplace to rent anything or earn from everything you own.
            </p>
            <div className="text-xs text-rl-gray">
              🛡️ Verified members &nbsp;•&nbsp; 🇺🇸 US Nationwide
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">{section}</h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-rl-gray-2 hover:text-rl-blue-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-rl-gray">
          <span>© 2026 Rentaleze, Inc. All rights reserved.</span>
          <span>Built with trust in Austin, TX 🤘</span>
        </div>
      </div>
    </footer>
  )
}
