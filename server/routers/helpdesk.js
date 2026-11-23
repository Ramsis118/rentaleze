// Help desk for customer service workers (role 'support', or admins).
// Tickets, customer / booking lookups, and a few logged actions.
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { requireStaff, isAdmin, isStaff } from '../middleware/auth.js'
import { safeNotify, bookingEvent } from '../services/notify.js'
import { generateLabelsForBooking, voidLabelsForBooking, getShipments } from '../services/shipping.js'
import { sendPasswordReset } from './auth.js'
import { createTicket, toTicket, ticketMessages, CATEGORIES, PRIORITIES, STATUSES } from './support.js'

const router = Router()
router.use(requireStaff)

const clean = (s, max) => String(s ?? '').trim().slice(0, max)
const like = (q) => `%${String(q || '').trim().toLowerCase()}%`
const name = (first, last) => `${first || ''} ${last || ''}`.trim()

// Every action is written to the same activity log the admin panel uses
function audit(req, action, targetType, targetId, detail) {
    db.prepare('INSERT INTO admin_actions (id, admin_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), req.user.id, action, targetType, targetId, detail ? JSON.stringify(detail) : null)
}
const systemNote = (ticketId, authorId, body) =>
    db.prepare(`INSERT INTO ticket_messages (id, ticket_id, author_id, author_role, body, internal) VALUES (?, ?, ?, 'system', ?, 1)`)
        .run(uuidv4(), ticketId, authorId, body)

const requireReason = (req, res) => {
    const reason = clean(req.body?.reason, 300)
    if (reason.length < 5) { res.status(400).json({ error: 'Add a short reason (it goes in the activity log).' }); return null }
    return reason
}

const staffList = () => db.prepare(`SELECT id, email, first_name, last_name, role FROM users WHERE role IN ('admin', 'support') ORDER BY first_name`).all()
    .map(u => ({ id: u.id, email: u.email, name: name(u.first_name, u.last_name), role: u.role }))

// ─── Queue ──────────────────────────────────────────────────────────────────
router.get('/summary', (req, res) => {
    const c = (sql, ...a) => db.prepare(sql).get(...a).n
    res.json({
        open: c(`SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open'`),
        unassigned: c(`SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open' AND assignee_id IS NULL`),
        mine: c(`SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('open', 'pending') AND assignee_id = ?`, req.user.id),
        urgent: c(`SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open' AND priority IN ('urgent', 'high')`),
        pending: c(`SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'pending'`),
        solvedToday: c(`SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('solved', 'closed') AND date(updated_at) = date('now')`),
        oldestOpenAt: db.prepare(`SELECT MIN(created_at) AS t FROM support_tickets WHERE status = 'open'`).get().t,
        staff: staffList(),
        me: { id: req.user.id, isAdmin: isAdmin(req.user) },
        categories: CATEGORIES, priorities: PRIORITIES, statuses: STATUSES
    })
})

const PRIORITY_ORDER = `CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`

router.get('/tickets', (req, res) => {
    const where = [], args = []
    switch (req.query.view || 'open') {
        case 'open': where.push(`t.status = 'open'`); break
        case 'mine': where.push(`t.status IN ('open', 'pending') AND t.assignee_id = ?`); args.push(req.user.id); break
        case 'unassigned': where.push(`t.status = 'open' AND t.assignee_id IS NULL`); break
        case 'pending': where.push(`t.status = 'pending'`); break
        case 'solved': where.push(`t.status IN ('solved', 'closed')`); break
        default: break
    }
    if (PRIORITIES.includes(req.query.priority)) { where.push('t.priority = ?'); args.push(req.query.priority) }
    if (CATEGORIES.includes(req.query.category)) { where.push('t.category = ?'); args.push(req.query.category) }
    if (req.query.q) {
        const q = String(req.query.q).replace(/^#/, '')
        where.push(`(lower(t.subject) LIKE ? OR lower(u.email) LIKE ? OR lower(u.first_name || ' ' || u.last_name) LIKE ? OR CAST(t.number AS TEXT) = ?)`)
        args.push(like(q), like(q), like(q), q)
    }
    const rows = db.prepare(`
        SELECT t.*, u.email AS c_email, u.first_name AS c_first, u.last_name AS c_last, a.first_name AS a_first, a.last_name AS a_last,
               (SELECT body FROM ticket_messages m WHERE m.ticket_id = t.id AND m.internal = 0 ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_body
        FROM support_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assignee_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${req.query.view === 'solved' ? 't.updated_at DESC' : `${PRIORITY_ORDER}, t.updated_at ASC`}
        LIMIT 200`).all(...args)
    res.json(rows.map(t => toTicket(t, {
        customer: { id: t.user_id, email: t.c_email, name: name(t.c_first, t.c_last) },
        assignee: t.assignee_id ? { id: t.assignee_id, name: name(t.a_first, t.a_last) } : null,
        preview: (t.last_body || '').slice(0, 140),
        waitingOnUs: t.status === 'open' && (!t.last_staff_at || (t.last_customer_at && t.last_customer_at > t.last_staff_at))
    })))
})

function ticketDetail(id) {
    const t = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id)
    if (!t) return null
    const assignee = t.assignee_id && db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(t.assignee_id)
    return toTicket(t, {
        messages: ticketMessages(t.id, { includeInternal: true }),
        customer: customerCard(t.user_id),
        booking: t.booking_id ? bookingCard(t.booking_id) : null,
        assignee: assignee ? { id: assignee.id, name: name(assignee.first_name, assignee.last_name) } : null
    })
}

router.get('/tickets/:id', (req, res) => {
    const t = ticketDetail(req.params.id)
    if (!t) return res.status(404).json({ error: 'Ticket not found' })
    res.json(t)
})

// Staff opens a ticket for a customer (phone call, email to support@…)
router.post('/tickets', (req, res) => {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(String(req.body?.userId || ''))
    if (!user) return res.status(400).json({ error: 'Choose a customer.' })
    const subject = clean(req.body?.subject, 140), body = clean(req.body?.body, 5000)
    if (subject.length < 4 || body.length < 5) return res.status(400).json({ error: 'Add a subject and a note.' })
    const ticket = createTicket({
        userId: user.id, subject, body, createdBy: req.user.id, createdByRole: 'staff',
        category: CATEGORIES.includes(req.body?.category) ? req.body.category : 'other',
        priority: PRIORITIES.includes(req.body?.priority) ? req.body.priority : undefined,
        bookingId: req.body?.bookingId || null
    })
    db.prepare('UPDATE support_tickets SET assignee_id = ? WHERE id = ?').run(req.user.id, ticket.id)
    audit(req, 'support_ticket_open', 'ticket', ticket.id, { number: ticket.number })
    res.status(201).json(ticketDetail(ticket.id))
})

// Reply to the customer, or add an internal note
router.post('/tickets/:id/messages', (req, res) => {
    const t = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id)
    if (!t) return res.status(404).json({ error: 'Ticket not found' })
    const body = clean(req.body?.body, 5000)
    if (!body) return res.status(400).json({ error: 'Write a message first.' })
    const internal = !!req.body?.internal
    // After a public reply the ticket waits on the customer unless staff picks another status
    const status = STATUSES.includes(req.body?.status) ? req.body.status : (internal ? t.status : 'pending')

    db.transaction(() => {
        db.prepare(`INSERT INTO ticket_messages (id, ticket_id, author_id, author_role, body, internal) VALUES (?, ?, ?, 'staff', ?, ?)`)
            .run(uuidv4(), t.id, req.user.id, body, internal ? 1 : 0)
        db.prepare(`UPDATE support_tickets SET status = ?, assignee_id = COALESCE(assignee_id, ?),
                first_response_at = CASE WHEN ? = 0 THEN COALESCE(first_response_at, CURRENT_TIMESTAMP) ELSE first_response_at END,
                last_staff_at = CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE last_staff_at END, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`).run(status, req.user.id, internal ? 1 : 0, internal ? 1 : 0, t.id)
    })()
    if (!internal) {
        safeNotify(t.user_id, status === 'solved' ? 'ticket_solved' : 'ticket_reply', t, { args: { preview: body.slice(0, 280) } })
    }
    res.status(201).json(ticketDetail(t.id))
})

