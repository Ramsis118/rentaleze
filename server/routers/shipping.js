import { Router } from 'express'
import { timingSafeEqual } from 'crypto'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import { shipstationMode } from '../services/shipstation.js'
import {
    quoteShipping, generateLabelsForBooking, getShipments, refreshTracking, applyTrackingUpdate
} from '../services/shipping.js'

const router = Router()

// Shipping status (lets the UI say whether rates are live)
router.get('/status', (req, res) => {
    res.json({ provider: 'shipstation', mode: shipstationMode() })
})

// Round-trip shipping quote for a listing to a ZIP code
router.get('/quote', async (req, res) => {
    try {
        const listing = db.prepare(`SELECT * FROM listings WHERE id = ? AND status = 'active'`).get(String(req.query.listingId || ''))
        if (!listing) return res.status(404).json({ error: 'Listing not found' })
        if (!listing.shipping) return res.status(400).json({ error: 'This item is pickup only.' })
        const to = {
            zip: String(req.query.zip || '').trim().slice(0, 5),
            city: String(req.query.city || '').trim().slice(0, 60),
            state: String(req.query.state || '').trim().slice(0, 2).toUpperCase()
        }
        res.json(await quoteShipping(listing, to))
    } catch (error) {
        console.error('Shipping quote error:', error)
        res.status(500).json({ error: 'Failed to get a shipping quote' })
    }
})

const bookingParty = (id, userId) => {
    const row = db.prepare(`SELECT b.id, b.user_id, b.status, b.fulfillment, l.owner_id FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.id = ?`).get(id)
    if (!row) return { error: [404, 'Booking not found'] }
    const role = row.owner_id === userId ? 'owner' : row.user_id === userId ? 'renter' : null
    if (!role) return { error: [403, 'Not authorized'] }
    return { row, role }
}

// Labels + tracking for one booking
router.get('/bookings/:id', authenticate, async (req, res) => {
    try {
        const { row, role, error } = bookingParty(req.params.id, req.user.id)
        if (error) return res.status(error[0]).json({ error: error[1] })
        await refreshTracking(row.id)
        res.json({ shipments: getShipments(row.id, role) })
    } catch (error) {
        console.error('Get shipments error:', error)
        res.status(500).json({ error: 'Failed to load shipping' })
    }
})

// Owner retries label creation (e.g. after fixing the package size or address)
router.post('/bookings/:id/labels', authenticate, async (req, res) => {
    try {
        const { row, role, error } = bookingParty(req.params.id, req.user.id)
        if (error) return res.status(error[0]).json({ error: error[1] })
        if (role !== 'owner') return res.status(403).json({ error: 'Only the owner can create labels.' })
        if (row.fulfillment !== 'shipping') return res.status(400).json({ error: 'This booking is pickup, not shipping.' })
        if (!['accepted', 'active'].includes(row.status)) return res.status(400).json({ error: 'Labels are created once the booking is confirmed.' })
        await generateLabelsForBooking(row.id)
        res.json({ shipments: getShipments(row.id, 'owner') })
    } catch (error) {
        console.error('Create labels error:', error)
        res.status(500).json({ error: 'Failed to create labels' })
    }
})

// ShipStation tracking webhook (event: track). Register the URL with ?token=SHIPSTATION_WEBHOOK_TOKEN
const tokenOk = (given) => {
    const want = process.env.SHIPSTATION_WEBHOOK_TOKEN || ''
    if (!want || typeof given !== 'string' || given.length !== want.length) return false
    return timingSafeEqual(Buffer.from(given), Buffer.from(want))
}

router.post('/webhook', (req, res) => {
    if (!tokenOk(req.query.token)) return res.status(401).json({ error: 'Unauthorized' })
    try {
        const d = req.body?.data || {}
        const updated = applyTrackingUpdate({
            trackingNumber: d.tracking_number,
            statusCode: d.status_code,
            description: d.status_description || d.carrier_status_description
        })
        res.json({ ok: true, updated })
    } catch (error) {
        console.error('Shipping webhook error:', error)
        res.status(500).json({ error: 'Webhook failed' })
    }
})

export default router
