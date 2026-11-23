// Help desk for customer service workers: ticket queue, ticket workspace,
// customer and booking lookups with logged actions, activity, and staff (admins).
import React, { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'
import { timeAgo } from '../../components/NotificationBell'

const currency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const day = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

const VIEWS = [['open', 'Open'], ['mine', 'Assigned to me'], ['unassigned', 'Unassigned'], ['pending', 'Waiting on customer'], ['solved', 'Solved'], ['all', 'All tickets']]
const PRIORITY_CLS = { urgent: 'bg-red-600 text-white', high: 'bg-red-100 text-red-700', normal: 'bg-rl-gray-4 text-rl-dark-3', low: 'bg-rl-gray-4 text-rl-gray' }
const STATUS_CLS = { open: 'bg-rl-blue-100 text-rl-blue-600', pending: 'bg-amber-100 text-amber-800', solved: 'bg-emerald-100 text-emerald-700', closed: 'bg-rl-gray-4 text-rl-dark-3' }
const BOOKING_CLS = { requested: 'bg-amber-100 text-amber-800', accepted: 'bg-rl-blue-100 text-rl-blue-600', active: 'bg-emerald-100 text-emerald-700', completed: 'bg-rl-gray-4 text-rl-dark-3', declined: 'bg-red-100 text-red-700', cancelled: 'bg-red-100 text-red-700' }
const ACTION_LABELS = {
    support_cancel_booking: 'Cancelled booking', support_retry_labels: 'Retried labels', support_void_labels: 'Voided labels',
    support_suspend_user: 'Suspended account', support_reinstate_user: 'Reinstated account', support_send_password_reset: 'Sent password reset',
    support_send_verification_reminder: 'Sent verification reminder', support_ticket_open: 'Opened ticket', support_grant: 'Added support agent', support_revoke: 'Removed support agent',
    user_suspend: 'Suspended account (admin)', user_reinstate: 'Reinstated account (admin)'
}

const Spinner = () => <div className="py-10 flex justify-center"><div className="animate-spin w-7 h-7 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" /></div>
const Err = ({ msg }) => (msg ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{msg}</div> : null)
const Pill = ({ cls, children }) => <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{children}</span>
const Card = ({ title, right, children }) => (
    <section className="bg-white border border-rl-gray-3 rounded-xl p-4">
        {(title || right) && <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-rl-dark">{title}</h3>{right}</div>}
        {children}
    </section>
)
const Row = ({ k, v }) => <div className="flex justify-between gap-3 text-sm py-1"><span className="text-rl-gray">{k}</span><span className="text-rl-dark font-medium text-right break-all">{v}</span></div>

function useLoad(fn, deps) {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const reload = useCallback(() => { setError(''); return fn().then(setData).catch(e => setError(e.message)) }, deps) // eslint-disable-line
    useEffect(() => { reload() }, [reload])
    return { data, setData, error, reload }
}

// Button → reason box → confirm. Every action needs a reason for the log.
function ReasonAction({ label, confirmLabel, danger, needsReason = true, onRun }) {
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const run = async () => {
        setBusy(true); setError('')
        try { await onRun(reason); setOpen(false); setReason('') } catch (e) { setError(e.message) } finally { setBusy(false) }
    }
    if (!open) {
        return (
            <span className="inline-flex flex-col">
                <button onClick={() => (needsReason ? setOpen(true) : run())} disabled={busy} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${danger ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-rl-gray-3 text-rl-dark hover:bg-rl-gray-4'} disabled:opacity-60`}>{busy ? 'Working…' : label}</button>
                {error && <span className="text-[11px] text-red-600 mt-1">{error}</span>}
            </span>
        )
    }
    return (
        <div className="w-full border border-rl-gray-3 rounded-lg p-3 space-y-2 bg-rl-gray-4">
            <input autoFocus className="input-field py-2 text-sm" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (saved in the activity log)" maxLength={300} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
                <button onClick={run} disabled={busy || reason.trim().length < 5} className={`text-xs font-bold px-3 py-1.5 rounded-lg text-white ${danger ? 'bg-red-600' : 'bg-rl-blue'} disabled:opacity-50`}>{busy ? 'Working…' : (confirmLabel || label)}</button>
                <button onClick={() => setOpen(false)} className="text-xs text-rl-gray px-2">Cancel</button>
            </div>
        </div>
    )
}

// ─── Customer & booking panels ──────────────────────────────────────────────
function CustomerSummary({ c, go }) {
    if (!c) return null
    return (
        <Card title="Customer" right={<button onClick={() => go({ customer: c.id })} className="text-xs font-semibold text-rl-blue-600 hover:underline">Full profile →</button>}>
            <p className="font-bold text-rl-dark">{c.name}</p>
            <p className="text-sm text-rl-gray break-all">{c.email}</p>
            {c.phone && <p className="text-sm text-rl-gray">{c.phone} {c.phoneVerified ? '✓' : '(unverified)'}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
                <Pill cls={c.idVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}>ID {c.idStatus}</Pill>
                {c.suspended && <Pill cls="bg-red-600 text-white">Suspended</Pill>}
                {['admin', 'support'].includes(c.role) && <Pill cls="bg-rl-blue-100 text-rl-blue-600">Staff</Pill>}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                {[['Rentals', c.counts.rentals], ['Hosted', c.counts.hosted], ['Listings', c.counts.listings], ['Tickets', c.counts.tickets]].map(([k, v]) => (
                    <div key={k} className="bg-rl-gray-4 rounded-lg py-1.5"><div className="text-sm font-bold text-rl-dark">{v}</div><div className="text-[10px] text-rl-gray">{k}</div></div>
                ))}
            </div>
            <p className="text-xs text-rl-gray-2 mt-2">Member since {day(c.createdAt?.slice(0, 10))}</p>
        </Card>
    )
}

function BookingPanel({ b, go, onChanged, compact }) {
    const act = (path, reason) => api.helpdesk(`/bookings/${b.id}${path}`, { method: 'POST', body: reason ? { reason } : {} }).then(onChanged)
    return (
        <Card title={compact ? 'Booking' : null} right={compact && <button onClick={() => go({ booking: b.id })} className="text-xs font-semibold text-rl-blue-600 hover:underline">Open →</button>}>
            <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-rl-dark">{b.title}</p>
                <Pill cls={BOOKING_CLS[b.status] || ''}>{b.status}</Pill>
            </div>
            <p className="text-sm text-rl-gray">{day(b.startDate)} → {day(b.endDate)} · {b.fulfillment}</p>
            <div className="mt-2">
                <Row k="Renter" v={<button onClick={() => go({ customer: b.renter.id })} className="text-rl-blue-600 hover:underline">{b.renter.name}</button>} />
                <Row k="Owner" v={<button onClick={() => go({ customer: b.owner.id })} className="text-rl-blue-600 hover:underline">{b.owner.name}</button>} />
                <Row k="Total" v={currency(b.total)} />
                {b.shippingFee > 0 && <Row k="Shipping" v={currency(b.shippingFee)} />}
                {!compact && <Row k="Booking ID" v={<span className="font-mono text-xs">{b.id}</span>} />}
                {b.ownerNote && <Row k="Note" v={b.ownerNote} />}
            </div>
            {b.shippingAddress && !compact && (
                <p className="text-xs text-rl-gray mt-2">Ships to: {b.shippingAddress.name}, {b.shippingAddress.line1}, {b.shippingAddress.city}, {b.shippingAddress.state} {b.shippingAddress.zip}</p>
            )}
            {b.shipments?.length > 0 && (
                <div className="mt-3 border-t border-rl-gray-3 pt-2 space-y-1.5">
                    {b.shipments.map(s => (
                        <div key={`${s.direction}${s.createdAt}`} className="text-xs flex flex-wrap gap-x-2 items-center">
                            <span className="font-bold w-12">{s.direction === 'outbound' ? 'Send' : 'Return'}</span>
                            {s.status === 'error'
                                ? <span className="text-red-600">{s.error}</span>
                                : <>
                                    {s.trackingUrl ? <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-rl-blue-600 underline">{s.trackingNumber}</a> : <span className="font-mono">{s.trackingNumber}</span>}
                                    <span className="text-rl-gray">{s.trackingDescription}</span>
                                    {s.mode === 'mock' && <Pill cls="bg-amber-100 text-amber-800">TEST</Pill>}
                                    {s.labelUrl && <a href={s.labelUrl} target="_blank" rel="noreferrer" className="text-rl-blue-600">PDF</a>}
                                </>}
                        </div>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
                {b.fulfillment === 'shipping' && ['accepted', 'active'].includes(b.status) && (
                    <ReasonAction label="Retry labels" needsReason={false} onRun={() => act('/labels/retry')} />
                )}
                {b.fulfillment === 'shipping' && b.shipments?.some(s => s.status === 'created') && (
                    <ReasonAction label="Void labels" danger onRun={r => act('/labels/void', r)} />
                )}
                {b.canCancel && <ReasonAction label="Cancel booking" confirmLabel="Cancel booking + notify both" danger onRun={r => act('/cancel', r)} />}
            </div>
        </Card>
    )
}

// ─── Ticket workspace ───────────────────────────────────────────────────────
function TicketView({ id, summary, go, onChanged }) {
    const { data: t, setData, error } = useLoad(() => api.helpdesk(`/tickets/${id}`), [id])
    const [body, setBody] = useState('')
    const [internal, setInternal] = useState(false)
    const [after, setAfter] = useState('pending')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')

    const update = async (change) => {
        setErr('')
        try { setData(await api.helpdesk(`/tickets/${id}`, { method: 'PUT', body: change })); onChanged() } catch (e) { setErr(e.message) }
    }
    const send = async (e) => {
        e.preventDefault()
        if (!body.trim()) return
        setBusy(true); setErr('')
        try {
            setData(await api.helpdesk(`/tickets/${id}/messages`, { method: 'POST', body: { body, internal, ...(internal ? {} : { status: after }) } }))
            setBody(''); onChanged()
        } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
    }

    if (!t) return error ? <Err msg={error} /> : <Spinner />
    return (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="space-y-4 min-w-0">
                <div className="bg-white border border-rl-gray-3 rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <button onClick={() => go({})} className="text-xs text-rl-gray hover:text-rl-blue-600">← Queue</button>
                            <p className="text-xs text-rl-gray-2 font-semibold mt-1">#{t.number} · {t.category} · opened {timeAgo(t.createdAt)}</p>
                            <h2 className="text-lg font-extrabold text-rl-dark">{t.subject}</h2>
                        </div>
                        <Pill cls={STATUS_CLS[t.status]}>{t.status}</Pill>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        <select className="input-field py-1.5 text-sm" value={t.status} onChange={e => update({ status: e.target.value })}>
                            {summary.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className="input-field py-1.5 text-sm" value={t.priority} onChange={e => update({ priority: e.target.value })}>
                            {summary.priorities.map(s => <option key={s} value={s}>{s} priority</option>)}
                        </select>
                        <select className="input-field py-1.5 text-sm" value={t.category} onChange={e => update({ category: e.target.value })}>
                            {summary.categories.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className="input-field py-1.5 text-sm" value={t.assigneeId || ''} onChange={e => update({ assigneeId: e.target.value || null })}>
                            <option value="">Unassigned</option>
                            {summary.staff.map(s => <option key={s.id} value={s.id}>{s.id === summary.me.id ? `Me (${s.name})` : s.name}</option>)}
                        </select>
                    </div>
                    {!t.assigneeId && <button onClick={() => update({ assigneeId: summary.me.id })} className="mt-2 text-xs font-semibold text-rl-blue-600 hover:underline">Take this ticket</button>}
                </div>

                <div className="space-y-3">
                    {t.messages.map(m => (
                        <div key={m.id} className={`rounded-xl p-3.5 border text-sm ${m.authorRole === 'system' ? 'bg-transparent border-dashed border-rl-gray-3 text-rl-gray text-xs' : m.internal ? 'bg-amber-50 border-amber-200' : m.authorRole === 'staff' ? 'bg-rl-blue-50 border-rl-blue-100 ml-8' : 'bg-white border-rl-gray-3 mr-8'}`}>
                            {m.authorRole !== 'system' && (
                                <div className="flex justify-between gap-3 text-xs mb-1">
                                    <span className="font-bold text-rl-dark">{m.authorRole === 'customer' ? t.customer?.name : m.authorName}{m.internal ? ' · internal note' : ''}</span>
                                    <span className="text-rl-gray-2">{timeAgo(m.createdAt)}</span>
                                </div>
                            )}
                            <p className="whitespace-pre-line text-rl-dark-3">{m.body}{m.authorRole === 'system' && <span className="text-rl-gray-2"> · {timeAgo(m.createdAt)}</span>}</p>
                        </div>
                    ))}
                </div>

                <form onSubmit={send} className={`border rounded-xl p-3 space-y-2 ${internal ? 'bg-amber-50 border-amber-200' : 'bg-white border-rl-gray-3'}`}>
                    <div className="flex gap-1 text-xs font-semibold">
                        <button type="button" onClick={() => setInternal(false)} className={`px-3 py-1 rounded-lg ${!internal ? 'bg-rl-blue text-white' : 'text-rl-gray'}`}>Reply to customer</button>
                        <button type="button" onClick={() => setInternal(true)} className={`px-3 py-1 rounded-lg ${internal ? 'bg-amber-500 text-white' : 'text-rl-gray'}`}>Internal note</button>
                    </div>
                    <textarea className="input-field min-h-[110px] text-sm" value={body} onChange={e => setBody(e.target.value)} maxLength={5000}
                        placeholder={internal ? 'Only staff can see this.' : `Reply to ${t.customer?.name || 'the customer'} — they’ll get an email.`} />
                    {err && <p className="text-xs text-red-600">{err}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                        <button disabled={busy || !body.trim()} className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50">{busy ? 'Sending…' : internal ? 'Add note' : 'Send reply'}</button>
                        {!internal && (
                            <label className="text-xs text-rl-gray flex items-center gap-1.5">then set to
                                <select className="border border-rl-gray-3 rounded-md px-1.5 py-1 text-xs" value={after} onChange={e => setAfter(e.target.value)}>
                                    <option value="pending">Waiting on customer</option><option value="open">Open</option><option value="solved">Solved</option>
                                </select>
                            </label>
                        )}
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                <CustomerSummary c={t.customer} go={go} />
                {t.booking && <BookingPanel b={t.booking} go={go} compact onChanged={(b) => setData(d => ({ ...d, booking: b }))} />}
            </div>
        </div>
    )
}

function TicketList({ view, go, refreshKey }) {
    const [q, setQ] = useState('')
    const [applied, setApplied] = useState('')
    const [priority, setPriority] = useState('')
    const { data, error } = useLoad(() => api.helpdesk(`/tickets?view=${view}${priority ? `&priority=${priority}` : ''}${applied ? `&q=${encodeURIComponent(applied)}` : ''}`), [view, priority, applied, refreshKey])
    return (
        <div className="space-y-3">
            <form onSubmit={e => { e.preventDefault(); setApplied(q.trim()) }} className="flex gap-2">
                <input className="input-field py-2 text-sm flex-1" value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by subject, customer, email or #number" />
                <select className="input-field py-2 text-sm w-36" value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="">Any priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
                </select>
            </form>
            <Err msg={error} />
            {!data ? <Spinner /> : data.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-rl-gray-3 text-sm text-rl-gray">No tickets here.</div>
            ) : (
                <div className="bg-white border border-rl-gray-3 rounded-xl overflow-hidden divide-y divide-rl-gray-3">
                    {data.map(t => (
                        <button key={t.id} onClick={() => go({ ticket: t.id })} className="w-full text-left px-4 py-3 hover:bg-rl-gray-4 flex gap-3 items-start">
                            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${t.waitingOnUs ? 'bg-rl-blue' : 'bg-transparent'}`} title={t.waitingOnUs ? 'Waiting on us' : ''} />
                            <span className="flex-1 min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-rl-gray-2 font-semibold">#{t.number}</span>
                                    <span className="text-sm font-bold text-rl-dark truncate">{t.subject}</span>
                                </span>
                                <span className="block text-xs text-rl-gray truncate mt-0.5">{t.customer.name} · {t.preview}</span>
                            </span>
                            <span className="flex flex-col items-end gap-1 shrink-0">
                                <span className="flex gap-1"><Pill cls={PRIORITY_CLS[t.priority]}>{t.priority}</Pill><Pill cls={STATUS_CLS[t.status]}>{t.status}</Pill></span>
                                <span className="text-[11px] text-rl-gray-2">{t.assignee ? t.assignee.name : 'Unassigned'} · {timeAgo(t.updatedAt)}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Customer & booking full views ──────────────────────────────────────────
function Activity({ rows }) {
    if (!rows?.length) return <p className="text-sm text-rl-gray">No staff actions yet.</p>
    return (
        <div className="space-y-1.5">
            {rows.map((a, i) => (
                <div key={i} className="text-xs flex justify-between gap-3">
                    <span><span className="font-semibold text-rl-dark">{ACTION_LABELS[a.action] || a.action}</span>{a.detail?.reason ? ` — ${a.detail.reason}` : ''}</span>
                    <span className="text-rl-gray-2 shrink-0">{a.by} · {timeAgo(a.createdAt)}</span>
                </div>
            ))}
        </div>
    )
}

function NewTicketForCustomer({ customerId, bookings, go }) {
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ subject: '', body: '', category: 'other', bookingId: '' })
    const [err, setErr] = useState('')
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
    if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-rl-gray-3 hover:bg-rl-gray-4">Open ticket for them</button>
    const submit = async () => {
        setErr('')
        try { const t = await api.helpdesk('/tickets', { method: 'POST', body: { ...form, userId: customerId, bookingId: form.bookingId || null } }); go({ ticket: t.id }) } catch (e) { setErr(e.message) }
    }
    return (
        <div className="w-full border border-rl-gray-3 rounded-lg p-3 space-y-2 bg-rl-gray-4">
            <input className="input-field py-2 text-sm" placeholder="Subject" value={form.subject} onChange={set('subject')} />
            <textarea className="input-field text-sm min-h-[80px]" placeholder="What the customer told you (phone, email…)" value={form.body} onChange={set('body')} />
            <div className="flex gap-2">
                <select className="input-field py-1.5 text-sm" value={form.category} onChange={set('category')}>
                    {['booking', 'shipping', 'payment', 'account', 'listing', 'damage', 'other'].map(c => <option key={c}>{c}</option>)}
                </select>
                <select className="input-field py-1.5 text-sm" value={form.bookingId} onChange={set('bookingId')}>
                    <option value="">No booking</option>
                    {bookings.map(b => <option key={b.id} value={b.id}>{b.title} · {b.startDate}</option>)}
                </select>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2"><button onClick={submit} className="btn-primary text-xs py-1.5 px-3">Create ticket</button><button onClick={() => setOpen(false)} className="text-xs text-rl-gray">Cancel</button></div>
        </div>
    )
}

function CustomerView({ id, go }) {
    const { data: c, error, reload } = useLoad(() => api.helpdesk(`/customers/${id}`), [id])
    const [msg, setMsg] = useState('')
    if (!c) return error ? <Err msg={error} /> : <Spinner />
    const post = async (path, body) => { const r = await api.helpdesk(`/customers/${id}${path}`, { method: 'POST', body }); setMsg(r.message || 'Done.'); reload() }
    return (
        <div className="space-y-4">
            <button onClick={() => go({})} className="text-xs text-rl-gray hover:text-rl-blue-600">← Queue</button>
            {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-3 py-2">{msg}</div>}
            <div className="grid lg:grid-cols-[320px_1fr] gap-4">
                <div className="space-y-4">
                    <CustomerSummary c={c} go={go} />
                    <Card title="Actions">
                        <div className="flex flex-wrap gap-2">
                            <ReasonAction label="Send password reset" needsReason={false} onRun={() => post('/password-reset')} />
                            {(!c.idVerified || !c.phoneVerified) && <ReasonAction label="Remind to verify" needsReason={false} onRun={() => post('/verification-reminder')} />}
                            {c.suspended
                                ? <ReasonAction label="Reinstate account" onRun={r => post('/suspend', { suspended: false, reason: r })} />
                                : <ReasonAction label="Suspend account" confirmLabel="Suspend + pause listings" danger onRun={r => post('/suspend', { suspended: true, reason: r })} />}
                            <NewTicketForCustomer customerId={c.id} bookings={c.bookings} go={go} />
                        </div>
                        {c.suspended && c.suspendedReason && <p className="text-xs text-red-700 mt-2">Suspended: {c.suspendedReason}</p>}
                        <p className="text-[11px] text-rl-gray-2 mt-2">Emails {c.emailsOn ? 'on' : 'off'} · Texts {c.textsOn ? 'on' : 'off'}</p>
                    </Card>
                    <Card title="Staff activity"><Activity rows={c.activity} /></Card>
                </div>
                <div className="space-y-4 min-w-0">
                    <Card title={`Bookings (${c.bookings.length})`}>
                        {c.bookings.length === 0 ? <p className="text-sm text-rl-gray">None.</p> : (
                            <div className="divide-y divide-rl-gray-3">
                                {c.bookings.map(b => (
                                    <button key={b.id} onClick={() => go({ booking: b.id })} className="w-full text-left py-2 flex items-center gap-3 hover:bg-rl-gray-4 px-1 rounded">
                                        <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-rl-dark truncate">{b.title}</span>
                                            <span className="block text-xs text-rl-gray">{day(b.startDate)} → {day(b.endDate)} · {b.as === 'renter' ? `rented from ${b.owner.name}` : `rented by ${b.renter.name}`} · {b.fulfillment}</span></span>
                                        <span className="text-xs text-rl-dark">{currency(b.total)}</span>
                                        <Pill cls={BOOKING_CLS[b.status] || ''}>{b.status}</Pill>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                    <Card title={`Tickets (${c.tickets.length})`}>
                        {c.tickets.length === 0 ? <p className="text-sm text-rl-gray">None.</p> : c.tickets.map(t => (
                            <button key={t.id} onClick={() => go({ ticket: t.id })} className="w-full text-left py-1.5 flex gap-2 items-center text-sm hover:bg-rl-gray-4 px-1 rounded">
                                <span className="text-xs text-rl-gray-2 w-12">#{t.number}</span><span className="flex-1 truncate">{t.subject}</span><Pill cls={STATUS_CLS[t.status]}>{t.status}</Pill>
                            </button>
                        ))}
                    </Card>
                    <Card title="Emails & texts sent">
                        {c.deliveries.length === 0 ? <p className="text-sm text-rl-gray">Nothing sent yet.</p> : (
                            <div className="space-y-1">
                                {c.deliveries.map((d, i) => (
                                    <div key={i} className="text-xs flex flex-wrap gap-x-2">
                                        <span className="w-10 font-semibold uppercase text-rl-gray">{d.channel}</span>
                                        <span className="flex-1 min-w-[140px] text-rl-dark">{d.type.replace(/_/g, ' ')}</span>
                                        <Pill cls={d.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : d.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-rl-gray-4 text-rl-gray'}>{d.status}</Pill>
                                        <span className="text-rl-gray-2 w-24 text-right">{timeAgo(d.createdAt)}</span>
                                        {d.error && <span className="w-full text-rl-gray-2 pl-12">{d.error}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                    <Card title="Listings">
                        {c.listings.length === 0 ? <p className="text-sm text-rl-gray">None.</p> : c.listings.map(l => (
                            <div key={l.id} className="text-sm flex gap-2 py-1"><Link to={`/listing/${l.id}`} className="flex-1 truncate text-rl-blue-600 hover:underline">{l.title}</Link><span className="text-xs text-rl-gray">{currency(l.pricePerDay)}/day</span><Pill cls="bg-rl-gray-4 text-rl-dark-3">{l.status}</Pill></div>
                        ))}
                    </Card>
                </div>
            </div>
        </div>
    )
}

function BookingView({ id, go }) {
    const { data: b, setData, error } = useLoad(() => api.helpdesk(`/bookings/${id}`), [id])
    if (!b) return error ? <Err msg={error} /> : <Spinner />
    return (
        <div className="space-y-4">
            <button onClick={() => go({})} className="text-xs text-rl-gray hover:text-rl-blue-600">← Queue</button>
            <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                <BookingPanel b={b} go={go} onChanged={nb => setData(d => ({ ...d, ...nb }))} />
                <div className="space-y-4">
                    <Card title="Tickets about this booking">
                        {b.tickets.length === 0 ? <p className="text-sm text-rl-gray">None.</p> : b.tickets.map(t => (
                            <button key={t.id} onClick={() => go({ ticket: t.id })} className="w-full text-left text-sm py-1 flex gap-2"><span className="text-xs text-rl-gray-2">#{t.number}</span><span className="flex-1 truncate">{t.subject}</span><Pill cls={STATUS_CLS[t.status]}>{t.status}</Pill></button>
                        ))}
                    </Card>
                    <Card title="Staff activity"><Activity rows={b.activity} /></Card>
                </div>
            </div>
        </div>
    )
}

function SearchResults({ q, go }) {
    const { data, error } = useLoad(() => api.helpdesk(`/search?q=${encodeURIComponent(q)}`), [q])
    if (!data) return error ? <Err msg={error} /> : <Spinner />
    const none = !data.users.length && !data.bookings.length && !data.tickets.length
    return (
        <div className="space-y-4">
            <p className="text-sm text-rl-gray">Results for “{q}”</p>
            {none && <div className="text-center py-10 bg-white rounded-xl border border-dashed border-rl-gray-3 text-sm text-rl-gray">Nothing found. Try an email, name, phone, booking ID, tracking number or #ticket.</div>}
            {data.users.length > 0 && <Card title="People">{data.users.map(u => (
                <button key={u.id} onClick={() => go({ customer: u.id })} className="w-full text-left py-1.5 text-sm flex gap-2 hover:bg-rl-gray-4 px-1 rounded"><span className="font-semibold flex-1">{u.name}</span><span className="text-rl-gray">{u.email}</span>{u.suspended && <Pill cls="bg-red-600 text-white">Suspended</Pill>}</button>
            ))}</Card>}
            {data.bookings.length > 0 && <Card title="Bookings">{data.bookings.map(b => (
                <button key={b.id} onClick={() => go({ booking: b.id })} className="w-full text-left py-1.5 text-sm flex gap-2 hover:bg-rl-gray-4 px-1 rounded"><span className="font-semibold flex-1 truncate">{b.title}</span><span className="text-xs text-rl-gray">{b.renter.name} ← {b.owner.name} · {day(b.startDate)}</span><Pill cls={BOOKING_CLS[b.status] || ''}>{b.status}</Pill></button>
            ))}</Card>}
            {data.tickets.length > 0 && <Card title="Tickets">{data.tickets.map(t => (
                <button key={t.id} onClick={() => go({ ticket: t.id })} className="w-full text-left py-1.5 text-sm flex gap-2 hover:bg-rl-gray-4 px-1 rounded"><span className="text-xs text-rl-gray-2 w-12">#{t.number}</span><span className="flex-1 truncate">{t.subject}</span><Pill cls={STATUS_CLS[t.status]}>{t.status}</Pill></button>
            ))}</Card>}
        </div>
    )
}

function ActivityLog() {
    const { data, error } = useLoad(() => api.helpdesk('/activity'), [])
    if (!data) return error ? <Err msg={error} /> : <Spinner />
    return <Card title="Help desk activity"><Activity rows={data} /></Card>
}

function StaffPanel({ isAdminUser, onChanged }) {
    const { data, setData, error } = useLoad(() => api.helpdesk('/staff'), [])
    const [email, setEmail] = useState('')
    const [err, setErr] = useState('')
    const add = async (e) => {
        e.preventDefault(); setErr('')
        try { setData(await api.helpdesk('/staff', { method: 'POST', body: { email } })); setEmail(''); onChanged() } catch (e2) { setErr(e2.message) }
    }
    const remove = async (id) => { setErr(''); try { setData(await api.helpdesk(`/staff/${id}`, { method: 'DELETE' })); onChanged() } catch (e2) { setErr(e2.message) } }
    if (!data) return error ? <Err msg={error} /> : <Spinner />
    return (
        <Card title="Support team">
            <div className="divide-y divide-rl-gray-3 mb-4">
                {data.map(s => (
                    <div key={s.id} className="py-2 flex items-center gap-3 text-sm">
                        <span className="flex-1"><span className="font-semibold">{s.name}</span> <span className="text-rl-gray">{s.email}</span></span>
                        <Pill cls={s.role === 'admin' ? 'bg-rl-blue text-white' : 'bg-rl-blue-100 text-rl-blue-600'}>{s.role}</Pill>
                        {isAdminUser && s.role === 'support' && <button onClick={() => remove(s.id)} className="text-xs text-red-600 hover:underline">Remove</button>}
                    </div>
                ))}
            </div>
            {isAdminUser ? (
                <form onSubmit={add} className="flex gap-2">
                    <input className="input-field py-2 text-sm flex-1" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Add an agent by their account email" />
                    <button className="btn-primary text-xs px-4">Add</button>
                </form>
            ) : <p className="text-xs text-rl-gray">Only admins can add or remove agents.</p>}
            {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
            <p className="text-[11px] text-rl-gray-2 mt-3">Agents can answer tickets, look up customers and bookings, cancel bookings, manage labels, send reset links and suspend customer accounts. Every action is logged.</p>
        </Card>
    )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function HelpDeskPage() {
    const { user, loading } = useAuth()
    const [params, setParams] = useSearchParams()
    const [search, setSearch] = useState(params.get('q') || '')
    const [refreshKey, setRefreshKey] = useState(0)
    const { data: summary, reload: reloadSummary } = useLoad(() => (user?.isStaff ? api.helpdesk('/summary') : Promise.resolve(null)), [user?.isStaff, refreshKey])

    if (loading) return <Spinner />
    if (!user) return <Navigate to="/login" replace state={{ from: '/helpdesk' }} />
    if (!user.isStaff) {
        return <div className="max-w-md mx-auto text-center py-20"><h1 className="text-xl font-extrabold text-rl-dark mb-2">Help desk</h1><p className="text-sm text-rl-gray">This area is for Rentaleze support staff.</p><Link to="/dashboard/support" className="btn-primary text-sm mt-4 inline-flex">Contact support</Link></div>
    }

    const view = params.get('view') || 'open'
    const page = params.get('page')
    // go({}) returns to the current queue; go({ ticket | customer | booking }) opens that record
    const go = (next) => setParams(Object.keys(next).length ? next : { view })
    const changed = () => { setRefreshKey(k => k + 1); reloadSummary() }

    let main
    if (params.get('ticket')) main = summary ? <TicketView id={params.get('ticket')} summary={summary} go={go} onChanged={changed} /> : <Spinner />
    else if (params.get('customer')) main = <CustomerView id={params.get('customer')} go={go} />
    else if (params.get('booking')) main = <BookingView id={params.get('booking')} go={go} />
    else if (params.get('q')) main = <SearchResults q={params.get('q')} go={go} />
    else if (page === 'activity') main = <ActivityLog />
    else if (page === 'staff') main = <StaffPanel isAdminUser={!!summary?.me.isAdmin} onChanged={changed} />
    else main = <TicketList view={view} go={go} refreshKey={refreshKey} />

    const count = { open: summary?.open, mine: summary?.mine, unassigned: summary?.unassigned, pending: summary?.pending }
    const isQueue = !params.get('ticket') && !params.get('customer') && !params.get('booking') && !params.get('q') && !page
    const navBtn = (key, active, label, onClick, n) => (
        <button key={key} onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium ${active ? 'bg-rl-blue-50 text-rl-blue-600' : 'text-rl-dark-3 hover:bg-white'}`}>
            <span>{label}</span>{n > 0 && <span className="text-xs font-bold bg-white rounded-full px-2">{n}</span>}
        </button>
    )

    return (
        <div className="bg-rl-gray-4 min-h-[calc(100vh-64px)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div>
                        <h1 className="text-2xl font-extrabold text-rl-dark">Help desk</h1>
                        {summary && <p className="text-sm text-rl-gray">{summary.open} open · {summary.urgent} high/urgent · {summary.unassigned} unassigned · {summary.solvedToday} solved today{summary.oldestOpenAt ? ` · oldest open ${timeAgo(summary.oldestOpenAt)}` : ''}</p>}
                    </div>
                    <form onSubmit={e => { e.preventDefault(); if (search.trim().length >= 2) setParams({ q: search.trim() }) }} className="flex gap-2 w-full sm:w-auto">
                        <input className="input-field py-2 text-sm sm:w-80" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a customer, booking, tracking # or #ticket" />
                        <button className="btn-primary text-sm px-4">Search</button>
                    </form>
                </div>
                <div className="grid md:grid-cols-[200px_1fr] gap-5">
                    <aside className="space-y-1">
                        {VIEWS.map(([k, label]) => navBtn(k, isQueue && view === k, label, () => setParams({ view: k }), count[k]))}
                        <div className="h-px bg-rl-gray-3 my-2" />
                        {navBtn('activity', page === 'activity', 'Activity log', () => setParams({ page: 'activity' }))}
                        {navBtn('staff', page === 'staff', 'Support team', () => setParams({ page: 'staff' }))}
                    </aside>
                    <main className="min-w-0">{main}</main>
                </div>
            </div>
        </div>
    )
}
