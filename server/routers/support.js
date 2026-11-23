// Customer side of the help desk: open a ticket, see my tickets, reply.
// Suspended accounts can use these routes (see middleware/auth.js).
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import rateLimit from 'express-rate-limit'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import { safeNotify } from '../services/notify.js'

const router = Router()

export const CATEGORIES = ['booking', 'shipping', 'payment', 'account', 'listing', 'damage', 'other']
export const PRIORITIES = ['low', 'normal', 'high', 'urgent']
export const STATUSES = ['open', 'pending', 'solved', 'closed']
const REOPEN_DAYS = 7

const ticketLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 10,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { error: 'You’ve opened a lot of tickets this hour. Reply on an existing one, or try again later.' }
})

const clean = (s, max) => String(s ?? '').trim().slice(0, max)

// Damage or safety problems on an active rental jump the queue
function guessPriority(category, bookingId) {
    if (category === 'damage') return 'high'
    if (bookingId) {
        const b = db.prepare('SELECT status FROM bookings WHERE id = ?').get(bookingId)
        if (b && ['accepted', 'active'].includes(b.status)) return 'high'
    }
    return 'normal'
}

// Shared by the customer form and staff "open on behalf of"
export function createTicket({ userId, subject, category, body, bookingId, priority, createdBy, createdByRole = 'customer' }) {
    const id = uuidv4()
    db.transaction(() => {
        const number = (db.prepare('SELECT MAX(number) AS n FROM support_tickets').get().n || 1000) + 1
        db.prepare(`INSERT INTO support_tickets (id, number, user_id, subject, category, status, priority, booking_id, last_customer_at, last_staff_at)
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`)
            .run(id, number, userId, subject, category, priority || guessPriority(category, bookingId), bookingId || null,
                createdByRole === 'customer' ? new Date().toISOString() : null, createdByRole === 'staff' ? new Date().toISOString() : null)
        db.prepare(`INSERT INTO ticket_messages (id, ticket_id, author_id, author_role, body) VALUES (?, ?, ?, ?, ?)`)
            .run(uuidv4(), id, createdBy || userId, createdByRole, body)
    })()
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id)
    safeNotify(userId, 'ticket_received', ticket)
    return ticket
}

export function toTicket(t, extra = {}) {
    return {
        id: t.id, number: t.number, subject: t.subject, category: t.category, status: t.status, priority: t.priority,
        bookingId: t.booking_id, assigneeId: t.assignee_id, createdAt: t.created_at, updatedAt: t.updated_at,
        lastCustomerAt: t.last_customer_at, lastStaffAt: t.last_staff_at, firstResponseAt: t.first_response_at, ...extra
    }
}

const toMessage = (m) => ({
    id: m.id, body: m.body, authorRole: m.author_role, internal: !!m.internal, createdAt: m.created_at,
    authorName: m.author_role === 'staff' ? `${m.first_name || 'Support'} · Rentaleze Support` : m.author_role === 'system' ? 'Rentaleze' : `${m.first_name || ''} ${m.last_name?.[0] || ''}.`.trim()
})

export const ticketMessages = (ticketId, { includeInternal = false } = {}) => db.prepare(`
    SELECT m.*, u.first_name, u.last_name FROM ticket_messages m LEFT JOIN users u ON u.id = m.author_id
    WHERE m.ticket_id = ? ${includeInternal ? '' : 'AND m.internal = 0'} ORDER BY m.created_at, m.rowid`).all(ticketId).map(toMessage)

const myTicket = (req) => db.prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)

// ─── Routes ─────────────────────────────────────────────────────────────────
router.get('/tickets', authenticate, (req, res) => {
    const rows = db.prepare(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC`).all(req.user.id)
    res.json(rows.map(t => toTicket(t, {
        awaitingYou: t.status === 'pending'
    })))
})

router.post('/tickets', authenticate, ticketLimiter, (req, res) => {
    const subject = clean(req.body?.subject, 140)
    const body = clean(req.body?.body, 5000)
    const category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'other'
    const bookingId = req.body?.bookingId ? String(req.body.bookingId) : null
    if (subject.length < 4) return res.status(400).json({ error: 'Add a short subject (at least 4 characters).' })
    if (body.length < 10) return res.status(400).json({ error: 'Tell us a little more about the problem.' })
    if (bookingId) {
        const b = db.prepare('SELECT b.user_id, l.owner_id FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.id = ?').get(bookingId)
        if (!b || (b.user_id !== req.user.id && b.owner_id !== req.user.id)) return res.status(400).json({ error: 'That booking isn’t one of yours.' })
    }
    const ticket = createTicket({ userId: req.user.id, subject, category, body, bookingId })
    res.status(201).json(toTicket(ticket, { messages: ticketMessages(ticket.id) }))
})

router.get('/tickets/:id', authenticate, (req, res) => {
    const t = myTicket(req)
    if (!t) return res.status(404).json({ error: 'Ticket not found' })
    res.json(toTicket(t, { messages: ticketMessages(t.id) }))
})

router.post('/tickets/:id/messages', authenticate, (req, res) => {
    const t = myTicket(req)
    if (!t) return res.status(404).json({ error: 'Ticket not found' })
    const body = clean(req.body?.body, 5000)
    if (!body) return res.status(400).json({ error: 'Write a message first.' })
    const tooOld = t.status === 'closed' ||
        (t.status === 'solved' && Date.parse(`${t.updated_at.replace(' ', 'T')}Z`) < Date.now() - REOPEN_DAYS * 864e5)
    if (tooOld) return res.status(400).json({ error: 'This ticket is closed. Please open a new one.' })

    db.prepare(`INSERT INTO ticket_messages (id, ticket_id, author_id, author_role, body) VALUES (?, ?, ?, 'customer', ?)`)
        .run(uuidv4(), t.id, req.user.id, body)
    db.prepare(`UPDATE support_tickets SET status = 'open', last_customer_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(t.id)
    if (t.assignee_id) safeNotify(t.assignee_id, 'ticket_customer_reply', t)
    const fresh = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(t.id)
    res.status(201).json(toTicket(fresh, { messages: ticketMessages(t.id) }))
})

// Customer says it's sorted
router.post('/tickets/:id/solve', authenticate, (req, res) => {
    const t = myTicket(req)
    if (!t) return res.status(404).json({ error: 'Ticket not found' })
    if (!['solved', 'closed'].includes(t.status)) {
        db.prepare(`UPDATE support_tickets SET status = 'solved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(t.id)
        db.prepare(`INSERT INTO ticket_messages (id, ticket_id, author_id, author_role, body, internal) VALUES (?, ?, ?, 'system', ?, 1)`)
            .run(uuidv4(), t.id, req.user.id, 'Customer marked this solved.')
    }
    const fresh = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(t.id)
    res.json(toTicket(fresh, { messages: ticketMessages(t.id) }))
})

export default router
