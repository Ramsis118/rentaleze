import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const currency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const day = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const when = (s) => {
    if (!s) return ''
    const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const CLAIM_STATUS = {
    open: { label: 'Open', className: 'bg-amber-100 text-amber-800' },
    under_review: { label: 'Under review', className: 'bg-rl-blue-100 text-rl-blue-600' },
    resolved: { label: 'Resolved', className: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Declined', className: 'bg-red-100 text-red-700' },
    withdrawn: { label: 'Withdrawn', className: 'bg-rl-gray-4 text-rl-dark-3' }
}

function Section({ title, subtitle, children }) {
    return (
        <section className="border border-rl-gray-3 rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-bold text-rl-dark">{title}</h2>
            {subtitle && <p className="text-sm text-rl-gray mt-0.5 mb-4">{subtitle}</p>}
            {!subtitle && <div className="mb-4" />}
            {children}
        </section>
    )
}

function Stars({ value, onChange, size = 'text-2xl' }) {
    return (
        <div className="flex gap-1" role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
            {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    className={`${size} leading-none ${n <= value ? 'text-amber-400' : 'text-rl-gray-3'} ${onChange ? 'hover:scale-110 transition-transform' : 'cursor-default'}`}>
                    ★
                </button>
            ))}
        </div>
    )
}

