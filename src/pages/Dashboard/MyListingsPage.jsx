import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

const STATUS_STYLES = {
    active: { label: 'Live', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    draft: { label: 'Draft', className: 'bg-rl-gray-4 text-rl-gray border-rl-gray-3' },
    removed: { label: 'Removed', className: 'bg-red-50 text-red-700 border-red-200' },
}

export default function MyListingsPage() {
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    const load = async () => {
        try {
            setListings(await api.getMyListings())
            setError('')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const setStatus = async (listing, status) => {
        setBusyId(listing.id)
        setError('')
        try {
            const updated = await api.updateListing(listing.id, { status })
            setListings(ls => ls.map(l => (l.id === listing.id ? { ...l, ...updated } : l)))
        } catch (err) {
            setError(err.message)
        } finally {
            setBusyId(null)
        }
    }

    const remove = async (listing) => {
        setBusyId(listing.id)
        setError('')
        try {
            await api.deleteListing(listing.id)
            setListings(ls => ls.filter(l => l.id !== listing.id))
        } catch (err) {
            setError(err.message)
        } finally {
            setBusyId(null)
            setConfirmDeleteId(null)
        }
    }

    if (loading) {
        return (
            <div className="py-12 flex justify-center">
                <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-rl-dark">My Listings</h1>
                    <p className="text-sm text-rl-gray mt-1">Items you've put up for rent.</p>
                </div>
                <Link to="/dashboard/listings/new" className="btn-primary text-sm shrink-0">+ List an item</Link>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            {listings.length === 0 ? (
                <div className="text-center py-12 bg-rl-gray-4 rounded-xl border border-dashed border-rl-gray-3">
                    <div className="text-4xl mb-3">📦</div>
                    <h3 className="font-bold text-rl-dark mb-1">You haven't listed anything yet</h3>
                    <p className="text-sm text-rl-gray mb-4">Turn things you rarely use into income.</p>
                    <Link to="/dashboard/listings/new" className="btn-primary text-sm">List your first item</Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {listings.map(l => {
                        const status = STATUS_STYLES[l.status] || STATUS_STYLES.draft
                        const busy = busyId === l.id
                        return (
                            <div key={l.id} className="flex flex-col sm:flex-row gap-4 border border-rl-gray-3 rounded-2xl p-4">
                                <div className="w-full sm:w-32 h-32 sm:h-24 rounded-xl overflow-hidden bg-rl-blue-50 shrink-0 flex items-center justify-center">
                                    {l.image
                                        ? <img src={l.image} alt={l.title} className="w-full h-full object-cover" />
                                        : <span className="text-xs text-rl-blue-600 font-semibold">No photo</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-bold text-rl-dark truncate">{l.title}</h3>
                                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${status.className}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-rl-gray mt-1">
                                        <span className="font-semibold text-rl-dark">${l.pricePerDay}</span>/day
                                        {l.location && <> · {l.location}</>}
                                        {' · '}{l.bookingCount} booking{l.bookingCount === 1 ? '' : 's'}
                                    </p>
                                    {l.moderationNote && (
                                        <p className="text-xs text-red-700 mt-1">Rentaleze Support: {l.moderationNote}</p>
                                    )}

                                    {confirmDeleteId === l.id ? (
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            <span className="text-sm text-red-700">Delete this listing?</span>
                                            <button disabled={busy} onClick={() => remove(l)} className="text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg px-3 py-1.5 disabled:opacity-60">
                                                Yes, delete
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(null)} className="text-sm font-medium text-rl-gray hover:text-rl-dark px-2">
                                                Cancel
                                            </button>
                                        </div>
                                    ) : l.status === 'removed' ? (
                                        <p className="text-xs text-rl-gray mt-3">This listing can't be edited. Questions? Email support@rentaleze.com.</p>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            <Link to={`/listing/${l.id}`} className="btn-outline text-xs py-1.5 px-3">View</Link>
                                            <Link to={`/dashboard/listings/${l.id}/edit`} className="btn-outline text-xs py-1.5 px-3">Edit</Link>
                                            {l.status === 'active' ? (
                                                <button disabled={busy} onClick={() => setStatus(l, 'paused')} className="btn-outline text-xs py-1.5 px-3 disabled:opacity-60">Pause</button>
                                            ) : (
                                                <button disabled={busy} onClick={() => setStatus(l, 'active')} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-60">
                                                    {l.status === 'draft' ? 'Publish' : 'Resume'}
                                                </button>
                                            )}
                                            <button onClick={() => setConfirmDeleteId(l.id)} className="text-xs font-medium text-red-500 hover:text-red-600 px-2 py-1.5">Delete</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
