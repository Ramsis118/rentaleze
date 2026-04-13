import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

export default function BookingsPage() {
    const [tab, setTab] = useState('trips') // trips | rentals
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchBookings = async () => {
            setLoading(true)
            try {
                const endpoint = tab === 'trips' ? '/bookings/my' : '/bookings/rentals'
                const data = await api.request(endpoint)
                setBookings(data)
            } catch (error) {
                console.error('Failed to fetch bookings', error)
            } finally {
                setLoading(false)
            }
        }
        fetchBookings()
    }, [tab])

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    }

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    return (
        <div>
            <h1 className="text-2xl font-extrabold text-rl-dark mb-6">Booking History</h1>
            
            <div className="flex gap-2 border-b border-rl-gray-3 mb-6">
                <button 
                    onClick={() => setTab('trips')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'trips' ? 'border-rl-blue text-rl-blue' : 'border-transparent text-rl-gray hover:text-rl-dark'}`}
                >
                    My Trips (Renting)
                </button>
                <button 
                    onClick={() => setTab('rentals')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'rentals' ? 'border-rl-blue text-rl-blue' : 'border-transparent text-rl-gray hover:text-rl-dark'}`}
                >
                    My Rentals (Earning)
                </button>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />
                </div>
            ) : bookings.length === 0 ? (
                <div className="text-center py-12 bg-rl-gray-4 rounded-xl border border-dashed border-rl-gray-3">
                    <div className="text-4xl mb-3">{tab === 'trips' ? '🎒' : '💰'}</div>
                    <h3 className="font-bold text-rl-dark mb-1">No bookings found</h3>
                    <p className="text-sm text-rl-gray mb-4">
                        {tab === 'trips' ? "You haven't rented any items yet." : "No one has rented your items yet."}
                    </p>
                    <Link to={tab === 'trips' ? "/browse" : "/new-listing"} className="btn-primary text-sm">
                        {tab === 'trips' ? 'Browse Items' : 'List an Item'}
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {bookings.map(b => (
                        <div key={b.id} className="border border-rl-gray-3 rounded-xl p-4 sm:p-6 bg-white hover:border-rl-blue transition-colors flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                            <img src={b.image} alt={b.title} className="w-24 h-24 rounded-xl object-cover shrink-0 bg-rl-gray-4" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4 mb-1">
                                    <h3 className="font-bold text-rl-dark truncate pr-4">{b.title}</h3>
                                    <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                        b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                                        b.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        b.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                        'bg-rl-gray-3 text-rl-dark-3'
                                    }`}>
                                        {b.status}
                                    </span>
                                </div>
                                <p className="text-sm text-rl-gray mb-3">
                                    {formatDate(b.start_date)} — {formatDate(b.end_date)} ({b.days} days)
                                </p>
                                
                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1.5 bg-rl-gray-4 px-3 py-1.5 rounded-lg">
                                        <span className="text-rl-gray text-xs">Total:</span>
                                        <span className="font-bold text-rl-dark">{formatCurrency(b.total)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-rl-gray-4 px-3 py-1.5 rounded-lg">
                                        <span className="text-rl-gray text-xs">{tab === 'trips' ? 'Owner:' : 'Renter:'}</span>
                                        <span className="font-bold text-rl-dark">
                                            {tab === 'trips' ? b.owner_name : `${b.first_name} ${b.last_name}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
