import express, { Router } from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import {
    identityConfigured, identityDevMode, identityStripe, createIdentitySession,
    applyIdentitySession, refreshIdentityStatus
} from '../services/identity.js'
import { smsConfigured, smsDevMode, toE164, sendCode, checkCode, DEV_CODE } from '../services/sms.js'
import { safeNotify } from '../services/notify.js'

const router = Router()

// Texts cost money and can be abused: a few per account per hour
const smsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { error: 'Too many codes requested. Please try again in an hour.' }
})
const checkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { error: 'Too many attempts. Please wait 15 minutes.' }
})

function statusFor(userId) {
    const u = db.prepare('SELECT id_status, id_last_error, is_verified, phone, phone_verified FROM users WHERE id = ?').get(userId)
    return {
        idStatus: u.is_verified === 1 ? 'verified' : (u.id_status || 'none'),
        idError: u.id_last_error || null,
        phone: u.phone || null,
        phoneVerified: u.phone_verified === 1,
        fullyVerified: u.is_verified === 1 && u.phone_verified === 1,
        identityAvailable: identityConfigured() || identityDevMode(),
        phoneAvailable: smsConfigured() || smsDevMode(),
        devMode: { identity: identityDevMode(), sms: smsDevMode(), code: smsDevMode() ? DEV_CODE : undefined }
    }
}

// Current verification status (re-checks Stripe while a check is in progress)
router.get('/status', authenticate, async (req, res) => {
    try {
        if (identityConfigured() && req.user.id_status === 'pending') {
            await refreshIdentityStatus(req.user.id).catch(err => console.error('Identity refresh failed:', err.message))
        }
        res.json(statusFor(req.user.id))
    } catch (error) {
        console.error('Verification status error:', error)
        res.status(500).json({ error: 'Failed to load verification status' })
    }
})

// Start an ID check: returns a Stripe-hosted URL to send the person to
router.post('/identity/start', authenticate, async (req, res) => {
    try {
        if (req.user.is_verified === 1) return res.status(400).json({ error: 'Your ID is already verified.' })
        if (identityDevMode()) return res.json({ dev: true })
        if (!identityConfigured()) return res.status(503).json({ error: 'ID verification is not available yet. Please try again later.' })

        const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`
        const session = await createIdentitySession(req.user, `${base}/dashboard/verification?returned=1`)
        res.json({ url: session.url })
    } catch (error) {
        console.error('Identity start error:', error)
        res.status(500).json({ error: 'Could not start ID verification. Please try again.' })
    }
})

// Development only: pretend the ID check passed (no Stripe keys on this machine)
router.post('/identity/dev-complete', authenticate, (req, res) => {
    if (!identityDevMode()) return res.status(404).json({ error: 'Not found' })
    db.prepare(`UPDATE users SET id_status = 'verified', is_verified = 1, id_verified_at = CURRENT_TIMESTAMP, id_last_error = NULL WHERE id = ?`)
        .run(req.user.id)
    safeNotify(req.user.id, 'id_verified', {}, { dedupeKey: 'id_verified:dev' })
    res.json(statusFor(req.user.id))
})

// Send a 6-digit code by text
router.post('/phone/send', authenticate, smsLimiter, async (req, res) => {
    try {
        if (!smsConfigured() && !smsDevMode()) return res.status(503).json({ error: 'Phone verification is not available yet.' })
        const phone = toE164(req.body?.phone)
        if (!phone) return res.status(400).json({ error: 'Enter a valid mobile number, like (404) 555-1234.' })

        // One verified account per phone number
        const taken = db.prepare('SELECT 1 FROM users WHERE phone = ? AND phone_verified = 1 AND id != ?').get(phone, req.user.id)
        if (taken) return res.status(409).json({ error: 'That number is already verified on another account.' })

        await sendCode(phone)
        db.prepare(`UPDATE users SET phone = ?, phone_verified = CASE WHEN phone = ? THEN phone_verified ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(phone, phone, req.user.id)
        res.json({ sent: true, phone, ...(smsDevMode() ? { devCode: DEV_CODE } : {}) })
    } catch (error) {
        console.error('Send code error:', error)
        res.status(502).json({ error: 'We could not send a text to that number. Check it and try again.' })
    }
})

// Check the code
router.post('/phone/check', authenticate, checkLimiter, async (req, res) => {
    try {
        const code = String(req.body?.code || '').replace(/\D/g, '')
        if (code.length < 4) return res.status(400).json({ error: 'Enter the code we texted you.' })
        const { phone } = db.prepare('SELECT phone FROM users WHERE id = ?').get(req.user.id)
        if (!phone) return res.status(400).json({ error: 'Request a code first.' })

        const ok = await checkCode(phone, code)
        if (!ok) return res.status(400).json({ error: 'That code is wrong or has expired. Request a new one.' })

        db.prepare(`UPDATE users SET phone_verified = 1, phone_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(req.user.id)
        res.json(statusFor(req.user.id))
    } catch (error) {
        console.error('Check code error:', error)
        res.status(500).json({ error: 'Could not check the code. Please try again.' })
    }
})

export default router

// ─── Stripe Identity webhook ────────────────────────────────────────────────
// Mounted in server/index.js BEFORE express.json(), because Stripe signs the raw body.
// Dashboard → Developers → Webhooks → add endpoint https://beta.rentaleze.com/api/webhooks/identity
// with the identity.verification_session.* events, then set STRIPE_IDENTITY_WEBHOOK_SECRET.
export const identityWebhook = [
    express.raw({ type: 'application/json' }),
    (req, res) => {
        const stripe = identityStripe()
        const secret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET
        if (!stripe || !secret) return res.status(503).json({ error: 'Not configured' })

        let event
        try {
            event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret)
        } catch (err) {
            console.error('Identity webhook signature failed:', err.message)
            return res.status(400).send('Bad signature')
        }

        try {
            if (event.type.startsWith('identity.verification_session.')) applyIdentitySession(event.data.object)
        } catch (err) {
            console.error('Identity webhook handling failed:', err)
            return res.status(500).send('Handler error')
        }
        res.json({ received: true })
    }
]
