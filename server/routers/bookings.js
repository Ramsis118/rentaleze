import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Create booking
router.post('/', authenticate, (req, res) => {
    try {
        const { listingId, startDate, endDate, days, qty, fulfillment, intendedUse, shippingAddress, shippingCity, shippingState, shippingZip } = req.body

        if (!listingId || !startDate || !endDate || !days) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        // Get listing price
        const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId)

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' })
        }

        const baseTotal = days * listing.price_per_day * (qty || 1)
        const insurance = Math.round(baseTotal * 0.08)
        const serviceFee = Math.round(baseTotal * 0.12)
        const shippingFee = fulfillment === 'shipping' ? 24 : 0
        const total = baseTotal + insurance + serviceFee + shippingFee

        const bookingId = uuidv4()

        db.prepare(`
      INSERT INTO bookings (id, listing_id, user_id, start_date, end_date, days, qty, fulfillment, base_total, insurance, service_fee, shipping_fee, total, intended_use, shipping_address, shipping_city, shipping_state, shipping_zip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            bookingId,
            listingId,
            req.user.id,
            startDate,
            endDate,
            days,
            qty || 1,
            fulfillment || 'pickup',
            baseTotal,
            insurance,
            serviceFee,
            shippingFee,
            total,
            intendedUse || '',
            shippingAddress || '',
            shippingCity || '',
            shippingState || '',
            shippingZip || ''
        )

        res.status(201).json({
            id: bookingId,
            message: 'Booking created successfully',
            total
        })
    } catch (error) {
        console.error('Create booking error:', error)
        res.status(500).json({ error: 'Failed to create booking' })
    }
})

// Get user's bookings (as renter)
router.get('/my', authenticate, (req, res) => {
    try {
        const bookings = db.prepare(`
      SELECT b.*, l.title, l.image, l.location, l.owner_name
      FROM bookings b
      JOIN listings l ON b.listing_id = l.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id)

        res.json(bookings)
    } catch (error) {
        console.error('Get bookings error:', error)
        res.status(500).json({ error: 'Failed to fetch bookings' })
    }
})

// Get user's rentals (as owner)
router.get('/rentals', authenticate, (req, res) => {
    try {
        const bookings = db.prepare(`
      SELECT b.*, l.title, l.image, l.location, u.first_name, u.last_name, u.avatar as renter_avatar
      FROM bookings b
      JOIN listings l ON b.listing_id = l.id
      JOIN users u ON b.user_id = u.id
      WHERE l.owner_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id)

        res.json(bookings)
    } catch (error) {
        console.error('Get rentals error:', error)
        res.status(500).json({ error: 'Failed to fetch rentals' })
    }
})

// Get single booking
router.get('/:id', authenticate, (req, res) => {
    try {
        const booking = db.prepare(`
      SELECT b.*, l.title, l.image, l.location, l.owner_name, l.owner_avatar
      FROM bookings b
      JOIN listings l ON b.listing_id = l.id
      WHERE b.id = ?
    `).get(req.params.id)

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' })
        }

        if (booking.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' })
        }

        res.json(booking)
    } catch (error) {
        console.error('Get booking error:', error)
        res.status(500).json({ error: 'Failed to fetch booking' })
    }
})

// Cancel booking
router.put('/:id/cancel', authenticate, (req, res) => {
    try {
        const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' })
        }

        if (booking.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' })
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({ error: 'Booking already cancelled' })
        }

        db.prepare('UPDATE bookings SET status = "cancelled" WHERE id = ?').run(req.params.id)

        res.json({ message: 'Booking cancelled successfully' })
    } catch (error) {
        console.error('Cancel booking error:', error)
        res.status(500).json({ error: 'Failed to cancel booking' })
    }
})

export default router