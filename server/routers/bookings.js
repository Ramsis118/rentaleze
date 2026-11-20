import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import {
    quoteShipping, validateAddress, generateLabelsForBooking, voidLabelsForBooking, getShipments
} from '../services/shipping.js'

const router = Router()

// ─── Booking lifecycle ──────────────────────────────────────────────────────
//   requested ──accept──▶ accepted ──pickup──▶ active ──return──▶ completed
//       │                    │
//       ├──decline──▶ declined
//       └──cancel───▶ cancelled ◀──cancel── (before pickup)
//
// Instant Book listings skip "requested" and start as "accepted".
// Dates are YYYY-MM-DD. start = pickup day, end = return day; days = end - start.
//
// Shipped rentals: the renter pays a round-trip shipping price estimated from the
// item's packed size. Once the booking is accepted, Rentaleze buys a send label and
// a return label through ShipStation (services/shipping.js). Cancelling voids them.

const RENTER_SERVICE_FEE = 0.12   // platform fee charged to the renter
const MAX_DAYS = 90
const BLOCKING = ['accepted', 'active']   // statuses that hold the item's calendar

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const toDay = (s) => Date.parse(`${s}T00:00:00Z`)
const todayUTC = () => new Date().toISOString().slice(0, 10)
const money = (n) => Math.round(n * 100) / 100

function validateDates(startDate, endDate) {
    if (!DATE_RE.test(startDate || '') || !DATE_RE.test(endDate || '')) return { error: 'Choose a start and end date.' }
    const start = toDay(startDate), end = toDay(endDate)
    if (Number.isNaN(start) || Number.isNaN(end)) return { error: 'Those dates are not valid.' }
    // Allow "today" in any US time zone (server runs on UTC)
    if (start < toDay(todayUTC()) - 86400000) return { error: 'The start date is in the past.' }
    const days = Math.round((end - start) / 86400000)
    if (days < 1) return { error: 'The end date must be after the start date.' }
    if (days > MAX_DAYS) return { error: `Rentals can be at most ${MAX_DAYS} days.` }
    return { days }
}

// Does this listing already have an accepted/active booking overlapping these dates?
function hasConflict(listingId, startDate, endDate, ignoreBookingId = '') {
    return !!db.prepare(`
        SELECT 1 FROM bookings
        WHERE listing_id = ? AND id != ? AND status IN (${BLOCKING.map(() => '?').join(',')})
          AND start_date < ? AND end_date > ?
        LIMIT 1
    `).get(listingId, ignoreBookingId, ...BLOCKING, endDate, startDate)
}

const BOOKING_SELECT = `
    SELECT b.*, l.title, l.image, l.location, l.owner_id, l.owner_name, l.owner_avatar,
           r.first_name AS renter_first_name, r.last_name AS renter_last_name, r.avatar AS renter_avatar,
           o.first_name AS owner_first_name, o.last_name AS owner_last_name
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users r ON r.id = b.user_id
    JOIN users o ON o.id = l.owner_id
`

function toBooking(row, viewerId) {
    const role = row.owner_id === viewerId ? 'owner' : 'renter'
    const isDemo = row.owner_id?.startsWith('demo-')
    return {
        id: row.id,
        listingId: row.listing_id,
        title: row.title,
        image: row.image,
        location: row.location,
        startDate: row.start_date,
        endDate: row.end_date,
        days: row.days,
        qty: row.qty,
        baseTotal: row.base_total,
        serviceFee: row.service_fee,
        shippingFee: row.shipping_fee,
        shippingEstimated: !!row.shipping_estimated,
        total: row.total,
        fulfillment: row.fulfillment,
        shipments: row.fulfillment === 'shipping' ? getShipments(row.id, role) : [],
        status: row.status === 'pending' ? 'requested' : row.status,
        intendedUse: row.intended_use,
        ownerNote: row.owner_note || null,
        cancelledBy: row.cancelled_by || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
        role,
        ownerName: isDemo ? row.owner_name : `${row.owner_first_name} ${row.owner_last_name?.[0] || ''}.`,
        renterName: `${row.renter_first_name} ${row.renter_last_name?.[0] || ''}.`,
        renterAvatar: row.renter_avatar || null,
        renterId: row.user_id,
        ownerId: row.owner_id,
        actions: allowedActions(row, viewerId),
        pickedUpAt: row.picked_up_at || null,
        returnedAt: row.returned_at || null,
        // Trust: shown as badges on the bookings list
        openClaims: db.prepare(`SELECT COUNT(*) AS n FROM claims WHERE booking_id = ? AND status IN ('open','under_review')`).get(row.id).n,
        reviewed: !!db.prepare('SELECT 1 FROM reviews WHERE booking_id = ? AND user_id = ?').get(row.id, viewerId)
    }
}

