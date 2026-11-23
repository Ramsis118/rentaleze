import { Router } from 'express'
import db from '../db/database.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { runScheduledJobs } from '../services/notify.js'
import { emailConfigured } from '../services/email.js'
import { smsSendingConfigured } from '../services/sms.js'

const router = Router()

const toNotification = (n) => ({
    id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at
})

// My notifications (newest first) + unread count
router.get('/', authenticate, (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100)
    const rows = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`).all(req.user.id, limit)
    const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n
    res.json({ notifications: rows.map(toNotification), unread })
})

router.get('/unread-count', authenticate, (req, res) => {
    res.json({ unread: db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n })
})

router.post('/read-all', authenticate, (req, res) => {
    db.prepare(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL`).run(req.user.id)
    res.json({ ok: true })
})

router.post('/:id/read', authenticate, (req, res) => {
    const r = db.prepare(`UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id)
    if (!r.changes) return res.status(404).json({ error: 'Notification not found' })
    res.json({ ok: true })
})

// Preferences: email and text on/off (security, account and support emails always send)
router.get('/preferences', authenticate, (req, res) => {
    const u = db.prepare('SELECT notify_email, notify_sms, phone, phone_verified FROM users WHERE id = ?').get(req.user.id)
    res.json({
        email: u.notify_email !== 0,
        sms: u.notify_sms !== 0,
        smsAvailable: u.phone_verified === 1 && !!u.phone
    })
})

router.put('/preferences', authenticate, (req, res) => {
    const sets = [], vals = []
    if (typeof req.body?.email === 'boolean') { sets.push('notify_email = ?'); vals.push(req.body.email ? 1 : 0) }
    if (typeof req.body?.sms === 'boolean') { sets.push('notify_sms = ?'); vals.push(req.body.sms ? 1 : 0) }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to change' })
    db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, req.user.id)
    const u = db.prepare('SELECT notify_email, notify_sms, phone, phone_verified FROM users WHERE id = ?').get(req.user.id)
    res.json({ email: u.notify_email !== 0, sms: u.notify_sms !== 0, smsAvailable: u.phone_verified === 1 && !!u.phone })
})

// Admin: run the reminder jobs now, and see whether email/SMS are live
router.post('/run-jobs', requireAdmin, (req, res) => res.json({ sent: runScheduledJobs() }))
router.get('/status', requireAdmin, (req, res) => res.json({
    email: emailConfigured() ? 'live' : (process.env.NODE_ENV === 'production' ? 'off' : 'dev'),
    sms: smsSendingConfigured() ? 'live' : (process.env.NODE_ENV === 'production' ? 'off' : 'dev')
}))

export default router