function PhotoGroup({ bookingId, stage, title, photos, canUpload, myId, onChange }) {
    const input = useRef(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const upload = async (files) => {
        if (!files?.length) return
        setBusy(true); setError('')
        try { onChange((await api.uploadBookingPhotos(bookingId, stage, files)).photos) }
        catch (err) { setError(err.message) }
        finally { setBusy(false); if (input.current) input.current.value = '' }
    }
    const remove = async (photoId) => {
        try { onChange((await api.deleteBookingPhoto(bookingId, photoId)).photos) } catch (err) { setError(err.message) }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-rl-dark">{title} <span className="text-rl-gray font-normal">({photos.length})</span></h3>
                {canUpload && (
                    <>
                        <button onClick={() => input.current?.click()} disabled={busy} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-60">
                            {busy ? 'Uploading…' : '+ Add photos'}
                        </button>
                        <input ref={input} type="file" accept="image/*" multiple capture="environment" className="hidden"
                            onChange={(e) => upload(Array.from(e.target.files || []))} />
                    </>
                )}
            </div>
            {photos.length === 0 ? (
                <p className="text-xs text-rl-gray-2 bg-rl-gray-4 rounded-xl px-3 py-4 text-center">No photos yet</p>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photos.map(p => (
                        <div key={p.id} className="relative group">
                            <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-rl-gray-4">
                                <img src={p.url} alt={`${title} by ${p.uploaderName}`} className="w-full h-full object-cover" loading="lazy" />
                            </a>
                            <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5">{p.uploaderName} · {when(p.createdAt)}</span>
                            {canUpload && p.uploadedBy === myId && stage !== 'claim' && (
                                <button onClick={() => remove(p.id)} aria-label="Delete photo"
                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-red-600 text-xs font-bold opacity-0 group-hover:opacity-100 focus:opacity-100">✕</button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
    )
}

function ReviewSection({ data, onUpdated }) {
    const { review, role, booking } = data
    const [rating, setRating] = useState(0)
    const [text, setText] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const otherLabel = role === 'renter' ? `the item and ${booking.ownerName}` : booking.renterName

    const submit = async (e) => {
        e.preventDefault()
        if (!rating) return setError('Choose a star rating.')
        setBusy(true); setError('')
        try { onUpdated(await api.reviewBooking(booking.id, rating, text)) } catch (err) { setError(err.message) } finally { setBusy(false) }
    }

    if (booking.status !== 'completed') {
        return <p className="text-sm text-rl-gray">Reviews open once the item has been returned.</p>
    }
    return (
        <div className="space-y-4">
            {review.mine ? (
                <div className="bg-rl-gray-4 rounded-xl p-4">
                    <p className="text-xs font-bold text-rl-gray uppercase tracking-wide mb-1">Your review</p>
                    <Stars value={review.mine.rating} size="text-lg" />
                    <p className="text-sm text-rl-dark mt-2">{review.mine.text}</p>
                </div>
            ) : review.canWrite ? (
                <form onSubmit={submit} className="space-y-3">
                    <p className="text-sm text-rl-dark">How was {otherLabel}?</p>
                    <Stars value={rating} onChange={setRating} />
                    <textarea className="input-field min-h-[96px]" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
                        placeholder={role === 'renter' ? 'Was the item as described? How was pickup and return?' : 'Was the renter on time and careful with your item?'} />
                    <div className="flex items-center gap-3">
                        <button disabled={busy} className="btn-primary text-sm disabled:opacity-60">{busy ? 'Posting…' : 'Post review'}</button>
                        {review.windowEndsAt && <span className="text-xs text-rl-gray">Reviews close {new Date(review.windowEndsAt).toLocaleDateString()}</span>}
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                </form>
            ) : (
                <p className="text-sm text-rl-gray">The review window for this rental has closed.</p>
            )}

            {review.theirs ? (
                <div className="border border-rl-gray-3 rounded-xl p-4">
                    <p className="text-xs font-bold text-rl-gray uppercase tracking-wide mb-1">{review.theirs.reviewerName}'s review of you</p>
                    <Stars value={review.theirs.rating} size="text-lg" />
                    <p className="text-sm text-rl-dark mt-2">{review.theirs.text}</p>
                </div>
            ) : review.theirsPending ? (
                <p className="text-xs text-rl-gray">The other person has left a review. You'll see it after you post yours.</p>
            ) : null}
        </div>
    )
}

function ClaimCard({ claim, bookingId, myId, onUpdated }) {
    const [reply, setReply] = useState('')
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const open = ['open', 'under_review'].includes(claim.status)
    const st = CLAIM_STATUS[claim.status] || CLAIM_STATUS.open

    const act = async (key, fn) => {
        setBusy(key); setError('')
        try { onUpdated(await fn()); setReply('') } catch (err) { setError(err.message) } finally { setBusy('') }
    }

    return (
        <div className="border border-rl-gray-3 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-bold text-rl-dark text-sm">{claim.typeLabel}</p>
                    <p className="text-xs text-rl-gray">
                        Filed by the {claim.filerRole} · {when(claim.createdAt)}
                        {claim.amountRequested > 0 && <> · Asking {currency(claim.amountRequested)}</>}
                    </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${st.className}`}>{st.label}</span>
            </div>
            <p className="text-sm text-rl-dark mt-3 whitespace-pre-line">{claim.description}</p>
            {claim.status === 'resolved' && (
                <p className="text-sm text-emerald-700 mt-2 font-semibold">Approved: {currency(claim.amountApproved)}</p>
            )}

            <div className="mt-4 space-y-2">
                {claim.events.map(e => (
                    <div key={e.id} className={`text-sm rounded-lg px-3 py-2 ${e.authorRole === 'admin' ? 'bg-rl-blue-50' : e.kind === 'status' ? 'bg-rl-gray-4 text-rl-gray' : 'bg-white border border-rl-gray-3'}`}>
                        <span className="font-semibold text-rl-dark">{e.authorName}</span>
                        <span className="text-xs text-rl-gray-2"> · {when(e.createdAt)}</span>
                        <p className="mt-0.5 whitespace-pre-line">{e.body}</p>
                    </div>
                ))}
            </div>

            {open && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input className="input-field" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000}
                        placeholder={claim.filedBy === myId ? 'Add details for Support…' : 'Give your side of what happened…'} />
                    <button disabled={!!busy || !reply.trim()} onClick={() => act('reply', () => api.commentOnClaim(bookingId, claim.id, reply))}
                        className="btn-primary text-sm shrink-0 justify-center disabled:opacity-60">{busy === 'reply' ? 'Sending…' : 'Reply'}</button>
                </div>
            )}
            {open && claim.filedBy === myId && (
                <button disabled={!!busy} onClick={() => act('withdraw', () => api.withdrawClaim(bookingId, claim.id))}
                    className="text-xs text-rl-gray hover:text-red-600 mt-3">Withdraw claim</button>
            )}
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
    )
}

function ClaimForm({ data, onUpdated, onCancel }) {
    const [type, setType] = useState(Object.keys(data.claimTypes)[0] || '')
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const submit = async (e) => {
        e.preventDefault()
        setBusy(true); setError('')
        try { onUpdated(await api.fileClaim(data.booking.id, { type, description, amountRequested: Number(amount) || 0 })) }
        catch (err) { setError(err.message) } finally { setBusy(false) }
    }

    return (
        <form onSubmit={submit} className="space-y-3 bg-rl-gray-4 rounded-xl p-4">
            <div>
                <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">What went wrong?</label>
                <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
                    {Object.entries(data.claimTypes).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">What happened</label>
                <textarea className="input-field min-h-[110px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000}
                    placeholder="Describe the problem, when you noticed it, and what you've already tried with the other person." required />
            </div>
            <div>
                <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Amount you're asking for (optional)</label>
                <input type="number" min="0" step="0.01" className="input-field sm:max-w-[200px]" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0.00" />
                <p className="text-xs text-rl-gray mt-1">For damage, include a repair quote or receipt in the photos below once the claim is open.</p>
            </div>
            <div className="flex gap-2">
                <button disabled={busy} className="btn-primary text-sm disabled:opacity-60">{busy ? 'Filing…' : 'File claim'}</button>
                <button type="button" onClick={onCancel} className="btn-outline text-sm">Cancel</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
    )
}

export default function BookingDetailPage() {
    const { id } = useParams()
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [filing, setFiling] = useState(false)
    const { user } = useAuth()
    const myId = user?.id

    const load = useCallback(async () => {
        try { setData(await api.getBookingTrust(id)) } catch (err) { setError(err.message) }
    }, [id])

    useEffect(() => { load() }, [load])

    if (error) return <div className="py-12 text-center"><p className="text-red-600 text-sm mb-4">{error}</p><Link to="/dashboard/bookings" className="btn-outline text-sm">Back to bookings</Link></div>
    if (!data) return <div className="py-16 flex justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" /></div>

    const { booking, role } = data
    const setPhotos = (photos) => setData(d => ({ ...d, photos }))
    const other = role === 'owner' ? booking.renterName : booking.ownerName

    return (
        <div className="space-y-6">
            <div>
                <Link to={`/dashboard/bookings${role === 'owner' ? '?tab=owner' : ''}`} className="text-sm text-rl-gray hover:text-rl-dark">← All bookings</Link>
                <div className="flex items-start gap-4 mt-3">
                    {booking.image && <img src={booking.image} alt="" className="w-20 h-20 rounded-xl object-cover bg-rl-gray-4 shrink-0" />}
                    <div className="min-w-0">
                        <h1 className="text-2xl font-extrabold text-rl-dark truncate">{booking.title}</h1>
                        <p className="text-sm text-rl-gray">
                            {day(booking.startDate)} → {day(booking.endDate)} · {booking.days} day{booking.days === 1 ? '' : 's'} ·
                            {' '}{role === 'owner' ? `Renter: ${booking.renterName}` : `Owner: ${booking.ownerName}`} ·
                            {' '}{currency(role === 'owner' ? booking.baseTotal : booking.total)}
                        </p>
                        <p className="text-xs font-bold uppercase tracking-wide text-rl-blue-600 mt-1">{booking.status}</p>
                    </div>
                </div>
            </div>

            <Section title="Condition photos"
                subtitle={`Take photos at pickup and return so you and ${other} both have a record of the item's condition. Only the two of you and Rentaleze Support can see them.`}>
                <div className="grid md:grid-cols-2 gap-6">
                    <PhotoGroup bookingId={booking.id} stage="pickup" title="At pickup" photos={data.photos.pickup}
                        canUpload={data.canUpload.pickup} myId={myId} onChange={setPhotos} />
                    <PhotoGroup bookingId={booking.id} stage="return" title="At return" photos={data.photos.return}
                        canUpload={data.canUpload.return} myId={myId} onChange={setPhotos} />
                </div>
            </Section>

            <Section title="Reviews" subtitle="Reviews are double-blind: neither of you sees the other's review until you've both posted, or 14 days pass.">
                <ReviewSection data={data} onUpdated={setData} />
            </Section>

            <Section title="Report a problem"
                subtitle={`Damage, missing parts, a late return or an item that wasn't as described. You can file during the rental or up to ${data.claimWindowHours} hours after return.`}>
                <div className="space-y-4">
                    {data.claims.map(c => <ClaimCard key={c.id} claim={c} bookingId={booking.id} myId={myId} onUpdated={setData} />)}
                    {(data.photos.claim.length > 0 || data.canUpload.claim) && data.claims.length > 0 && (
                        <PhotoGroup bookingId={booking.id} stage="claim" title="Evidence (photos, receipts, repair quotes)" photos={data.photos.claim}
                            canUpload={data.canUpload.claim} myId={myId} onChange={setPhotos} />
                    )}
                    {data.canFileClaim && (filing
                        ? <ClaimForm data={data} onUpdated={(d) => { setData(d); setFiling(false) }} onCancel={() => setFiling(false)} />
                        : <button onClick={() => setFiling(true)} className="btn-outline text-sm">Report a problem</button>)}
                    {!data.canFileClaim && data.claims.length === 0 && (
                        <p className="text-sm text-rl-gray">
                            {['requested', 'accepted'].includes(booking.status) ? 'You can report a problem once the rental starts.' : 'Nothing reported for this rental.'}
                        </p>
                    )}
                </div>
            </Section>
        </div>
    )
}