// Which buttons each side may press right now
function allowedActions(row, viewerId) {
    const isOwner = row.owner_id === viewerId
    const isRenter = row.user_id === viewerId
    const status = row.status === 'pending' ? 'requested' : row.status
    const started = todayUTC() >= row.start_date
    const out = []
    if (isOwner && status === 'requested') out.push('accept', 'decline')
    if ((isOwner || isRenter) && (status === 'requested' || (status === 'accepted' && !started))) out.push('cancel')
    if (isOwner && status === 'accepted') out.push('pickup')
    if (isOwner && status === 'active') out.push('return')
    return out
}

const getBookingRow = (id) => db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id)

// ─── Routes ─────────────────────────────────────────────────────────────────

// Create a booking request (or an instant booking)
router.post('/', authenticate, async (req, res) => {
    try {
        const { listingId, startDate, endDate, qty, fulfillment, intendedUse, shippingName, shippingPhone, shippingAddress, shippingCity, shippingState, shippingZip } = req.body || {}
        if (!listingId) return res.status(400).json({ error: 'Missing listing.' })

        const userStatus = db.prepare('SELECT is_verified, phone_verified FROM users WHERE id = ?').get(req.user.id)
        if (!userStatus.is_verified || !userStatus.phone_verified) {
            return res.status(403).json({ error: 'You must complete ID and Phone Verification before renting items.' })
        }

        const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId)
        if (!listing || listing.status !== 'active') return res.status(404).json({ error: 'Listing not found' })
        if (listing.owner_id === req.user.id) return res.status(400).json({ error: "You can't book your own item." })

        const { error, days } = validateDates(startDate, endDate)
        if (error) return res.status(400).json({ error })

        if (hasConflict(listing.id, startDate, endDate)) {
            return res.status(409).json({ error: 'Those dates are already booked. Please choose different dates.' })
        }

        // One open request per renter per item at a time
        const open = db.prepare(`
            SELECT 1 FROM bookings WHERE listing_id = ? AND user_id = ? AND status IN ('requested','pending') AND start_date < ? AND end_date > ?
        `).get(listing.id, req.user.id, endDate, startDate)
        if (open) return res.status(409).json({ error: 'You already have a request for these dates.' })

        const quantity = Math.min(Math.max(parseInt(qty, 10) || 1, 1), 20)
        if (fulfillment === 'shipping' && !listing.shipping) return res.status(400).json({ error: 'This item is pickup only.' })
        const ship = fulfillment === 'shipping' ? 'shipping' : 'pickup'

        // Shipped rentals need a full delivery address (also used as the return label's sender)
        let shipTo = null
        let quote = { fee: 0, estimated: false }
        if (ship === 'shipping') {
            const renter = db.prepare('SELECT first_name, last_name, phone FROM users WHERE id = ?').get(req.user.id)
            const addr = validateAddress({
                name: shippingName || `${renter.first_name} ${renter.last_name}`,
                phone: shippingPhone || renter.phone,
                line1: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip
            }, 'Delivery address')
            if (addr.errors.length) return res.status(400).json({ error: addr.errors[0], errors: addr.errors })
            shipTo = addr.data
            quote = await quoteShipping(listing, shipTo)
        }

        const baseTotal = money(days * listing.price_per_day * quantity)
        const serviceFee = money(baseTotal * RENTER_SERVICE_FEE)
        const shippingFee = money(quote.fee)
        const total = money(baseTotal + serviceFee + shippingFee)
        const status = listing.instant_book ? 'accepted' : 'requested'

        // Dates may have been taken while the shipping quote was loading
        if (hasConflict(listing.id, startDate, endDate)) {
            return res.status(409).json({ error: 'Those dates are already booked. Please choose different dates.' })
        }

        const bookingId = uuidv4()
        db.prepare(`
            INSERT INTO bookings (id, listing_id, user_id, start_date, end_date, days, qty, fulfillment, base_total, insurance,
                service_fee, shipping_fee, total, status, intended_use, shipping_name, shipping_phone, shipping_address,
                shipping_city, shipping_state, shipping_zip, shipping_estimated, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(bookingId, listing.id, req.user.id, startDate, endDate, days, quantity, ship, baseTotal, serviceFee, shippingFee,
            total, status, String(intendedUse || '').slice(0, 500), shipTo?.name || null, shipTo?.phone || null,
            shipTo?.line1 || '', shipTo?.city || '', shipTo?.state || '', shipTo?.zip || '', quote.estimated ? 1 : 0)

        // Instant Book + shipping: buy the send and return labels right away
        if (ship === 'shipping' && status === 'accepted') {
            await generateLabelsForBooking(bookingId).catch(err => console.error('Label generation error:', err))
        }

        res.status(201).json(toBooking(getBookingRow(bookingId), req.user.id))
    } catch (error) {
        console.error('Create booking error:', error)
        res.status(500).json({ error: 'Failed to create booking' })
    }
})

// Bookings I made (as renter)
router.get('/my', authenticate, (req, res) => {
    try {
        const rows = db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.start_date DESC, b.created_at DESC`).all(req.user.id)
        res.json(rows.map(r => toBooking(r, req.user.id)))
    } catch (error) {
        console.error('Get bookings error:', error)
        res.status(500).json({ error: 'Failed to fetch bookings' })
    }
})

