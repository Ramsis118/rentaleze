import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NavItem = ({ to, icon, label }) => {
    return (
        <NavLink
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                        ? 'bg-rl-blue text-white shadow-sm' 
                        : 'text-rl-dark-3 hover:bg-rl-gray-4 hover:text-rl-blue-600'
                }`
            }
        >
            {icon}
            {label}
        </NavLink>
    )
}

export default function DashboardLayout() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/')
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-rl-off-white flex items-center justify-center">
                <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />
            </div>
        )
    }

    const isVerified = user?.isVerified === 1 && user?.phoneVerified === 1

    return (
        <div className="min-h-screen bg-rl-off-white py-10 px-4">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
                
                {/* Sidebar */}
                <aside className="w-full md:w-64 shrink-0">
                    <div className="bg-white rounded-2xl shadow-card p-4 sticky top-24">
                        {!isVerified && (
                            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3">
                                <p className="text-xs text-orange-700 font-bold mb-2">Action Required</p>
                                <p className="text-xs text-orange-600 mb-3">You must complete ID Verification before renting.</p>
                                <NavLink to="/dashboard/verification" className="block text-center text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg py-2 transition-colors">
                                    Verify Now
                                </NavLink>
                            </div>
                        )}
                        {/* User Card */}
                        <div className="flex items-center gap-3 mb-6 p-2">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.first_name} className="w-12 h-12 rounded-xl object-cover shadow-sm bg-rl-gray-4" />
                            ) : (
                                <div className="w-12 h-12 rounded-xl bg-rl-blue-50 text-rl-blue font-bold flex items-center justify-center text-lg">
                                    {user.first_name?.[0]}
                                </div>
                            )}
                            <div>
                                <h3 className="font-extrabold text-rl-dark">{user.first_name} {user.last_name}</h3>
                                <p className="text-xs text-rl-gray">Member since 2026</p>
                            </div>
                        </div>

                        {/* Nav Links */}
                        <nav className="space-y-1">
                            <NavItem 
                                to="/dashboard" 
                                label="Profile Details" 
                                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                            />
                            <NavItem 
                                to="/dashboard/verification" 
                                label="ID Verification" 
                                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                            />
                            <NavItem 
                                to="/dashboard/messages" 
                                label="Messages" 
                                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                            />
                            <NavItem 
                                to="/dashboard/bookings" 
                                label="My Bookings" 
                                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                            />
                            <NavItem 
                                to="/dashboard/saved" 
                                label="Saved Items" 
                                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                            />
                            <NavItem 
                                to="/dashboard/payments" 
                                label="Payment Methods" 
                                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                            />
                        </nav>

                        <div className="mt-8 pt-4 border-t border-rl-gray-3">
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0">
                    <div className="bg-white rounded-2xl shadow-card p-6 md:p-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
