import React, { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../api'
import { timeAgo } from '../../components/NotificationBell'

const CATEGORIES = [
    ['booking', 'A booking or request'], ['shipping', 'Shipping or labels'], ['damage', 'Damage, loss or a safety problem'],
    ['payment', 'Payments or charges'], ['account', 'My account or verification'], ['listing', 'A listing'], ['other', 'Something else']
]
export const TICKET_STATUS = {
    open: { label: 'Open', cls: 'bg-rl-blue-100 text-rl-blue-600' },
    pending: { label: 'Awaiting your reply', cls: 'bg-amber-100 text-amber-800' },
    solved: { label: 'Solved', cls: 'bg-emerald-100 text-emerald-700' },
    closed: { label: 'Closed', cls: 'bg-rl-gray-4 text-rl-dark-3' }
}
const Spinner = () => <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" /></div>
const Err = ({ msg }) => (msg ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{msg}</div> : null)

function NewTicket({ onCreated, onCancel, bookingId: presetBooking }) {
    const [form, setForm] = useState({ category: presetBooking ? 'booking' : '', subject: '', body: '', bookingId: presetBooking || '' })
    const [bookings, setBookings] = useState([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        Promise.all([api.getMyBookings(), api.getOwnerBookings()])
            .then(([a, b]) => setBookings([...a, ...b].sort((x, y) => (y.startDate || '').localeCompare(x.startDate || '')).slice(0, 30)))
            .catch(() => {})
    }, [])

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
    const submit = async (e) => {
        e.preventDefault()
        setError('')
        if (!form.category) return setError('Choose what this is about.')
        setBusy(true)
        try { onCreated(await api.createTicket({ ...form, bookingId: form.bookingId || null })) } catch (err) { setError(err.message) } finally { setBusy(false) }
    }

    return (
        <form onSubmit={submit} className="border border-rl-gray-3 rounded-xl p-4 sm:p-5 bg-white space-y-4">
            <h2 className="font-bold text-rl-dark">Contact support</h2>
            <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                    <span className="block text-sm font-bold text-rl-dark mb-1.5">What’s it about?</span>
                    <select className="input-field" value={form.category} onChange={set('category')}>
                        <option value="">Choose one</option>
                        {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="block text-sm font-bold text-rl-dark mb-1.5">Booking (optional)</span>
                    <select className="input-field" value={form.bookingId} onChange={set('bookingId')}>
                        <option value="">Not about a booking</option>
                        {bookings.map(b => <option key={b.id} value={b.id}>{b.title} · {b.startDate} ({b.role === 'owner' ? 'your item' : 'you rented'})</option>)}
                    </select>
                </label>
            </div>
            <label className="block">
                <span className="block text-sm font-bold text-rl-dark mb-1.5">Subject</span>
                <input className="input-field" value={form.subject} onChange={set('subject')} maxLength={140} placeholder="e.g. My return label won’t print" />
            </label>
            <label className="block">
                <span className="block text-sm font-bold text-rl-dark mb-1.5">Details</span>
                <textarea className="input-field min-h-[140px]" value={form.body} onChange={set('body')} maxLength={5000}
                    placeholder="What happened, and what would you like us to do? Include dates and tracking numbers if you have them." />
            </label>
            {form.category === 'damage' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    If anyone is hurt or in danger, call 911 first. For damage, add photos on the booking page so we can see them.
                </p>
            )}
            <Err msg={error} />
            <div className="flex gap-3">
                <button disabled={busy} className="btn-primary text-sm disabled:opacity-60">{busy ? 'Sending…' : 'Send to support'}</button>
                {onCancel && <button type="button" onClick={onCancel} className="btn-outline text-sm">Cancel</button>}
            </div>
        </form>
    )
}

function TicketThread({ id }) {
    const [t, setT] = useState(null)
    const [reply, setReply] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const load = useCallback(() => api.getMyTicket(id).then(setT).catch(err => setError(err.message)), [id])
    useEffect(() => { load() }, [load])

    const send = async (e) => {
        e.preventDefault()
        if (!reply.trim()) return
        setBusy(true); setError('')
        try { setT(await api.replyToTicket(id, reply)); setReply('') } catch (err) { setError(err.message) } finally { setBusy(false) }
    }
    const solve = async () => { try { setT(await api.solveTicket(id)) } catch (err) { setError(err.message) } }

    if (!t) return error ? <Err msg={error} /> : <Spinner />
    const st = TICKET_STATUS[t.status] || TICKET_STATUS.open
    return (
        <div className="space-y-4">
            <Link to="/dashboard/support" className="text-sm text-rl-gray hover:text-rl-blue-600">← All tickets</Link>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs text-rl-gray-2 font-semibold">Ticket #{t.number}</p>
                    <h1 className="text-xl font-extrabold text-rl-dark">{t.subject}</h1>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
            </div>
            {t.bookingId && <Link to={`/dashboard/bookings/${t.bookingId}`} className="text-sm font-semibold text-rl-blue-600 hover:underline">View the booking →</Link>}

            <div className="space-y-3">
                {t.messages.map(m => (
                    <div key={m.id} className={`rounded-xl p-4 border ${m.authorRole === 'staff' ? 'bg-rl-blue-50 border-rl-blue-100 mr-6' : 'bg-white border-rl-gray-3 ml-6'}`}>
                        <div className="flex justify-between gap-3 text-xs mb-1.5">
                            <span className="font-bold text-rl-dark">{m.authorRole === 'staff' ? m.authorName : 'You'}</span>
                            <span className="text-rl-gray-2">{timeAgo(m.createdAt)}</span>
                        </div>
                        <p className="text-sm text-rl-dark-3 whitespace-pre-line">{m.body}</p>
                    </div>
                ))}
            </div>

            {t.status !== 'closed' ? (
                <form onSubmit={send} className="space-y-3">
                    <textarea className="input-field min-h-[100px]" value={reply} onChange={e => setReply(e.target.value)} maxLength={5000}
                        placeholder={t.status === 'solved' ? 'Still need help? Reply and we’ll reopen this.' : 'Write a reply…'} />
                    <Err msg={error} />
                    <div className="flex flex-wrap gap-3">
                        <button disabled={busy || !reply.trim()} className="btn-primary text-sm disabled:opacity-60">{busy ? 'Sending…' : 'Send reply'}</button>
                        {!['solved', 'closed'].includes(t.status) && <button type="button" onClick={solve} className="btn-outline text-sm">My problem is solved</button>}
                    </div>
                </form>
            ) : (
                <p className="text-sm text-rl-gray">This ticket is closed. Need more help? <Link to="/dashboard/support?new=1" className="text-rl-blue-600 font-semibold">Open a new one</Link>.</p>
            )}
        </div>
    )
}

export default function SupportPage() {
    const { id } = useParams()
    const [params, setParams] = useSearchParams()
    const navigate = useNavigate()
    const [tickets, setTickets] = useState(null)
    const [error, setError] = useState('')
    const showNew = params.get('new') === '1'

    useEffect(() => {
        if (id) return
        api.getMyTickets().then(setTickets).catch(err => setError(err.message))
    }, [id])

    if (id) return <TicketThread id={id} />

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-rl-dark">Help & Support</h1>
                    <p className="text-sm text-rl-gray">We usually answer within one business day.</p>
                </div>
                {!showNew && <button onClick={() => setParams({ new: '1' })} className="btn-primary text-sm">New ticket</button>}
            </div>

            {showNew && <NewTicket bookingId={params.get('booking')} onCreated={t => navigate(`/dashboard/support/${t.id}`)} onCancel={() => setParams({})} />}
            <Err msg={error} />

            {tickets === null ? <Spinner /> : tickets.length === 0 ? (
                !showNew && (
                    <div className="text-center py-12 bg-rl-gray-4 rounded-xl border border-dashed border-rl-gray-3">
                        <h3 className="font-bold text-rl-dark mb-1">No tickets yet</h3>
                        <p className="text-sm text-rl-gray mb-4">Problem with a rental, shipping or your account? We can help.</p>
                        <button onClick={() => setParams({ new: '1' })} className="btn-primary text-sm">Contact support</button>
                    </div>
                )
            ) : (
                <div className="border border-rl-gray-3 rounded-xl overflow-hidden bg-white divide-y divide-rl-gray-3">
                    {tickets.map(t => {
                        const st = TICKET_STATUS[t.status] || TICKET_STATUS.open
                        return (
                            <Link key={t.id} to={`/dashboard/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-rl-gray-4">
                                <span className="text-xs text-rl-gray-2 font-semibold w-14 shrink-0">#{t.number}</span>
                                <span className="flex-1 min-w-0 text-sm font-semibold text-rl-dark truncate">{t.subject}</span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                                <span className="text-xs text-rl-gray-2 shrink-0 hidden sm:block w-20 text-right">{timeAgo(t.updatedAt)}</span>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