// Bookings on my items (as owner)
router.get('/rentals', authenticate, (req, res) => {
    try {
        const rows = db.prepare(`${BOOKING_SELECT} WHERE l.owner_id = ? ORDER BY
            CASE WHEN b.status IN ('requested','pending') THEN 0 ELSE 1 END, b.start_date DESC`).all(req.user.id)
        res.json(rows.map(r => toBooking(r, req.user.id)))
    } catch (error) {
        console.error('Get rentals error:', error)
        res.status(500).json({ error: 'Failed to fetch rentals' })
    }
})

// One booking (renter or owner only)
router.get('/:id', authenticate, (req, res) => {
    try {
        const row = getBookingRow(req.params.id)
        if (!row) return res.status(404).json({ error: 'Booking not found' })
        if (row.user_id !== req.user.id && row.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
        res.json(toBooking(row, req.user.id))
    } catch (error) {
        console.error('Get booking error:', error)
        res.status(500).json({ error: 'Failed to fetch booking' })
    }
})

// Status changes: accept | decline | cancel | pickup | return
const TRANSITIONS = {
    accept: 'accepted',
    decline: 'declined',
    cancel: 'cancelled',
    pickup: 'active',
    return: 'completed'
}

router.put('/:id/:action', authenticate, async (req, res) => {
    try {
        const { action } = req.params
        if (!TRANSITIONS[action]) return res.status(404).json({ error: 'Not found' })

        const row = getBookingRow(req.params.id)
        if (!row) return res.status(404).json({ error: 'Booking not found' })
        if (row.user_id !== req.user.id && row.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })

        if (!allowedActions(row, req.user.id).includes(action)) {
            return res.status(400).json({ error: `This booking can't be ${TRANSITIONS[action]} right now.` })
        }
        if (action === 'accept' && hasConflict(row.listing_id, row.start_date, row.end_date, row.id)) {
            return res.status(409).json({ error: 'You already accepted another booking for these dates.' })
        }

        const note = String(req.body?.note || '').trim().slice(0, 300) || null
        const cancelledBy = action === 'cancel' ? (row.owner_id === req.user.id ? 'owner' : 'renter') : row.cancelled_by

        // Guard against two clicks racing: only update if the status is still what we checked
        const result = db.prepare(`
            UPDATE bookings SET status = ?, cancelled_by = ?, owner_note = COALESCE(?, owner_note), updated_at = CURRENT_TIMESTAMP,
                picked_up_at = CASE WHEN ? = 'active' THEN CURRENT_TIMESTAMP ELSE picked_up_at END,
                returned_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE returned_at END
            WHERE id = ? AND status = ?
        `).run(TRANSITIONS[action], cancelledBy, note, TRANSITIONS[action], TRANSITIONS[action], row.id, row.status)
        if (result.changes === 0) return res.status(409).json({ error: 'This booking was just updated. Please refresh.' })

        // Shipping labels follow the booking: buy on accept, void on cancel/decline
        if (row.fulfillment === 'shipping') {
            if (action === 'accept') {
                await generateLabelsForBooking(row.id).catch(err => console.error('Label generation error:', err))
            } else if (action === 'cancel' || action === 'decline') {
                await voidLabelsForBooking(row.id).catch(err => console.error('Label void error:', err))
            }
        }

        res.json(toBooking(getBookingRow(row.id), req.user.id))
    } catch (error) {
        console.error('Booking action error:', error)
        res.status(500).json({ error: 'Failed to update booking' })
    }
})

export default router