// Status, priority, category, assignee
router.put('/tickets/:id', (req, res) => {
    const t = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id)
    if (!t) return res.status(404).json({ error: 'Ticket not found' })
    const sets = [], vals = [], notes = []
    const { status, priority, category } = req.body || {}
    if (status && status !== t.status) {
        if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
        sets.push('status = ?'); vals.push(status); notes.push(`Status: ${t.status} → ${status}`)
    }
    if (priority && priority !== t.priority) {
        if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' })
        sets.push('priority = ?'); vals.push(priority); notes.push(`Priority: ${t.priority} → ${priority}`)
    }
    if (category && category !== t.category) {
        if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' })
        sets.push('category = ?'); vals.push(category); notes.push(`Category: ${t.category} → ${category}`)
    }
    let newAssignee
    if (req.body && 'assigneeId' in req.body && (req.body.assigneeId || null) !== t.assignee_id) {
        newAssignee = req.body.assigneeId || null
        if (newAssignee) {
            const a = db.prepare('SELECT id, email, role, first_name FROM users WHERE id = ?').get(newAssignee)
            if (!a || !isStaff(a)) return res.status(400).json({ error: 'You can only assign to support staff.' })
            notes.push(`Assigned to ${a.first_name}`)
        } else notes.push('Unassigned')
        sets.push('assignee_id = ?'); vals.push(newAssignee)
    }
    if (!sets.length) return res.json(ticketDetail(t.id))

    db.prepare(`UPDATE support_tickets SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, t.id)
    systemNote(t.id, req.user.id, `${notes.join(' · ')} (by ${req.user.first_name})`)
    if (newAssignee && newAssignee !== req.user.id) safeNotify(newAssignee, 'ticket_assigned', t)
    if (status === 'solved') safeNotify(t.user_id, 'ticket_solved', t)
    res.json(ticketDetail(t.id))
})

// ─── Lookups ────────────────────────────────────────────────────────────────
function customerCard(userId) {
    const u = db.prepare(`SELECT id, email, first_name, last_name, phone, phone_verified, is_verified, id_status, role, suspended,
        suspended_reason, created_at, notify_email, notify_sms FROM users WHERE id = ?`).get(userId)
    if (!u) return null
    const c = (sql) => db.prepare(sql).get(userId).n
    return {
        id: u.id, email: u.email, name: name(u.first_name, u.last_name), phone: u.phone, phoneVerified: u.phone_verified === 1,
        idVerified: u.is_verified === 1, idStatus: u.is_verified === 1 ? 'verified' : (u.id_status || 'none'), role: u.role,
        suspended: !!u.suspended, suspendedReason: u.suspended_reason, createdAt: u.created_at,
        emailsOn: u.notify_email !== 0, textsOn: u.notify_sms !== 0,
        counts: {
            rentals: c('SELECT COUNT(*) AS n FROM bookings WHERE user_id = ?'),
            hosted: c('SELECT COUNT(*) AS n FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE l.owner_id = ?'),
            listings: c(`SELECT COUNT(*) AS n FROM listings WHERE owner_id = ? AND status != 'deleted'`),
            tickets: c('SELECT COUNT(*) AS n FROM support_tickets WHERE user_id = ?')
        }
    }
}

const BOOKING_SELECT = `
    SELECT b.*, l.title, l.owner_id, r.first_name AS r_first, r.last_name AS r_last, r.email AS r_email,
           o.first_name AS o_first, o.last_name AS o_last, o.email AS o_email
    FROM bookings b JOIN listings l ON l.id = b.listing_id JOIN users r ON r.id = b.user_id JOIN users o ON o.id = l.owner_id`

const toBookingSummary = (b) => ({
    id: b.id, title: b.title, status: b.status, fulfillment: b.fulfillment, startDate: b.start_date, endDate: b.end_date,
    total: b.total, shippingFee: b.shipping_fee, createdAt: b.created_at,
    renter: { id: b.user_id, name: name(b.r_first, b.r_last), email: b.r_email },
    owner: { id: b.owner_id, name: name(b.o_first, b.o_last), email: b.o_email }
})

function bookingCard(bookingId) {
    const b = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(bookingId)
    if (!b) return null
    return {
        ...toBookingSummary(b),
        days: b.days, baseTotal: b.base_total, serviceFee: b.service_fee, ownerNote: b.owner_note, cancelledBy: b.cancelled_by,
        pickedUpAt: b.picked_up_at, returnedAt: b.returned_at, updatedAt: b.updated_at, listingId: b.listing_id,
        shippingAddress: b.fulfillment === 'shipping'
            ? { name: b.shipping_name, line1: b.shipping_address, city: b.shipping_city, state: b.shipping_state, zip: b.shipping_zip }
            : null,
        shipments: b.fulfillment === 'shipping' ? getShipments(b.id, 'owner') : [],
        canCancel: ['requested', 'accepted', 'active'].includes(b.status)
    }
}

// One search box: people, bookings, tickets, tracking numbers
router.get('/search', (req, res) => {
    const q = clean(req.query.q, 100)
    if (q.length < 2) return res.json({ users: [], bookings: [], tickets: [] })
    const digits = q.replace(/\D/g, '')
    const users = db.prepare(`
        SELECT id, email, first_name, last_name, phone, suspended FROM users
        WHERE COALESCE(is_demo, 0) = 0 AND (lower(email) LIKE ? OR lower(first_name || ' ' || last_name) LIKE ? ${digits.length >= 4 ? 'OR phone LIKE ?' : ''})
        ORDER BY created_at DESC LIMIT 10`).all(like(q), like(q), ...(digits.length >= 4 ? [`%${digits}%`] : []))
        .map(u => ({ id: u.id, email: u.email, name: name(u.first_name, u.last_name), phone: u.phone, suspended: !!u.suspended }))
    const bookings = db.prepare(`${BOOKING_SELECT}
        WHERE b.id LIKE ? OR lower(l.title) LIKE ? OR b.id IN (SELECT booking_id FROM shipments WHERE tracking_number = ?)
        ORDER BY b.created_at DESC LIMIT 10`).all(`${q}%`, like(q), q).map(toBookingSummary)
    const num = q.replace(/^#/, '')
    const tickets = db.prepare(`SELECT * FROM support_tickets WHERE CAST(number AS TEXT) = ? OR lower(subject) LIKE ? ORDER BY updated_at DESC LIMIT 10`)
        .all(num, like(q)).map(t => toTicket(t))
    res.json({ users, bookings, tickets })
})

router.get('/customers/:id', (req, res) => {
    const card = customerCard(req.params.id)
    if (!card) return res.status(404).json({ error: 'Customer not found' })
    const id = card.id
    res.json({
        ...card,
        bookings: db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? OR l.owner_id = ? ORDER BY b.created_at DESC LIMIT 30`).all(id, id)
            .map(b => ({ ...toBookingSummary(b), as: b.user_id === id ? 'renter' : 'owner' })),
        listings: db.prepare(`SELECT id, title, status, price_per_day, shipping, created_at FROM listings WHERE owner_id = ? AND status != 'deleted' ORDER BY created_at DESC LIMIT 30`).all(id)
            .map(l => ({ id: l.id, title: l.title, status: l.status, pricePerDay: l.price_per_day, shipping: !!l.shipping, createdAt: l.created_at })),
        tickets: db.prepare(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30`).all(id).map(t => toTicket(t)),
        deliveries: db.prepare(`SELECT type, channel, destination, status, error, created_at FROM notification_deliveries WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 40`).all(id)
            .map(d => ({ type: d.type, channel: d.channel, destination: d.destination, status: d.status, error: d.error, createdAt: d.created_at })),
        notifications: db.prepare(`SELECT type, title, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20`).all(id)
            .map(n => ({ type: n.type, title: n.title, read: !!n.read_at, createdAt: n.created_at })),
        activity: db.prepare(`SELECT a.action, a.detail, a.created_at, u.first_name FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id
            WHERE a.target_id = ? ORDER BY a.created_at DESC LIMIT 20`).all(id)
            .map(a => ({ action: a.action, detail: a.detail ? JSON.parse(a.detail) : null, by: a.first_name, createdAt: a.created_at }))
    })
})

router.get('/bookings/:id', (req, res) => {
    const card = bookingCard(req.params.id)
    if (!card) return res.status(404).json({ error: 'Booking not found' })
    res.json({
        ...card,
        tickets: db.prepare(`SELECT * FROM support_tickets WHERE booking_id = ? ORDER BY created_at DESC`).all(card.id).map(t => toTicket(t)),
        activity: db.prepare(`SELECT a.action, a.detail, a.created_at, u.first_name FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id
            WHERE a.target_id = ? ORDER BY a.created_at DESC LIMIT 20`).all(card.id)
            .map(a => ({ action: a.action, detail: a.detail ? JSON.parse(a.detail) : null, by: a.first_name, createdAt: a.created_at }))
    })
})

// ─── Actions (reason required, all logged) ─────────────────────────────────
const noteOnTickets = (bookingId, userId, text) => {
    for (const t of db.prepare(`SELECT id FROM support_tickets WHERE booking_id = ? AND status IN ('open', 'pending')`).all(bookingId)) systemNote(t.id, userId, text)
}

router.post('/bookings/:id/cancel', async (req, res) => {
    const reason = requireReason(req, res); if (!reason) return
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    if (!['requested', 'accepted', 'active'].includes(b.status)) return res.status(400).json({ error: `A ${b.status} booking can’t be cancelled.` })
    const r = db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_by = 'support', owner_note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = ?`).run(`Cancelled by Rentaleze support: ${reason}`, b.id, b.status)
    if (!r.changes) return res.status(409).json({ error: 'The booking just changed. Refresh and try again.' })
    if (b.fulfillment === 'shipping') await voidLabelsForBooking(b.id).catch(err => console.error('Void error:', err))
    audit(req, 'support_cancel_booking', 'booking', b.id, { reason, from: b.status })
    noteOnTickets(b.id, req.user.id, `Booking cancelled by ${req.user.first_name}: ${reason}`)
    bookingEvent(b.id, 'cancel', { bySupport: true, reason })
    res.json(bookingCard(b.id))
})

