import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api'

const STATUS = {
    requested: { label: 'Requested', className: 'bg-amber-100 text-amber-800' },
    accepted:  { label: 'Confirmed', className: 'bg-rl-blue-100 text-rl-blue-600' },
    active:    { label: 'In progress', className: 'bg-emerald-100 text-emerald-700' },
    completed: { label: 'Completed', className: 'bg-rl-gray-4 text-rl-dark-3' },
    declined:  { label: 'Declined', className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

const ACTIONS = {
    accept:  { label: 'Accept', style: 'btn-primary', confirm: null },
    decline: { label: 'Decline', style: 'btn-outline', confirm: 'Decline this request?' },
    pickup:  { label: 'Mark picked up', style: 'btn-primary', confirm: 'Confirm the renter has picked up the item?' },
    return:  { label: 'Mark returned', style: 'btn-primary', confirm: 'Confirm the item was returned?' },
    cancel:  { label: 'Cancel booking', style: 'btn-outline', confirm: 'Cancel this booking?' },
}

const currency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
// Dates are calendar days ("2026-12-05"); show them without time-zone shifts
const day = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Shipped rentals use the same statuses; only the wording changes
const SHIP_ACTION_LABELS = {
    pickup: { label: 'Mark delivered', confirm: 'Confirm the renter has received the item?' },
    return: { label: 'Mark returned', confirm: 'Confirm the item came back and you checked it?' },
}
const actionFor = (b, a) => (b.fulfillment === 'shipping' && SHIP_ACTION_LABELS[a] ? { ...ACTIONS[a], ...SHIP_ACTION_LABELS[a] } : ACTIONS[a])

function statusLine(b) {
    const other = b.role === 'owner' ? b.renterName : b.ownerName
    if (b.fulfillment === 'shipping') {
        switch (b.status) {
            case 'accepted': return b.role === 'owner'
                ? `Confirmed. Print the send label below and ship it so it arrives by ${day(b.startDate)}.`
                : `Confirmed — ${other} is shipping it to arrive by ${day(b.startDate)}.`
            case 'active': return b.role === 'owner'
                ? `With ${other}. They'll ship it back with the prepaid return label by ${day(b.endDate)}.`
                : `Ship it back with your prepaid return label by ${day(b.endDate)}.`
            default: break
        }
    }
    switch (b.status) {
        case 'requested': return b.role === 'owner' ? `${other} wants to rent this. Accept or decline.` : `Waiting for ${other} to respond.`
        case 'accepted':  return b.role === 'owner' ? `Confirmed. Mark it picked up when ${other} has the item.` : `Confirmed — pick up on ${day(b.startDate)}.`
        case 'active':    return b.role === 'owner' ? `With ${other}. Due back ${day(b.endDate)}.` : `Return by ${day(b.endDate)}.`
        case 'completed': return 'Rental finished.'
        case 'declined':  return b.role === 'owner' ? 'You declined this request.' : `${other} declined this request.`
        case 'cancelled': return b.cancelledBy === (b.role === 'owner' ? 'owner' : 'renter') ? 'You cancelled this booking.' : `Cancelled by ${other}.`
        default: return ''
    }
}

const TRACK_STYLE = {
    DE: 'text-emerald-700',
    EX: 'text-red-600',
    AT: 'text-amber-700',
}

function ShippingPanel({ booking, onChanged }) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const shipments = booking.shipments || []
    const confirmed = ['accepted', 'active'].includes(booking.status)
    if (!confirmed && shipments.length === 0) return null

    const hasError = shipments.some(s => s.status === 'error')
    const missing = !shipments.some(s => s.direction === 'outbound' && s.status === 'created')
        || !shipments.some(s => s.direction === 'return' && s.status === 'created')
    const canRetry = booking.role === 'owner' && confirmed && (hasError || missing)

    const retry = async () => {
        setBusy(true)
        setError('')
        try {
            const { shipments: next } = await api.createShippingLabels(booking.id)
            onChanged({ ...booking, shipments: next })
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    const visible = booking.role === 'owner' ? shipments : shipments.filter(s => s.status === 'created')

    return (
        <div className="mt-3 border border-rl-gray-3 rounded-xl divide-y divide-rl-gray-3 text-sm">
            {visible.length === 0 && (
                <p className="px-3 py-2.5 text-rl-gray text-xs">
                    {booking.role === 'owner' ? 'Shipping labels have not been created yet.' : 'Shipping labels are being prepared.'}
                </p>
            )}
            {visible.map(s => (
                <div key={`${s.direction}-${s.createdAt}`} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold text-rl-dark w-16">{s.direction === 'outbound' ? 'Send' : 'Return'}</span>
                    {s.status === 'error' ? (
                        <span className="text-red-600 text-xs flex-1">Label not created: {s.error}</span>
                    ) : (
                        <>
                            <span className="text-xs text-rl-gray">
                                {(s.carrier || '').replace(/_/g, ' ').toUpperCase()}{' '}
                                {s.trackingUrl
                                    ? <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="underline text-rl-blue-600">{s.trackingNumber}</a>
                                    : <span className="font-mono">{s.trackingNumber}</span>}
                            </span>
                            <span className={`text-xs font-semibold ${TRACK_STYLE[s.trackingStatus] || 'text-rl-dark-3'}`}>{s.trackingDescription}</span>
                            {s.mode === 'mock' && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">TEST</span>}
                            {s.labelUrl && (
                                <a href={s.labelUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs font-semibold text-rl-blue-600 hover:underline">
                                    Print label (PDF)
                                </a>
                            )}
                        </>
                    )}
                </div>
            ))}
            {canRetry && (
                <div className="px-3 py-2.5 flex items-center gap-3">
                    <button disabled={busy} onClick={retry} className="btn-outline text-xs py-1.5 px-3 disabled:opacity-60">
                        {busy ? 'Creating labels…' : hasError ? 'Try creating labels again' : 'Create labels'}
                    </button>
                    {hasError && (
                        <Link to={`/dashboard/listings/${booking.listingId}/edit`} className="text-xs text-rl-gray hover:text-rl-blue-600">
                            Check package size & ship-from address
                        </Link>
                    )}
                </div>
            )}
            {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
    )
}

function BookingRow({ booking, onChanged }) {
    const [busy, setBusy] = useState(null)
    const [confirming, setConfirming] = useState(null)
    const [error, setError] = useState('')
    const status = STATUS[booking.status] || STATUS.completed

    const run = async (action) => {
        setBusy(action)
        setError('')
        try {
            onChanged(await api.bookingAction(booking.id, action))
            setConfirming(null)
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(null)
        }
    }

    const press = (action) => (actionFor(booking, action).confirm ? setConfirming(action) : run(action))

    return (
        <div className="border border-rl-gray-3 rounded-xl p-4 sm:p-5 bg-white flex flex-col sm:flex-row gap-4 items-start">
            <Link to={`/listing/${booking.listingId}`} className="w-full sm:w-24 h-32 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-rl-blue-50 flex items-center justify-center">
                {booking.image
                    ? <img src={booking.image} alt={booking.title} className="w-full h-full object-cover" />
                    : <span className="text-xs text-rl-blue-600 font-semibold">No photo</span>}
            </Link>
            <div className="flex-1 min-w-0 w-full">
                <div className="flex items-start justify-between gap-3">
                    <Link to={`/listing/${booking.listingId}`} className="font-bold text-rl-dark hover:text-rl-blue-600 truncate">{booking.title}</Link>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-sm text-rl-gray mt-1">
                    {day(booking.startDate)} → {day(booking.endDate)} · {booking.days} day{booking.days === 1 ? '' : 's'}
                    {booking.fulfillment === 'shipping' ? ' · Shipping' : ' · Pickup'}
                </p>
                <p className="text-sm text-rl-dark-3 mt-2">{statusLine(booking)}</p>
                {booking.ownerNote && <p className="text-xs text-rl-gray mt-1">Note: “{booking.ownerNote}”</p>}

                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                    <span className="bg-rl-gray-4 px-3 py-1.5 rounded-lg">
                        <span className="text-rl-gray text-xs">{booking.role === 'owner' ? 'You earn ' : 'Total '}</span>
                        <span className="font-bold text-rl-dark">{currency(booking.role === 'owner' ? booking.baseTotal : booking.total)}</span>
                    </span>
                    <span className="bg-rl-gray-4 px-3 py-1.5 rounded-lg">
                        <span className="text-rl-gray text-xs">{booking.role === 'owner' ? 'Renter ' : 'Owner '}</span>
                        <span className="font-bold text-rl-dark">{booking.role === 'owner' ? booking.renterName : booking.ownerName}</span>
                    </span>
                    {booking.fulfillment === 'shipping' && booking.shippingFee > 0 && (
                        <span className="bg-rl-gray-4 px-3 py-1.5 rounded-lg">
                            <span className="text-rl-gray text-xs">Shipping both ways </span>
                            <span className="font-bold text-rl-dark">{currency(booking.shippingFee)}</span>
                        </span>
                    )}
                </div>

                {booking.fulfillment === 'shipping' && <ShippingPanel booking={booking} onChanged={onChanged} />}

                {booking.actions.length > 0 && (
                    confirming ? (
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <span className="text-sm text-rl-dark">{actionFor(booking, confirming).confirm}</span>
                            <button disabled={!!busy} onClick={() => run(confirming)} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-60">
                                {busy ? 'Saving…' : 'Yes'}
                            </button>
                            <button onClick={() => setConfirming(null)} className="text-xs font-medium text-rl-gray hover:text-rl-dark px-2">No</button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            {booking.actions.map(a => (
                                <button key={a} disabled={!!busy} onClick={() => press(a)}
                                    className={`${ACTIONS[a].style} text-xs py-1.5 px-3 disabled:opacity-60`}>
                                    {busy === a ? 'Saving…' : actionFor(booking, a).label}
                                </button>
                            ))}
                        </div>
                    )
                )}
                {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            </div>
        </div>
    )
}

export default function BookingsPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const tab = searchParams.get('tab') === 'owner' ? 'owner' : 'renter'
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [requestCount, setRequestCount] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [mine, owner] = await Promise.all([api.getMyBookings(), api.getOwnerBookings()])
            setRequestCount(owner.filter(b => b.status === 'requested').length)
            setBookings(tab === 'owner' ? owner : mine)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [tab])

    useEffect(() => { load() }, [load])

    const onChanged = (updated) => {
        setBookings(bs => bs.map(b => (b.id === updated.id ? updated : b)))
        if (tab === 'owner') setRequestCount(c => Math.max(0, c - (updated.status !== 'requested' ? 1 : 0)))
    }

    const tabBtn = (key, label) => (
        <button
            onClick={() => setSearchParams(key === 'owner' ? { tab: 'owner' } : {})}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${tab === key ? 'border-rl-blue text-rl-blue' : 'border-transparent text-rl-gray hover:text-rl-dark'}`}
        >
            {label}
            {key === 'owner' && requestCount > 0 && (
                <span className="bg-amber-500 text-white text-[11px] font-bold rounded-full px-1.5 min-w-[18px] text-center">{requestCount}</span>
            )}
        </button>
    )

    return (
        <div>
            <h1 className="text-2xl font-extrabold text-rl-dark mb-6">Bookings</h1>

            <div className="flex gap-2 border-b border-rl-gray-3 mb-6">
                {tabBtn('renter', 'Items I’m renting')}
                {tabBtn('owner', 'Requests for my items')}
            </div>

            {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />
                </div>
            ) : bookings.length === 0 ? (
                <div className="text-center py-12 bg-rl-gray-4 rounded-xl border border-dashed border-rl-gray-3">
                    <div className="text-4xl mb-3">{tab === 'renter' ? '🧳' : '📦'}</div>
                    <h3 className="font-bold text-rl-dark mb-1">No bookings yet</h3>
                    <p className="text-sm text-rl-gray mb-4">
                        {tab === 'renter' ? "You haven't rented anything yet." : 'No one has requested your items yet.'}
                    </p>
                    <Link to={tab === 'renter' ? '/browse' : '/dashboard/listings/new'} className="btn-primary text-sm">
                        {tab === 'renter' ? 'Browse items' : 'List an item'}
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {bookings.map(b => <BookingRow key={b.id} booking={b} onChanged={onChanged} />)}
                </div>
            )}
        </div>
    )
}
