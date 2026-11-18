import { Router } from 'express'
import { randomUUID, timingSafeEqual } from 'crypto'
import rateLimit from 'express-rate-limit'
import db from '../db/database.js'

const router = Router()

const ROLES = ['rent', 'list', 'both']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Stop one visitor from flooding the list
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })

router.post('/', signupLimiter, (req, res) => {
    try {
        const { email, role, zip, interest, website } = req.body || {}

        // Honeypot: real people never see or fill the "website" field
        if (website) return res.json({ ok: true })

        const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 254)
        if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Please enter a valid email address.' })

        const cleanRole = ROLES.includes(role) ? role : 'rent'
        const cleanZip = String(zip || '').trim().slice(0, 10)
        const cleanInterest = String(interest || '').trim().slice(0, 300)

        const existing = db.prepare('SELECT id FROM waitlist WHERE email = ?').get(cleanEmail)
        if (existing) return res.json({ ok: true, alreadyJoined: true })

        db.prepare(`INSERT INTO waitlist (id, email, role, zip, interest, source) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(randomUUID(), cleanEmail, cleanRole, cleanZip, cleanInterest, req.hostname || null)

        res.status(201).json({ ok: true })
    } catch (error) {
        console.error('Waitlist signup error:', error)
        res.status(500).json({ error: 'Something went wrong. Please try again.' })
    }
})

// Download the list as CSV: GET /api/waitlist/export with header  x-admin-token: <ADMIN_TOKEN>
router.get('/export', (req, res) => {
    const expected = process.env.ADMIN_TOKEN
    const given = String(req.get('x-admin-token') || '')
    const ok = expected && given.length === expected.length &&
        timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    if (!ok) return res.status(404).json({ error: 'Not found' })

    const rows = db.prepare('SELECT email, role, zip, interest, created_at FROM waitlist ORDER BY created_at').all()
    // Quote every cell, and neutralise text that Excel would run as a formula
    const esc = (v) => {
        let s = String(v ?? '')
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
        return `"${s.replace(/"/g, '""')}"`
    }
    const csv = ['email,role,zip,interest,joined']
        .concat(rows.map(r => [r.email, r.role, r.zip, r.interest, r.created_at].map(esc).join(',')))
        .join('\n')
    res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="rentaleze-waitlist.csv"').send(csv)
})

export default router