router.post('/bookings/:id/labels/retry', async (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    if (b.fulfillment !== 'shipping' || !['accepted', 'active'].includes(b.status)) return res.status(400).json({ error: 'Labels are only for confirmed shipped rentals.' })
    await generateLabelsForBooking(b.id)
    audit(req, 'support_retry_labels', 'booking', b.id, null)
    res.json(bookingCard(b.id))
})

router.post('/bookings/:id/labels/void', async (req, res) => {
    const reason = requireReason(req, res); if (!reason) return
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    await voidLabelsForBooking(b.id)
    audit(req, 'support_void_labels', 'booking', b.id, { reason })
    noteOnTickets(b.id, req.user.id, `Shipping labels voided by ${req.user.first_name}: ${reason}`)
    res.json(bookingCard(b.id))
})

router.post('/customers/:id/suspend', (req, res) => {
    const reason = requireReason(req, res); if (!reason) return
    const u = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id)
    if (!u) return res.status(404).json({ error: 'Customer not found' })
    if (u.id === req.user.id) return res.status(400).json({ error: "You can't suspend yourself." })
    if (isStaff(u) && !isAdmin(req.user)) return res.status(403).json({ error: 'Only an admin can suspend staff accounts.' })
    const suspended = req.body?.suspended !== false
    db.transaction(() => {
        db.prepare('UPDATE users SET suspended = ?, suspended_reason = ? WHERE id = ?').run(suspended ? 1 : 0, suspended ? reason : null, u.id)
        if (suspended) {
            db.prepare(`UPDATE listings SET status = 'paused', moderation_note = 'Paused while the account is under review' WHERE owner_id = ? AND status = 'active'`).run(u.id)
            db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id)
        }
    })()
    audit(req, suspended ? 'support_suspend_user' : 'support_reinstate_user', 'user', u.id, { reason })
    safeNotify(u.id, suspended ? 'account_suspended' : 'account_reinstated', { reason })
    res.json(customerCard(u.id))
})

