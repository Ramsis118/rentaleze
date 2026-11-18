import React, { useCallback, useEffect, useState } from 'react'
import { Navigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

const currency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const date = (s) => (s ? new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

const TABS = [['overview', 'Overview'], ['claims', 'Claims'], ['users', 'Users'], ['listings', 'Listings'], ['bookings', 'Bookings'], ['waitlist', 'Waitlist'], ['audit', 'Activity log']]

function useLoad(fn, deps) {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const reload = useCallback(async () => {
        setError('')
        try { setData(await fn()) } catch (e) { setError(e.message) }
    }, deps) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { reload() }, [reload])
    return { data, error, reload }
}

const Spinner = () => <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" /></div>
const Err = ({ msg }) => (msg ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{msg}</div> : null)
const Badge = ({ tone = 'gray', children }) => {
    const tones = { gray: 'bg-rl-gray-4 text-rl-dark-3', green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', blue: 'bg-rl-blue-100 text-rl-blue-600' }
    return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${tones[tone]}`}>{children}</span>
}

function Stat({ label, value, sub }) {
    return (
        <div className="bg-white border border-rl-gray-3 rounded-2xl p-4">
            <p className="text-xs font-bold text-rl-gray uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-extrabold text-rl-dark mt-1">{value}</p>
            {sub && <p className="text-xs text-rl-gray mt-0.5">{sub}</p>}
        </div>
    )
}

// ─── Overview ───────────────────────────────────────────────────────────────
function Overview({ go }) {
    const { data: s, error } = useLoad(() => api.admin('/stats'), [])
    const { data: cfg } = useLoad(() => api.admin('/config'), [])
    if (error) return <Err msg={error} />
    if (!s) return <Spinner />
    const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')
    const b = s.bookings.byStatus
    return (
        <div className="space-y-6">
            {cfg && (!cfg.stripeIdentity || !cfg.twilioVerify || !cfg.identityWebhook) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <p className="font-bold mb-1">Setup still needed</p>
                    <ul className="list-disc ml-5 space-y-0.5">
                        {!cfg.stripeIdentity && <li>Add STRIPE_SECRET_KEY so people can verify their ID.</li>}
                        {!cfg.identityWebhook && <li>Add the Stripe Identity webhook and STRIPE_IDENTITY_WEBHOOK_SECRET.</li>}
                        {!cfg.twilioVerify && <li>Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID for text codes.</li>}
                    </ul>
                </div>
            )}
            {s.claims.open > 0 && (
                <button onClick={() => go('claims')} className="w-full text-left bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-semibold">
                    {s.claims.open} open claim{s.claims.open === 1 ? '' : 's'} waiting for a decision →
                </button>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Waitlist" value={s.waitlist.total} sub={`+${s.waitlist.last7Days} this week`} />
                <Stat label="Members" value={s.users.total} sub={`+${s.users.last7Days} this week`} />
                <Stat label="Fully verified" value={pct(Math.min(s.users.idVerified, s.users.phoneVerified), s.users.total)} sub={`${s.users.idVerified} ID · ${s.users.phoneVerified} phone`} />
                <Stat label="Active listings" value={s.listings.active} sub={`${s.listings.owners} owners`} />
                <Stat label="Booking requests" value={Object.values(b).reduce((x, y) => x + y, 0)} sub={`${b.completed || 0} completed`} />
                <Stat label="Booked value (GMV)" value={currency(s.bookings.gmv)} sub="Confirmed, active and completed" />
                <Stat label="Platform fees" value={currency(s.bookings.platformFees)} sub="12% renter service fee" />
                <Stat label="Avg. review" value={s.reviews.avg ? `${s.reviews.avg} ★` : '—'} sub={`${s.reviews.n} reviews`} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-rl-gray-3 rounded-2xl p-4">
                    <p className="text-sm font-bold text-rl-dark mb-3">Waitlist by top ZIP codes</p>
                    {s.waitlist.topZips.length === 0 ? <p className="text-sm text-rl-gray">No ZIPs yet</p> : (
                        <ul className="space-y-1.5 text-sm">{s.waitlist.topZips.map(z => (
                            <li key={z.zip} className="flex justify-between"><span>{z.zip}</span><span className="font-semibold">{z.n}</span></li>
                        ))}</ul>
                    )}
                </div>
                <div className="bg-white border border-rl-gray-3 rounded-2xl p-4">
                    <p className="text-sm font-bold text-rl-dark mb-3">Waitlist: what people want to do</p>
                    <ul className="space-y-1.5 text-sm">{s.waitlist.byRole.map(r => (
                        <li key={r.role} className="flex justify-between"><span className="capitalize">{r.role}</span><span className="font-semibold">{r.n}</span></li>
                    ))}</ul>
                </div>
            </div>
            <p className="text-xs text-rl-gray">Demo listings and demo accounts are left out of every number.</p>
        </div>
    )
}

// ─── Claims ─────────────────────────────────────────────────────────────────
function ClaimDetail({ id, onClose, onChanged }) {
    const { data, error, reload } = useLoad(() => api.admin(`/claims/${id}`), [id])
    const [note, setNote] = useState('')
    const [amount, setAmount] = useState('')
    const [busy, setBusy] = useState('')
    const [err, setErr] = useState('')
    if (error) return <Err msg={error} />
    if (!data) return <Spinner />
    const { claim, booking, contacts, photos } = data
    const open = ['open', 'under_review'].includes(claim.status)

    const act = async (key, path, body) => {
        setBusy(key); setErr('')
        try { await api.admin(path, { method: key === 'comment' ? 'POST' : 'PUT', body }); setNote(''); await reload(); onChanged() }
        catch (e) { setErr(e.message) } finally { setBusy('') }
    }
    const allPhotos = [...photos.pickup.map(p => ({ ...p, stage: 'Pickup' })), ...photos.return.map(p => ({ ...p, stage: 'Return' })), ...photos.claim.map(p => ({ ...p, stage: 'Evidence' }))]

    return (
        <div className="space-y-5">
            <button onClick={onClose} className="text-sm text-rl-gray hover:text-rl-dark">← All claims</button>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-rl-dark">{claim.typeLabel}</h2>
                    <p className="text-sm text-rl-gray">{booking.title} · {booking.startDate} → {booking.endDate} · booking {currency(booking.total)}</p>
                </div>
                <Badge tone={open ? 'amber' : claim.status === 'resolved' ? 'green' : 'gray'}>{claim.status.replace('_', ' ')}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {['owner', 'renter'].map(r => (
                    <div key={r} className="bg-rl-gray-4 rounded-xl p-3">
                        <p className="text-xs font-bold uppercase text-rl-gray">{r}{claim.filerRole === r ? ' · filed the claim' : ''}</p>
                        <p className="font-semibold text-rl-dark">{contacts[r].name}</p>
                        <p className="text-rl-gray">{contacts[r].email}{contacts[r].phone ? ` · ${contacts[r].phone}` : ''}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white border border-rl-gray-3 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-rl-gray mb-1">Asking {currency(claim.amountRequested)}</p>
                <p className="text-sm text-rl-dark whitespace-pre-line">{claim.description}</p>
            </div>
            <div>
                <p className="text-sm font-bold text-rl-dark mb-2">Photos ({allPhotos.length})</p>
                {allPhotos.length === 0 ? <p className="text-sm text-rl-gray">No photos were added.</p> : (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {allPhotos.map(p => (
                            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative block aspect-square rounded-lg overflow-hidden bg-rl-gray-4">
                                <img src={p.url} alt={p.stage} className="w-full h-full object-cover" />
                                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1">{p.stage} · {p.uploaderName}</span>
                            </a>
                        ))}
                    </div>
                )}
            </div>
            <div className="space-y-2">
                {claim.events.map(e => (
                    <div key={e.id} className={`text-sm rounded-lg px-3 py-2 ${e.authorRole === 'admin' ? 'bg-rl-blue-50' : 'bg-rl-gray-4'}`}>
                        <span className="font-semibold">{e.authorName}</span> <span className="text-xs text-rl-gray">({e.authorRole}) · {date(e.createdAt)}</span>
                        <p className="whitespace-pre-line">{e.body}</p>
                    </div>
                ))}
            </div>
            {open && (
                <div className="bg-rl-gray-4 rounded-xl p-4 space-y-3">
                    <textarea className="input-field min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="Message to both people, or the reason for your decision" />
                    <div className="flex flex-wrap items-center gap-2">
                        <button disabled={!!busy || !note.trim()} onClick={() => act('comment', `/claims/${id}/comment`, { body: note })} className="btn-outline text-sm disabled:opacity-50">Send message</button>
                        {claim.status === 'open' && <button disabled={!!busy} onClick={() => act('review', `/claims/${id}`, { status: 'under_review', note })} className="btn-secondary text-sm">Mark under review</button>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rl-gray-3">
                        <input type="number" min="0" step="0.01" max={claim.amountRequested} value={amount} onChange={(e) => setAmount(e.target.value)}
                            className="input-field max-w-[160px]" placeholder={`Up to ${currency(claim.amountRequested)}`} />
                        <button disabled={!!busy} onClick={() => act('resolve', `/claims/${id}`, { status: 'resolved', note, amountApproved: Number(amount) || 0 })} className="btn-primary text-sm">Resolve</button>
                        <button disabled={!!busy} onClick={() => act('reject', `/claims/${id}`, { status: 'rejected', note })} className="btn-outline text-sm text-red-600">Decline claim</button>
                    </div>
                    <p className="text-xs text-rl-gray">Approved amounts are recorded here. Collecting the money starts working once Stripe payments are live.</p>
                    <Err msg={err} />
                </div>
            )}
            {!open && claim.resolutionNote && <p className="text-sm text-rl-gray">Decision: {claim.resolutionNote}</p>}
        </div>
    )
}

function Claims() {
    const [status, setStatus] = useState('active')
    const [openId, setOpenId] = useState(null)
    const { data, error, reload } = useLoad(() => api.admin(`/claims?status=${status}`), [status])
    if (openId) return <ClaimDetail id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
    return (
        <div>
            <div className="flex gap-2 mb-4">
                {[['active', 'Needs action'], ['resolved', 'Resolved'], ['rejected', 'Declined'], ['all', 'All']].map(([k, l]) => (
                    <button key={k} onClick={() => setStatus(k)} className={`text-sm px-3 py-1.5 rounded-lg ${status === k ? 'bg-rl-blue text-white' : 'bg-rl-gray-4'}`}>{l}</button>
                ))}
            </div>
            <Err msg={error} />
            {!data ? <Spinner /> : data.claims.length === 0 ? <p className="text-sm text-rl-gray py-8 text-center">No claims here.</p> : (
                <div className="space-y-2">
                    {data.claims.map(c => (
                        <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full text-left border border-rl-gray-3 rounded-xl p-4 hover:border-rl-blue">
                            <div className="flex justify-between gap-3">
                                <p className="font-bold text-rl-dark text-sm">{c.typeLabel} · {c.title}</p>
                                <Badge tone={['open', 'under_review'].includes(c.status) ? 'amber' : c.status === 'resolved' ? 'green' : 'gray'}>{c.status.replace('_', ' ')}</Badge>
                            </div>
                            <p className="text-xs text-rl-gray mt-1">{c.filerName} ({c.filerRole}) vs {c.againstName} · {currency(c.amountRequested)} · filed {date(c.createdAt)}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Users ──────────────────────────────────────────────────────────────────
function Users() {
    const [q, setQ] = useState('')
    const [filter, setFilter] = useState('')
    const [search, setSearch] = useState('')
    const { data, error, reload } = useLoad(() => api.admin(`/users?q=${encodeURIComponent(search)}&filter=${filter}`), [search, filter])
    const [err, setErr] = useState('')

    const act = async (path, body, confirmText) => {
        if (confirmText && !window.confirm(confirmText)) return
        setErr('')
        try { await api.admin(path, { method: 'PUT', body }); reload() } catch (e) { setErr(e.message) }
    }

    return (
        <div>
            <form onSubmit={(e) => { e.preventDefault(); setSearch(q) }} className="flex flex-col sm:flex-row gap-2 mb-4">
                <input className="input-field" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="input-field sm:max-w-[200px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="">Everyone</option><option value="unverified">Not fully verified</option><option value="pending">ID check in progress</option>
                    <option value="failed">ID check failed</option><option value="suspended">Suspended</option><option value="admins">Admins</option>
                </select>
                <button className="btn-primary text-sm justify-center">Search</button>
            </form>
            <Err msg={error || err} />
            {!data ? <Spinner /> : (
                <>
                    <p className="text-xs text-rl-gray mb-2">{data.total} people</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-rl-gray uppercase"><th className="py-2 pr-3">Person</th><th className="pr-3">Checks</th><th className="pr-3">Activity</th><th className="pr-3">Joined</th><th></th></tr></thead>
                            <tbody>
                                {data.users.map(u => (
                                    <tr key={u.id} className="border-t border-rl-gray-3 align-top">
                                        <td className="py-3 pr-3">
                                            <Link to={`/u/${u.id}`} className="font-semibold text-rl-dark hover:text-rl-blue-600">{u.first_name} {u.last_name}</Link>
                                            {u.role === 'admin' && <Badge tone="blue">admin</Badge>}
                                            <p className="text-xs text-rl-gray">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                                            {u.suspended === 1 && <p className="text-xs text-red-600">Suspended{u.suspended_reason ? `: ${u.suspended_reason}` : ''}</p>}
                                        </td>
                                        <td className="pr-3 py-3 space-x-1">
                                            <Badge tone={u.is_verified === 1 ? 'green' : u.id_status === 'pending' ? 'amber' : u.id_status === 'failed' ? 'red' : 'gray'}>
                                                ID {u.is_verified === 1 ? '✓' : u.id_status}
                                            </Badge>
                                            <Badge tone={u.phone_verified === 1 ? 'green' : 'gray'}>Phone {u.phone_verified === 1 ? '✓' : '—'}</Badge>
                                            {u.id_last_error && u.is_verified !== 1 && <p className="text-xs text-rl-gray mt-1">{u.id_last_error}</p>}
                                        </td>
                                        <td className="pr-3 py-3 text-xs text-rl-gray">{u.listings} listings · {u.rentals} rentals{u.claims_against ? ` · ${u.claims_against} claims against` : ''}</td>
                                        <td className="pr-3 py-3 text-xs text-rl-gray">{date(u.created_at)}</td>
                                        <td className="py-3 text-right whitespace-nowrap space-x-2">
                                            {u.is_verified !== 1
                                                ? <button onClick={() => act(`/users/${u.id}/verification`, { action: 'approve' }, `Mark ${u.first_name}'s ID as verified? Only do this after checking their ID yourself.`)} className="text-xs font-semibold text-emerald-700">Approve ID</button>
                                                : <button onClick={() => act(`/users/${u.id}/verification`, { action: 'reset' }, `Remove ${u.first_name}'s ID verification? They'll need to verify again.`)} className="text-xs font-semibold text-rl-gray">Reset ID</button>}
                                            {u.suspended === 1
                                                ? <button onClick={() => act(`/users/${u.id}/suspend`, { suspended: false })} className="text-xs font-semibold text-rl-blue-600">Reinstate</button>
                                                : <button onClick={() => { const reason = window.prompt(`Why suspend ${u.first_name}? (shown to admins only)`); if (reason !== null) act(`/users/${u.id}/suspend`, { suspended: true, reason }) }} className="text-xs font-semibold text-red-600">Suspend</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Listings ───────────────────────────────────────────────────────────────
function Listings() {
    const [status, setStatus] = useState('active')
    const { data, error, reload } = useLoad(() => api.admin(`/listings?status=${status}`), [status])
    const [err, setErr] = useState('')
    const setListing = async (l, next) => {
        let note = ''
        if (next !== 'active') {
            note = window.prompt(next === 'removed' ? 'Reason for removing (the owner will see this):' : 'Reason for pausing (the owner will see this):')
            if (note === null) return
        }
        setErr('')
        try { await api.admin(`/listings/${l.id}/status`, { method: 'PUT', body: { status: next, note } }); reload() } catch (e) { setErr(e.message) }
    }
    return (
        <div>
            <div className="flex gap-2 mb-4">
                {['active', 'paused', 'draft', 'removed'].map(k => (
                    <button key={k} onClick={() => setStatus(k)} className={`text-sm px-3 py-1.5 rounded-lg capitalize ${status === k ? 'bg-rl-blue text-white' : 'bg-rl-gray-4'}`}>{k}</button>
                ))}
            </div>
            <Err msg={error || err} />
            {!data ? <Spinner /> : data.listings.length === 0 ? <p className="text-sm text-rl-gray py-8 text-center">No listings.</p> : (
                <div className="space-y-2">
                    {data.listings.map(l => (
                        <div key={l.id} className="flex items-center gap-3 border border-rl-gray-3 rounded-xl p-3">
                            <div className="w-14 h-14 rounded-lg bg-rl-gray-4 overflow-hidden shrink-0">{l.image && <img src={l.image} alt="" className="w-full h-full object-cover" />}</div>
                            <div className="flex-1 min-w-0">
                                <Link to={`/listing/${l.id}`} className="font-semibold text-sm text-rl-dark hover:text-rl-blue-600 truncate block">{l.title}</Link>
                                <p className="text-xs text-rl-gray">{currency(l.price_per_day)}/day · {l.category} · {l.first_name} {l.last_name} ({l.owner_email}) {l.is_verified === 1 ? '· ✓ verified' : '· not verified'}</p>
                                {l.moderation_note && <p className="text-xs text-amber-700">Note: {l.moderation_note}</p>}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {l.status !== 'active' && <button onClick={() => setListing(l, 'active')} className="text-xs font-semibold text-emerald-700">Restore</button>}
                                {l.status === 'active' && <button onClick={() => setListing(l, 'paused')} className="text-xs font-semibold text-amber-700">Pause</button>}
                                {l.status !== 'removed' && <button onClick={() => setListing(l, 'removed')} className="text-xs font-semibold text-red-600">Remove</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function Bookings() {
    const { data, error } = useLoad(() => api.admin('/bookings'), [])
    if (error) return <Err msg={error} />
    if (!data) return <Spinner />
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-rl-gray uppercase"><th className="py-2 pr-3">Item</th><th className="pr-3">Dates</th><th className="pr-3">Renter / owner</th><th className="pr-3">Total</th><th>Status</th></tr></thead>
                <tbody>{data.bookings.map(b => (
                    <tr key={b.id} className="border-t border-rl-gray-3">
                        <td className="py-2 pr-3 font-semibold">{b.title}</td>
                        <td className="pr-3 text-xs">{b.start_date} → {b.end_date}</td>
                        <td className="pr-3 text-xs text-rl-gray">{b.renter_email}<br />{b.owner_email}</td>
                        <td className="pr-3">{currency(b.total)}</td>
                        <td><Badge>{b.status}</Badge></td>
                    </tr>
                ))}</tbody>
            </table>
            {data.bookings.length === 0 && <p className="text-sm text-rl-gray py-8 text-center">No bookings yet.</p>}
        </div>
    )
}

function Waitlist() {
    const { data, error } = useLoad(() => api.admin('/waitlist?limit=200'), [])
    if (error) return <Err msg={error} />
    if (!data) return <Spinner />
    const csv = () => {
        const rows = [['email', 'role', 'zip', 'interest', 'source', 'signed_up'], ...data.entries.map(e => [e.email, e.role, e.zip, e.interest, e.source, e.created_at])]
        const text = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
        a.download = 'rentaleze-waitlist.csv'
        a.click()
    }
    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-rl-gray">{data.total} sign-ups{data.total > data.entries.length ? ` (showing newest ${data.entries.length})` : ''}</p>
                <button onClick={csv} className="btn-outline text-sm">Download CSV</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-rl-gray uppercase"><th className="py-2 pr-3">Email</th><th className="pr-3">Wants to</th><th className="pr-3">ZIP</th><th className="pr-3">Interest</th><th>Date</th></tr></thead>
                    <tbody>{data.entries.map(e => (
                        <tr key={e.email} className="border-t border-rl-gray-3"><td className="py-2 pr-3">{e.email}</td><td className="pr-3">{e.role}</td><td className="pr-3">{e.zip}</td><td className="pr-3 text-xs">{e.interest}</td><td className="text-xs">{date(e.created_at)}</td></tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
    )
}

function Audit() {
    const { data, error } = useLoad(() => api.admin('/audit'), [])
    if (error) return <Err msg={error} />
    if (!data) return <Spinner />
    return data.actions.length === 0 ? <p className="text-sm text-rl-gray py-8 text-center">No admin actions yet.</p> : (
        <ul className="space-y-2 text-sm">{data.actions.map(a => (
            <li key={a.id} className="border-b border-rl-gray-3 pb-2"><span className="font-semibold">{a.admin_email}</span> · {a.action.replace(/_/g, ' ')} · {a.target_type} <span className="text-xs text-rl-gray">{a.target_id.slice(0, 8)} · {date(a.created_at)}</span></li>
        ))}</ul>
    )
}

export default function AdminPage() {
    const { user, loading } = useAuth()
    const [params, setParams] = useSearchParams()
    const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview'
    const go = (k) => setParams(k === 'overview' ? {} : { tab: k })

    if (loading) return <Spinner />
    if (!user) return <Navigate to="/login" replace state={{ from: '/admin' }} />
    if (!user.isAdmin) return <Navigate to="/dashboard" replace />

    return (
        <div className="min-h-screen bg-rl-off-white py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl font-extrabold text-rl-dark mb-1">Rentaleze admin</h1>
                <p className="text-sm text-rl-gray mb-5">Verification, listings, claims and growth numbers.</p>
                <div className="flex gap-1 overflow-x-auto border-b border-rl-gray-3 mb-6">
                    {TABS.map(([k, label]) => (
                        <button key={k} onClick={() => go(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === k ? 'border-rl-blue text-rl-blue' : 'border-transparent text-rl-gray hover:text-rl-dark'}`}>{label}</button>
                    ))}
                </div>
                <div className="bg-white rounded-2xl shadow-card p-5 sm:p-6">
                    {tab === 'overview' && <Overview go={go} />}
                    {tab === 'claims' && <Claims />}
                    {tab === 'users' && <Users />}
                    {tab === 'listings' && <Listings />}
                    {tab === 'bookings' && <Bookings />}
                    {tab === 'waitlist' && <Waitlist />}
                    {tab === 'audit' && <Audit />}
                </div>
            </div>
        </div>
    )
}
