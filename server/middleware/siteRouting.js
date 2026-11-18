import express, { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WAITLIST_DIR = join(__dirname, '..', 'waitlist')

// Hosts that show only the coming-soon page, e.g. "rentaleze.com,www.rentaleze.com"
const WAITLIST_HOSTS = (process.env.WAITLIST_HOSTS || '')
    .split(',').map(h => h.trim().toLowerCase()).filter(Boolean)

// When set, every other host (e.g. beta.rentaleze.com) needs this password first
const BETA_PASSWORD = process.env.BETA_PASSWORD || ''
const COOKIE = 'rz_beta'
const COOKIE_DAYS = 30

const betaToken = () => createHmac('sha256', BETA_PASSWORD).update('rentaleze-beta-access').digest('hex')

function readCookie(req, name) {
    const header = req.headers.cookie || ''
    for (const part of header.split(';')) {
        const [k, ...v] = part.trim().split('=')
        if (k === name) return decodeURIComponent(v.join('='))
    }
    return null
}

function hasBetaAccess(req) {
    const value = readCookie(req, COOKIE)
    if (!value) return false
    const expected = betaToken()
    return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected))
}

// Only follow same-site paths after login (never "//evil.com" or a full URL)
const safeNext = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/')

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function loginPage(next, error) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rentaleze beta</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1E2B37;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.c{background:#fff;border-radius:18px;padding:28px;width:100%;max-width:340px;margin:20px}h1{margin:0 0 6px;font-size:20px;color:#1E2B37}
p{margin:0 0 18px;font-size:14px;color:#6B7A8A}input{width:100%;box-sizing:border-box;font:inherit;padding:12px 14px;border:1px solid #C8D4DC;border-radius:12px}
button{margin-top:14px;width:100%;border:0;border-radius:12px;padding:12px;font:inherit;font-weight:700;color:#fff;background:#6BB8D4;cursor:pointer}
.e{margin-top:12px;font-size:13px;color:#B91C1C}</style></head><body>
<form class="c" method="post" action="/beta-login"><h1>Rentaleze beta</h1><p>This test site is private. Enter the access password.</p>
<input type="hidden" name="next" value="${esc(next)}"><input type="password" name="password" placeholder="Access password" autocomplete="current-password" autofocus required>
<button type="submit">Continue</button>${error ? `<div class="e">${esc(error)}</div>` : ''}</form></body></html>`
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })

export function siteRouting() {
    const router = Router()

    // Preview of the coming-soon page on any host
    router.get('/coming-soon', (req, res) => res.sendFile(join(WAITLIST_DIR, 'index.html')))
    router.get('/waitlist.js', (req, res) => res.sendFile(join(WAITLIST_DIR, 'waitlist.js')))

    router.use((req, res, next) => {
        const host = (req.hostname || '').toLowerCase()

        // Main domain: coming-soon page only
        if (WAITLIST_HOSTS.includes(host)) {
            if (req.path === '/api/health' || req.path.startsWith('/api/waitlist')) return next()
            if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return res.status(404).json({ error: 'Not found' })
            res.set('Cache-Control', 'no-cache')
            return res.sendFile(join(WAITLIST_DIR, 'index.html'))
        }

        // Everything else (beta): password gate, if a password is configured
        if (!BETA_PASSWORD || req.path === '/api/health' || req.path === '/beta-login') return next()
        if (hasBetaAccess(req)) return next()

        res.set('X-Robots-Tag', 'noindex')
        if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
            return res.status(401).json({ error: 'Beta access required' })
        }
        return res.status(401).send(loginPage(req.originalUrl))
    })

    router.get('/beta-login', (req, res) => res.send(loginPage(safeNext(req.query.next))))

    router.post('/beta-login', loginLimiter, express.urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
        if (!BETA_PASSWORD) return res.redirect('/')
        const given = createHash('sha256').update(String(req.body?.password || '')).digest()
        const expected = createHash('sha256').update(BETA_PASSWORD).digest()
        const next = safeNext(req.body?.next)
        if (!timingSafeEqual(given, expected)) {
            return res.status(401).send(loginPage(next, 'That password is not right.'))
        }
        res.cookie(COOKIE, betaToken(), {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: COOKIE_DAYS * 24 * 60 * 60 * 1000
        })
        res.redirect(next)
    })

    return router
}