router.post('/customers/:id/password-reset', (req, res) => {
    const u = db.prepare('SELECT id FROM users WHERE id = ? AND COALESCE(is_demo, 0) = 0').get(req.params.id)
    if (!u) return res.status(404).json({ error: 'Customer not found' })
    sendPasswordReset(u.id)
    audit(req, 'support_send_password_reset', 'user', u.id, null)
    res.json({ ok: true, message: 'Reset link emailed to the customer.' })
})

router.post('/customers/:id/verification-reminder', (req, res) => {
    const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!u) return res.status(404).json({ error: 'Customer not found' })
    safeNotify(u.id, 'verification_reminder')
    audit(req, 'support_send_verification_reminder', 'user', u.id, null)
    res.json({ ok: true, message: 'Verification reminder sent.' })
})

// ─── Staff management (admins only) ─────────────────────────────────────────
const adminOnly = (req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ error: 'Admins only' }))

router.get('/staff', (req, res) => res.json(staffList()))

router.post('/staff', adminOnly, (req, res) => {
    const email = clean(req.body?.email, 200).toLowerCase()
    const u = db.prepare('SELECT id, role FROM users WHERE lower(email) = ?').get(email)
    if (!u) return res.status(404).json({ error: 'No account with that email. They need to sign up first.' })
    if (u.role === 'admin') return res.status(400).json({ error: 'That person is already an admin.' })
    db.prepare(`UPDATE users SET role = 'support' WHERE id = ?`).run(u.id)
    audit(req, 'support_grant', 'user', u.id, { email })
    res.status(201).json(staffList())
})

router.delete('/staff/:id', adminOnly, (req, res) => {
    const u = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id)
    if (!u || u.role !== 'support') return res.status(404).json({ error: 'Not a support agent' })
    db.prepare(`UPDATE users SET role = 'both' WHERE id = ?`).run(u.id)
    db.prepare(`UPDATE support_tickets SET assignee_id = NULL WHERE assignee_id = ? AND status IN ('open', 'pending')`).run(u.id)
    audit(req, 'support_revoke', 'user', u.id, null)
    res.json(staffList())
})

// Recent help desk activity
router.get('/activity', (req, res) => {
    const rows = db.prepare(`SELECT a.*, u.first_name, u.email FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id
        WHERE a.action LIKE 'support_%' ORDER BY a.created_at DESC, a.rowid DESC LIMIT 100`).all()
    res.json(rows.map(a => ({ action: a.action, targetType: a.target_type, targetId: a.target_id, detail: a.detail ? JSON.parse(a.detail) : null, by: a.first_name || a.email, createdAt: a.created_at })))
})

export default router
