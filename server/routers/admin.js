// Rentaleze Support / admin tools. Every route requires an admin account
// (role = 'admin', granted only through the ADMIN_EMAILS setting).
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { requireAdmin } from '../middleware/auth.js'
import { claimWithEvents, addClaimEvent, listPhotos, trustSummary } from './bookingTrust.js'
import { identityStripe } from '../services/identity.js'
import { safeNotify } from '../services/notify.js'

const router = Router()
router.use(requireAdmin)

const money = (n) => Math.round((n || 0) * 100) / 100
const like = (q) => `%${String(q || '').trim().toLowerCase()}%`
const page = (req) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200)
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
    return { limit, offset }
}

function audit(req, action, targetType, targetId, detail) {
    db.prepare('INSERT INTO admin_actions (id, admin_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), req.user.id, action, targetType, targetId, detail ? JSON.stringify(detail).slice(0, 2000) : null)
}

// ─── Overview numbers (also what investors will ask for) ────────────────────
router.get('/stats', (req, res) => {
    try {
        const one = (sql, ...args) => db.prepare(sql).get(...args)
        const real = `COALESCE(is_demo, 0) = 0`
        const bookingStatus = db.prepare(`SELECT b.status, COUNT(*) AS n, SUM(b.total) AS gmv, SUM(b.service_fee) AS fees
            FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE COALESCE(l.is_demo, 0) = 0 GROUP BY b.status`).all()
        const by = Object.fromEntries(bookingStatus.map(r => [r.status, r]))
        const done = ['accepted', 'active', 'completed']
        const gmv = done.reduce((s, k) => s + (by[k]?.gmv || 0), 0)
        const fees = done.reduce((s, k) => s + (by[k]?.fees || 0), 0)

        const weekly = db.prepare(`SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n FROM users
            WHERE ${real} AND created_at >= date('now', '-84 days') GROUP BY week ORDER BY week`).all()
        const waitlistWeekly = db.prepare(`SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n FROM waitlist
            WHERE created_at >= date('now', '-84 days') GROUP BY week ORDER BY week`).all()

        res.json({
            users: {
                total: one(`SELECT COUNT(*) AS n FROM users WHERE ${real}`).n,
                idVerified: one(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND is_verified = 1`).n,
                phoneVerified: one(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND phone_verified = 1`).n,
                pendingId: one(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND id_status = 'pending'`).n,
                suspended: one(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND suspended = 1`).n,
                last7Days: one(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND created_at >= datetime('now', '-7 days')`).n,
                weekly
            },
            listings: {
                active: one(`SELECT COUNT(*) AS n FROM listings WHERE ${real} AND status = 'active'`).n,
                total: one(`SELECT COUNT(*) AS n FROM listings WHERE ${real} AND status != 'deleted'`).n,
                removed: one(`SELECT COUNT(*) AS n FROM listings WHERE ${real} AND status = 'removed'`).n,
                owners: one(`SELECT COUNT(DISTINCT owner_id) AS n FROM listings WHERE ${real} AND status = 'active'`).n
            },
            bookings: {
                byStatus: Object.fromEntries(bookingStatus.map(r => [r.status, r.n])),
                gmv: money(gmv),
                platformFees: money(fees)
            },
            claims: {
                open: one(`SELECT COUNT(*) AS n FROM claims WHERE status IN ('open','under_review')`).n,
                total: one(`SELECT COUNT(*) AS n FROM claims`).n
            },
            reviews: one(`SELECT COUNT(*) AS n, ROUND(AVG(rating), 2) AS avg FROM reviews WHERE booking_id IS NOT NULL`),
            waitlist: {
                total: one('SELECT COUNT(*) AS n FROM waitlist').n,
                last7Days: one(`SELECT COUNT(*) AS n FROM waitlist WHERE created_at >= datetime('now', '-7 days')`).n,
                byRole: db.prepare('SELECT COALESCE(role, ?) AS role, COUNT(*) AS n FROM waitlist GROUP BY role').all('unknown'),
                topZips: db.prepare(`SELECT zip, COUNT(*) AS n FROM waitlist WHERE zip IS NOT NULL AND zip != '' GROUP BY zip ORDER BY n DESC LIMIT 10`).all(),
                weekly: waitlistWeekly
            }
        })
    } catch (error) {
        console.error('Admin stats error:', error)
        res.status(500).json({ error: 'Failed to load stats' })
    }
})

// ─── Users ──────────────────────────────────────────────────────────────────
router.get('/users', (req, res) => {
    const { limit, offset } = page(req)
    const where = ['COALESCE(u.is_demo, 0) = 0']
    const args = []
    if (req.query.q) {
        where.push(`(lower(u.email) LIKE ? OR lower(u.first_name || ' ' || u.last_name) LIKE ? OR u.phone LIKE ?)`)
        args.push(like(req.query.q), like(req.query.q), like(req.query.q))
    }
    const filter = req.query.filter
    if (filter === 'unverified') where.push('(u.is_verified != 1 OR u.phone_verified != 1)')
    if (filter === 'pending') where.push(`u.id_status = 'pending'`)
    if (filter === 'failed') where.push(`u.id_status = 'failed'`)
    if (filter === 'suspended') where.push('u.suspended = 1')
    if (filter === 'admins') where.push(`u.role = 'admin'`)

    const rows = db.prepare(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_verified, u.phone_verified, u.id_status,
               u.id_last_error, u.suspended, u.suspended_reason, u.created_at,
               (SELECT COUNT(*) FROM listings l WHERE l.owner_id = u.id AND l.status != 'deleted') AS listings,
               (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS rentals,
               (SELECT COUNT(*) FROM claims c WHERE c.against_user = u.id) AS claims_against
        FROM users u WHERE ${where.join(' AND ')}
        ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `).all(...args, limit, offset)
    const total = db.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${where.join(' AND ')}`).get(...args).n
    res.json({ total, users: rows })
})

// Manual ID decision (e.g. someone who can't use the selfie check). action: approve | reject | reset
router.put('/users/:id/verification', (req, res) => {
    const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!u) return res.status(404).json({ error: 'User not found' })
    const action = req.body?.action
    const note = String(req.body?.note || '').slice(0, 300) || null
    if (action === 'approve') {
        db.prepare(`UPDATE users SET is_verified = 1, id_status = 'verified', id_verified_at = CURRENT_TIMESTAMP, id_last_error = NULL WHERE id = ?`).run(u.id)
    } else if (action === 'reject') {
        db.prepare(`UPDATE users SET is_verified = 0, id_status = 'failed', id_last_error = ? WHERE id = ?`)
            .run(note || 'Your ID could not be verified. Please try again or contact support.', u.id)
    } else if (action === 'reset') {
        db.prepare(`UPDATE users SET is_verified = 0, id_status = 'none', identity_session_id = NULL, id_last_error = NULL WHERE id = ?`).run(u.id)
    } else {
        return res.status(400).json({ error: 'Unknown action' })
    }
    audit(req, `verification_${action}`, 'user', u.id, { note })
    res.json({ ok: true })
})

// Suspend / reinstate. Suspending also pauses the person's live listings.
router.put('/users/:id/suspend', (req, res) => {
    const u = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id)
    if (!u) return res.status(404).json({ error: 'User not found' })
    if (u.id === req.user.id) return res.status(400).json({ error: "You can't suspend yourself." })
    const suspended = !!req.body?.suspended
    const reason = String(req.body?.reason || '').slice(0, 300) || null
    db.transaction(() => {
        db.prepare('UPDATE users SET suspended = ?, suspended_reason = ? WHERE id = ?').run(suspended ? 1 : 0, suspended ? reason : null, u.id)
        if (suspended) {
            db.prepare(`UPDATE listings SET status = 'paused', moderation_note = 'Paused while the account is under review'
                WHERE owner_id = ? AND status = 'active'`).run(u.id)
            // Sign them out everywhere
            db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id)
        }
    })()
    audit(req, suspended ? 'user_suspend' : 'user_reinstate', 'user', u.id, { reason })
    safeNotify(u.id, suspended ? 'account_suspended' : 'account_reinstated', { reason })
    res.json({ ok: true })
})

// ─── Listings ───────────────────────────────────────────────────────────────
router.get('/listings', (req, res) => {
    const { limit, offset } = page(req)
    const where = [`COALESCE(l.is_demo, 0) = 0`, `l.status != 'deleted'`]
    const args = []
    if (req.query.status) { where.push('l.status = ?'); args.push(req.query.status) }
    if (req.query.q) { where.push('(lower(l.title) LIKE ? OR lower(u.email) LIKE ?)'); args.push(like(req.query.q), like(req.query.q)) }
    const rows = db.prepare(`
        SELECT l.id, l.title, l.category, l.price_per_day, l.status, l.image, l.location, l.moderation_note, l.created_at,
               l.rating, l.review_count, u.id AS owner_id, u.email AS owner_email, u.first_name, u.last_name, u.is_verified
        FROM listings l JOIN users u ON u.id = l.owner_id
        WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).all(...args, limit, offset)
    res.json({ listings: rows })
})

// status: active | paused | removed  (removed = owner can't re-publish)
router.put('/listings/:id/status', (req, res) => {
    const l = db.prepare(`SELECT id, status FROM listings WHERE id = ? AND status != 'deleted'`).get(req.params.id)
    if (!l) return res.status(404).json({ error: 'Listing not found' })
    const status = req.body?.status
    if (!['active', 'paused', 'removed'].includes(status)) return res.status(400).json({ error: 'Unknown status' })
    const note = String(req.body?.note || '').slice(0, 300) || null
    db.prepare('UPDATE listings SET status = ?, moderation_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, status === 'active' ? null : note, l.id)
    audit(req, `listing_${status}`, 'listing', l.id, { from: l.status, note })
    res.json({ ok: true })
})

// ─── Bookings ───────────────────────────────────────────────────────────────
router.get('/bookings', (req, res) => {
    const { limit, offset } = page(req)
    const args = []
    let where = 'COALESCE(l.is_demo, 0) = 0'
    if (req.query.status) { where += ' AND b.status = ?'; args.push(req.query.status) }
    const rows = db.prepare(`
        SELECT b.id, b.status, b.start_date, b.end_date, b.total, b.service_fee, b.created_at, l.title,
               r.email AS renter_email, o.email AS owner_email
        FROM bookings b JOIN listings l ON l.id = b.listing_id
        JOIN users r ON r.id = b.user_id JOIN users o ON o.id = l.owner_id
        WHERE ${where} ORDER BY b.created_at DESC LIMIT ? OFFSET ?
    `).all(...args, limit, offset)
    res.json({ bookings: rows })
})

// ─── Claims ─────────────────────────────────────────────────────────────────
router.get('/claims', (req, res) => {
    const { limit, offset } = page(req)
    const status = req.query.status || 'active'
    const where = status === 'active' ? `c.status IN ('open','under_review')` : (status === 'all' ? '1=1' : 'c.status = ?')
    const args = status === 'active' || status === 'all' ? [] : [status]
    const rows = db.prepare(`
        SELECT c.*, l.title, f.first_name AS filer_first, f.last_name AS filer_last, a.first_name AS against_first, a.last_name AS against_last
        FROM claims c JOIN bookings b ON b.id = c.booking_id JOIN listings l ON l.id = b.listing_id
        JOIN users f ON f.id = c.filed_by JOIN users a ON a.id = c.against_user
        WHERE ${where} ORDER BY c.created_at ASC LIMIT ? OFFSET ?
    `).all(...args, limit, offset)
    res.json({
        claims: rows.map(r => ({
            ...claimWithEvents(r), title: r.title,
            filerName: `${r.filer_first} ${r.filer_last}`, againstName: `${r.against_first} ${r.against_last}`
        }))
    })
})

router.get('/claims/:id', (req, res) => {
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id)
    if (!claim) return res.status(404).json({ error: 'Claim not found' })
    const b = db.prepare(`
        SELECT b.*, l.owner_id, l.title, l.image,
               r.first_name AS renter_first, r.last_name AS renter_last, r.email AS renter_email, r.phone AS renter_phone,
               o.first_name AS owner_first, o.last_name AS owner_last, o.email AS owner_email, o.phone AS owner_phone
        FROM bookings b JOIN listings l ON l.id = b.listing_id JOIN users r ON r.id = b.user_id JOIN users o ON o.id = l.owner_id
        WHERE b.id = ?`).get(claim.booking_id)
    res.json({
        claim: claimWithEvents(claim),
        booking: trustSummary({ ...b, owner_avatar: null, renter_avatar: null }, req.user).booking,
        contacts: {
            owner: { name: `${b.owner_first} ${b.owner_last}`, email: b.owner_email, phone: b.owner_phone },
            renter: { name: `${b.renter_first} ${b.renter_last}`, email: b.renter_email, phone: b.renter_phone }
        },
        photos: listPhotos(b.id),
        otherClaims: db.prepare('SELECT id, status, type, filer_role, created_at FROM claims WHERE booking_id = ? AND id != ?').all(b.id, claim.id)
    })
})

// Move a claim along. status: under_review | resolved | rejected ; amountApproved for resolved
router.put('/claims/:id', (req, res) => {
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id)
    if (!claim) return res.status(404).json({ error: 'Claim not found' })
    const status = req.body?.status
    const note = String(req.body?.note || '').trim().slice(0, 2000)
    if (!['under_review', 'resolved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Unknown status' })
    if (['resolved', 'rejected', 'withdrawn'].includes(claim.status)) return res.status(400).json({ error: 'This claim is already closed.' })
    if (status !== 'under_review' && note.length < 5) return res.status(400).json({ error: 'Explain the decision for both people.' })

    const approved = status === 'resolved' ? money(Math.min(Math.max(Number(req.body?.amountApproved) || 0, 0), claim.amount_requested || 0)) : null
    db.transaction(() => {
        db.prepare(`UPDATE claims SET status = ?, amount_approved = ?, resolution_note = COALESCE(?, resolution_note),
            resolved_by = CASE WHEN ? IN ('resolved','rejected') THEN ? ELSE resolved_by END,
            resolved_at = CASE WHEN ? IN ('resolved','rejected') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(status, approved, note || null, status, req.user.id, status, claim.id)
        const label = { under_review: 'Rentaleze Support is reviewing this claim.', resolved: `Resolved${approved ? ` — $${approved.toFixed(2)} approved` : ''}.`, rejected: 'Claim declined.' }[status]
        addClaimEvent(claim.id, req.user.id, 'admin', 'status', note ? `${label} ${note}` : label)
    })()
    audit(req, `claim_${status}`, 'claim', claim.id, { amountApproved: approved, note })

    // TODO(payments): when Stripe payments land, collect `approved` here —
    // capture from the renter's deposit hold or send a Stripe invoice — and pay it to the filer.
    res.json({ claim: claimWithEvents(db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id)) })
})

router.post('/claims/:id/comment', (req, res) => {
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id)
    if (!claim) return res.status(404).json({ error: 'Claim not found' })
    const body = String(req.body?.body || '').trim()
    if (body.length < 2) return res.status(400).json({ error: 'Write a message first.' })
    addClaimEvent(claim.id, req.user.id, 'admin', 'comment', body)
    db.prepare('UPDATE claims SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(claim.id)
    res.json({ claim: claimWithEvents(db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id)) })
})

// ─── Waitlist ───────────────────────────────────────────────────────────────
router.get('/waitlist', (req, res) => {
    const { limit, offset } = page(req)
    const rows = db.prepare('SELECT email, role, zip, interest, source, created_at FROM waitlist ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset)
    res.json({ total: db.prepare('SELECT COUNT(*) AS n FROM waitlist').get().n, entries: rows })
})

// ─── Audit log ──────────────────────────────────────────────────────────────
router.get('/audit', (req, res) => {
    const rows = db.prepare(`SELECT a.*, u.email AS admin_email FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id
        ORDER BY a.created_at DESC LIMIT 100`).all()
    res.json({ actions: rows })
})

// Health of the integrations (shows which keys are still missing)
router.get('/config', (req, res) => {
    res.json({
        stripeIdentity: !!identityStripe(),
        identityWebhook: !!process.env.STRIPE_IDENTITY_WEBHOOK_SECRET,
        twilioVerify: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID),
        adminEmails: (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean).length
    })
})

export default router
