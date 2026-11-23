// End-to-end check of notifications (in-app / email / SMS, triggers, reminders, password reset)
// and the help desk (tickets, lookups, staff actions). Runs on a throwaway database with no
// Resend/Twilio/ShipStation keys, so emails and texts are recorded as "dev" deliveries.
//   node server/scripts/smoke-helpdesk.js
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rentaleze-hd-'))
const PORT = 3997
const BASE = `http://localhost:${PORT}/api`
const DB_PATH = path.join(tmp, 'test.db')
const env = {
    ...process.env, PORT: String(PORT), NODE_ENV: 'development', SHOW_DEMO_LISTINGS: 'false', DB_PATH,
    UPLOADS_DIR: path.join(tmp, 'uploads'), BETA_PASSWORD: '', WAITLIST_HOSTS: '', ADMIN_EMAILS: 'admin@hd.test', SUPPORT_EMAILS: '',
    STRIPE_SECRET_KEY: '', TWILIO_ACCOUNT_SID: '', RESEND_API_KEY: '', SHIPSTATION_API_KEY: '', SHIPSTATION_WEBHOOK_TOKEN: 'hook-1234',
    DISABLE_SCHEDULER: 'true', LOG_EMAILS: 'false'
}
const server = spawn(process.execPath, ['server/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
server.stdout.on('data', d => { log += d })
server.stderr.on('data', d => { log += d })

let passed = 0
const failures = []
const check = (name, ok, extra = '') => {
    if (ok) { passed++; console.log(`  ✓ ${name}`) } else { failures.push(name); console.log(`  ✗ ${name} ${extra}`) }
}
async function call(method, url, { token, body } = {}) {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const text = await res.text()
    let data; try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, data }
}
const signup = async (email, firstName) => {
    const r = await call('POST', '/auth/signup', { body: { email, password: 'password123', firstName, lastName: 'Tester', role: 'both' } })
    if (r.status !== 201) throw new Error(`signup ${email}: ${JSON.stringify(r.data)}`)
    return { token: r.data.accessToken, refresh: r.data.refreshToken, user: r.data.user }
}
const isoDay = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let db
const notes = (userId, type) => db.prepare('SELECT * FROM notifications WHERE user_id = ? AND type = ?').all(userId, type)
// Deliveries are written in the background; give them a moment
async function deliveries(userId, type, channel) {
    for (let i = 0; i < 20; i++) {
        const rows = db.prepare('SELECT * FROM notification_deliveries WHERE user_id = ? AND type = ? AND channel = ?').all(userId, type, channel)
        if (rows.length) return rows
        await sleep(100)
    }
    return []
}

async function main() {
    for (let i = 0; i < 60; i++) {
        try { if ((await fetch(`${BASE}/health`)).ok) break } catch { /* not up yet */ }
        await sleep(250)
    }
    db = new Database(DB_PATH)

    console.log('Account notifications')
    const owner = await signup('owner@hd.test', 'Olivia')
    const renter = await signup('renter@hd.test', 'Ray')
    const admin = await signup('admin@hd.test', 'Ada')
    const agent = await signup('agent@hd.test', 'Sam')
    check('welcome notification in-app', notes(renter.user.id, 'welcome').length === 1)
    check('welcome email recorded (dev mode)', (await deliveries(renter.user.id, 'welcome', 'email'))[0]?.status === 'dev')
    let r = await call('GET', '/notifications', { token: renter.token })
    check('notification list + unread count', r.status === 200 && r.data.unread === 1 && r.data.notifications[0].title.includes('Welcome'))
    r = await call('POST', `/notifications/${r.data.notifications[0].id}/read`, { token: renter.token })
    check('mark one read', r.status === 200 && (await call('GET', '/notifications/unread-count', { token: renter.token })).data.unread === 0)
    check('cannot read someone else’s notification', (await call('POST', `/notifications/${notes(owner.user.id, 'welcome')[0].id}/read`, { token: renter.token })).status === 404)

    // Verify both (ID via dev route, phone directly) so they can transact and receive texts
    r = await call('POST', '/verification/identity/dev-complete', { token: renter.token })
    check('ID verified notification', notes(renter.user.id, 'id_verified').length === 1)
    await call('POST', '/verification/identity/dev-complete', { token: owner.token })
    db.prepare(`UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?`).run('+14045550101', renter.user.id)
    db.prepare(`UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?`).run('+14045550102', owner.user.id)

    console.log('Password reset')
    r = await call('POST', '/auth/forgot-password', { body: { email: 'nobody@hd.test' } })
    const sameMsg = r.data.message
    r = await call('POST', '/auth/forgot-password', { body: { email: 'Renter@HD.test' } })
    check('same answer for unknown and known emails', r.status === 200 && r.data.message === sameMsg)
    check('reset email sent', (await deliveries(renter.user.id, 'password_reset', 'email'))[0]?.status === 'dev')
    check('reset token stored hashed', db.prepare('SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ?').get(renter.user.id).n === 1)
    check('bad token rejected', (await call('POST', '/auth/reset-password', { body: { token: 'nope', password: 'newpassword1' } })).status === 400)
    // Simulate clicking the emailed link with a token we control
    const token = 'a'.repeat(64)
    db.prepare(`INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ('t1', ?, ?, ?)`)
        .run(renter.user.id, createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 3600e3).toISOString())
    check('short password rejected', (await call('POST', '/auth/reset-password', { body: { token, password: 'short' } })).status === 400)
    r = await call('POST', '/auth/reset-password', { body: { token, password: 'newpassword1' } })
    check('password reset works', r.status === 200)
    check('old sessions signed out', (await call('POST', '/auth/refresh', { body: { refreshToken: renter.refresh } })).status === 401)
    check('password changed alert (in-app + email + text)', notes(renter.user.id, 'password_changed').length === 1 &&
        (await deliveries(renter.user.id, 'password_changed', 'email')).length === 1 && (await deliveries(renter.user.id, 'password_changed', 'sms')).length === 1)
    check('reset link is single use', (await call('POST', '/auth/reset-password', { body: { token, password: 'another12' } })).status === 400)
    r = await call('POST', '/auth/login', { body: { email: 'renter@hd.test', password: 'newpassword1' } })
    check('sign in with the new password', r.status === 200)
    renter.token = r.data.accessToken

    console.log('Booking triggers')
    const listing = (await call('POST', '/listings', { token: owner.token, body: {
        title: 'Pressure washer', category: 'tools', pricePerDay: 30, location: 'Atlanta, GA', images: ['https://example.com/a.jpg'], status: 'active'
    } })).data
    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(5), endDate: isoDay(7) } })
    check('booking requested', r.status === 201, JSON.stringify(r.data))
    const b1 = r.data
    check('owner told: in-app, email, text', notes(owner.user.id, 'booking_requested').length === 1 &&
        (await deliveries(owner.user.id, 'booking_requested', 'email')).length === 1 && (await deliveries(owner.user.id, 'booking_requested', 'sms'))[0]?.status === 'dev')
    // Renter turns emails off: booking emails stop, texts and security emails continue
    r = await call('PUT', '/notifications/preferences', { token: renter.token, body: { email: false } })
    check('turn emails off', r.status === 200 && r.data.email === false && r.data.sms === true && r.data.smsAvailable)
    await call('PUT', `/bookings/${b1.id}/accept`, { token: owner.token })
    check('renter told booking accepted', notes(renter.user.id, 'booking_accepted').length === 1)
    check('…email skipped (turned off)', (await deliveries(renter.user.id, 'booking_accepted', 'email'))[0]?.status === 'skipped')
    check('…text still sent', (await deliveries(renter.user.id, 'booking_accepted', 'sms'))[0]?.status === 'dev')
    await call('PUT', '/notifications/preferences', { token: renter.token, body: { email: true } })

    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(20), endDate: isoDay(22) } })
    await call('PUT', `/bookings/${r.data.id}/decline`, { token: owner.token, body: { note: 'Away that week' } })
    check('renter told request declined', notes(renter.user.id, 'booking_declined')[0]?.body?.includes('Away that week'))

    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(30), endDate: isoDay(32) } })
    await call('PUT', `/bookings/${r.data.id}/accept`, { token: owner.token })
    await call('PUT', `/bookings/${r.data.id}/cancel`, { token: renter.token })
    check('owner told renter cancelled', notes(owner.user.id, 'booking_cancelled').length === 1 && notes(renter.user.id, 'booking_cancelled').length === 0)

    // Finish b1: move dates to today so pickup/return are allowed
    db.prepare('UPDATE bookings SET start_date = ?, end_date = ? WHERE id = ?').run(isoDay(0), isoDay(2), b1.id)
    await call('PUT', `/bookings/${b1.id}/pickup`, { token: owner.token })
    await call('PUT', `/bookings/${b1.id}/return`, { token: owner.token })
    check('both asked for a review when finished', notes(renter.user.id, 'booking_completed').length === 1 && notes(owner.user.id, 'booking_completed').length === 1)

    console.log('Shipping triggers')
    const shipListing = (await call('POST', '/listings', { token: owner.token, body: {
        title: 'Camera kit', category: 'cameras', pricePerDay: 40, location: 'Atlanta, GA', images: ['https://example.com/c.jpg'], status: 'active',
        shipping: true, instantBook: true, package: { lengthIn: 14, widthIn: 10, heightIn: 8, weightLb: 6 },
        shipFrom: { name: 'Olivia', phone: '4045550102', line1: '1 Peachtree St', city: 'Atlanta', state: 'GA', zip: '30303' }
    } })).data
    r = await call('POST', '/bookings', { token: renter.token, body: {
        listingId: shipListing.id, startDate: isoDay(4), endDate: isoDay(6), fulfillment: 'shipping',
        shippingAddress: '2 Main St', shippingCity: 'Decatur', shippingState: 'GA', shippingZip: '30030'
    } })
    const sb = r.data
    check('instant shipped booking', r.status === 201 && sb.status === 'accepted', JSON.stringify(r.data))
    check('owner told it was booked + labels ready', notes(owner.user.id, 'booking_instant').length === 1 && notes(owner.user.id, 'labels_ready').length === 1)
    const out = sb.shipments.find(s => s.direction === 'outbound'), ret = sb.shipments.find(s => s.direction === 'return')
    await call('POST', '/shipping/webhook?token=hook-1234', { body: { data: { tracking_number: out.trackingNumber, status_code: 'DE' } } })
    await call('POST', '/shipping/webhook?token=hook-1234', { body: { data: { tracking_number: out.trackingNumber, status_code: 'DE' } } })
    check('renter told delivered (once, even if the webhook repeats)', notes(renter.user.id, 'item_delivered').length === 1)
    check('delivered text sent', (await deliveries(renter.user.id, 'item_delivered', 'sms')).length === 1)
    await call('POST', '/shipping/webhook?token=hook-1234', { body: { data: { tracking_number: ret.trackingNumber, status_code: 'IT' } } })
    await call('POST', '/shipping/webhook?token=hook-1234', { body: { data: { tracking_number: ret.trackingNumber, status_code: 'DE' } } })
    check('owner told return shipped and delivered', notes(owner.user.id, 'return_shipped').length === 1 && notes(owner.user.id, 'return_delivered').length === 1)

    console.log('Scheduled reminders')
    check('only admins can run reminders', (await call('POST', '/notifications/run-jobs', { token: renter.token })).status === 403)
    const mk = (status, start, end, fulfillment = 'pickup') => {
        const id = `job-${Math.random().toString(36).slice(2)}`
        db.prepare(`INSERT INTO bookings (id, listing_id, user_id, start_date, end_date, days, qty, base_total, total, fulfillment, status)
            VALUES (?, ?, ?, ?, ?, 2, 1, 60, 67, ?, ?)`).run(id, listing.id, renter.user.id, start, end, fulfillment, status)
        return id
    }
    const tomorrow = mk('accepted', isoDay(1), isoDay(3))
    const dueBack = mk('active', isoDay(-2), isoDay(1))
    const late = mk('active', isoDay(-5), isoDay(-1))
    db.prepare(`UPDATE users SET created_at = datetime('now', '-2 days') WHERE id = ?`).run(agent.user.id)
    r = await call('POST', '/notifications/run-jobs', { token: admin.token })
    check('reminders sent', r.status === 200 && r.data.sent.rental_tomorrow === 2 && r.data.sent.return_due === 1 && r.data.sent.return_overdue === 1 && r.data.sent.owner_return_overdue === 1, JSON.stringify(r.data))
    check('unverified user reminded to verify', notes(agent.user.id, 'verification_reminder').length === 1)
    check('pickup-tomorrow text to renter', db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND dedupe_key = ?`).get(renter.user.id, `rental_tomorrow:${tomorrow}`) && (await deliveries(renter.user.id, 'rental_tomorrow', 'sms')).length === 1)
    check('due-back and overdue reach the right booking', !!db.prepare('SELECT 1 FROM notifications WHERE dedupe_key = ?').get(`return_due:${dueBack}`) && !!db.prepare('SELECT 1 FROM notifications WHERE dedupe_key = ? AND user_id = ?').get(`return_overdue:${late}`, owner.user.id))
    r = await call('POST', '/notifications/run-jobs', { token: admin.token })
    check('reminders never repeat', Object.keys(r.data.sent).length === 0, JSON.stringify(r.data))

    console.log('Customer tickets')
    check('short subject rejected', (await call('POST', '/support/tickets', { token: renter.token, body: { subject: 'hi', body: 'help me please now' } })).status === 400)
    const strangerBooking = mk('accepted', isoDay(50), isoDay(52))
    db.prepare('UPDATE bookings SET user_id = ? WHERE id = ?').run(admin.user.id, strangerBooking)
    check('cannot attach someone else’s booking', (await call('POST', '/support/tickets', { token: renter.token, body: { subject: 'Problem', body: 'Something went wrong here', bookingId: strangerBooking } })).status === 400)
    r = await call('POST', '/support/tickets', { token: renter.token, body: { subject: 'Return label won’t print', category: 'shipping', body: 'The PDF opens blank for my camera rental.', bookingId: sb.id } })
    check('ticket created as #1001', r.status === 201 && r.data.number === 1001 && r.data.status === 'open', JSON.stringify(r.data))
    check('active-rental ticket gets high priority', r.data.priority === 'high')
    const ticket = r.data
    check('customer gets “we got your message”', notes(renter.user.id, 'ticket_received').length === 1 && (await deliveries(renter.user.id, 'ticket_received', 'email')).length === 1)
    check('customer sees only their tickets', (await call('GET', '/support/tickets', { token: owner.token })).data.length === 0)
    check('other user cannot open the ticket', (await call('GET', `/support/tickets/${ticket.id}`, { token: owner.token })).status === 404)

    console.log('Help desk access & staff')
    check('customers blocked from the help desk', (await call('GET', '/helpdesk/summary', { token: renter.token })).status === 403)
    check('agent not staff yet', (await call('GET', '/helpdesk/summary', { token: agent.token })).status === 403)
    check('admin can open the help desk', (await call('GET', '/helpdesk/summary', { token: admin.token })).status === 200)
    r = await call('POST', '/helpdesk/staff', { token: admin.token, body: { email: 'agent@hd.test' } })
    check('admin adds a support agent', r.status === 201 && r.data.some(s => s.email === 'agent@hd.test' && s.role === 'support'))
    check('agent flagged as staff on /auth/me', (await call('GET', '/auth/me', { token: agent.token })).data.isStaff === true)
    check('agent cannot add staff', (await call('POST', '/helpdesk/staff', { token: agent.token, body: { email: 'owner@hd.test' } })).status === 403)

    console.log('Working a ticket')
    r = await call('GET', '/helpdesk/summary', { token: agent.token })
    check('summary counts', r.data.open === 1 && r.data.unassigned === 1 && r.data.urgent === 1, JSON.stringify(r.data))
    r = await call('GET', '/helpdesk/tickets?view=open', { token: agent.token })
    check('ticket in open queue, waiting on us', r.data.length === 1 && r.data[0].waitingOnUs && r.data[0].customer.email === 'renter@hd.test')
    r = await call('GET', `/helpdesk/tickets/${ticket.id}`, { token: agent.token })
    check('ticket detail has customer + booking + labels', r.data.customer?.email === 'renter@hd.test' && r.data.booking?.id === sb.id && r.data.booking.shipments.length === 2)
    await call('POST', `/helpdesk/tickets/${ticket.id}/messages`, { token: agent.token, body: { body: 'Label PDF looks fine on our side.', internal: true } })
    check('internal note hidden from customer', (await call('GET', `/support/tickets/${ticket.id}`, { token: renter.token })).data.messages.length === 1)
    check('internal note sends nothing', notes(renter.user.id, 'ticket_reply').length === 0)
    r = await call('POST', `/helpdesk/tickets/${ticket.id}/messages`, { token: agent.token, body: { body: 'Try opening it in Chrome — here is a fresh link.' } })
    check('reply → waiting on customer, auto-assigned, first response timed', r.data.status === 'pending' && r.data.assigneeId === agent.user.id && !!r.data.firstResponseAt)
    check('customer told support replied', notes(renter.user.id, 'ticket_reply').length === 1 && (await deliveries(renter.user.id, 'ticket_reply', 'email')).length === 1)
    r = await call('POST', `/support/tickets/${ticket.id}/messages`, { token: renter.token, body: { body: 'That worked, but now the box is too small.' } })
    check('customer reply reopens', r.data.status === 'open' && r.data.messages.length === 3)
    check('assigned agent told customer replied', notes(agent.user.id, 'ticket_customer_reply').length === 1)
    r = await call('PUT', `/helpdesk/tickets/${ticket.id}`, { token: agent.token, body: { priority: 'urgent', assigneeId: admin.user.id } })
    check('re-prioritise and reassign', r.data.priority === 'urgent' && r.data.assigneeId === admin.user.id)
    check('new assignee notified', notes(admin.user.id, 'ticket_assigned').length === 1)
    check('changes logged as a system note', r.data.messages.some(m => m.authorRole === 'system' && m.body.includes('urgent')))
    check('cannot assign to a customer', (await call('PUT', `/helpdesk/tickets/${ticket.id}`, { token: agent.token, body: { assigneeId: owner.user.id } })).status === 400)

    console.log('Lookups')
    r = await call('GET', '/helpdesk/search?q=renter@hd', { token: agent.token })
    check('search by email', r.data.users.length === 1 && r.data.users[0].email === 'renter@hd.test')
    check('search by #ticket', (await call('GET', '/helpdesk/search?q=%231001', { token: agent.token })).data.tickets[0]?.id === ticket.id)
    check('search by tracking number', (await call('GET', `/helpdesk/search?q=${out.trackingNumber}`, { token: agent.token })).data.bookings[0]?.id === sb.id)
    check('search by phone', (await call('GET', '/helpdesk/search?q=5550101', { token: agent.token })).data.users[0]?.email === 'renter@hd.test')
    r = await call('GET', `/helpdesk/customers/${renter.user.id}`, { token: agent.token })
    check('customer profile: bookings, tickets, deliveries', r.status === 200 && r.data.bookings.length >= 4 && r.data.tickets.length === 1 && r.data.deliveries.length > 5 && r.data.phoneVerified)
    r = await call('GET', `/helpdesk/bookings/${sb.id}`, { token: agent.token })
    check('booking view shows address + tickets', r.data.shippingAddress?.zip === '30030' && r.data.tickets.length === 1)

    console.log('Actions')
    const cancelMe = (await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(40), endDate: isoDay(42) } })).data
    check('cancel needs a reason', (await call('POST', `/helpdesk/bookings/${cancelMe.id}/cancel`, { token: agent.token, body: {} })).status === 400)
    r = await call('POST', `/helpdesk/bookings/${cancelMe.id}/cancel`, { token: agent.token, body: { reason: 'Owner reported item broken' } })
    check('support cancels a booking', r.status === 200 && r.data.status === 'cancelled' && r.data.cancelledBy === 'support')
    const cancelNotes = db.prepare(`SELECT user_id FROM notifications WHERE type = 'booking_cancelled' AND body LIKE '%support%'`).all().map(x => x.user_id)
    check('both sides told support cancelled', cancelNotes.includes(renter.user.id) && cancelNotes.includes(owner.user.id))
    check('cannot cancel twice', (await call('POST', `/helpdesk/bookings/${cancelMe.id}/cancel`, { token: agent.token, body: { reason: 'again please' } })).status === 400)
    r = await call('POST', `/helpdesk/customers/${owner.user.id}/password-reset`, { token: agent.token })
    check('agent sends a reset link', r.status === 200 && (await deliveries(owner.user.id, 'password_reset', 'email')).length === 1)
    check('agent cannot suspend an admin', (await call('POST', `/helpdesk/customers/${admin.user.id}/suspend`, { token: agent.token, body: { reason: 'testing this' } })).status === 403)
    r = await call('POST', `/helpdesk/customers/${renter.user.id}/suspend`, { token: agent.token, body: { suspended: true, reason: 'Chargeback under review' } })
    check('agent suspends a customer', r.status === 200 && r.data.suspended)
    check('customer told about the hold', notes(renter.user.id, 'account_suspended').length === 1)
    const login = await call('POST', '/auth/login', { body: { email: 'renter@hd.test', password: 'newpassword1' } })
    renter.token = login.data.accessToken
    check('suspended customer cannot book', (await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(60), endDate: isoDay(62) } })).status === 403)
    check('…but can still message support', (await call('POST', `/support/tickets/${ticket.id}/messages`, { token: renter.token, body: { body: 'Why is my account on hold?' } })).status === 201)
    r = await call('POST', `/helpdesk/customers/${renter.user.id}/suspend`, { token: agent.token, body: { suspended: false, reason: 'Chargeback resolved' } })
    check('agent reinstates', r.status === 200 && !r.data.suspended && notes(renter.user.id, 'account_reinstated').length === 1)

    r = await call('POST', `/helpdesk/tickets/${ticket.id}/messages`, { token: agent.token, body: { body: 'All sorted — you’re reinstated.', status: 'solved' } })
    check('reply + solve', r.data.status === 'solved' && notes(renter.user.id, 'ticket_solved').length === 1)
    r = await call('GET', '/helpdesk/activity', { token: agent.token })
    const actions = r.data.map(a => a.action)
    check('every action in the activity log', ['support_cancel_booking', 'support_send_password_reset', 'support_suspend_user', 'support_reinstate_user', 'support_grant'].every(a => actions.includes(a)), actions.join(','))
    r = await call('POST', '/helpdesk/tickets', { token: agent.token, body: { userId: owner.user.id, subject: 'Phone call: payout question', body: 'Owner called asking when payouts go out.' } })
    check('agent opens a ticket for a customer', r.status === 201 && r.data.number === 1002 && r.data.assigneeId === agent.user.id)

    r = await call('DELETE', `/helpdesk/staff/${agent.user.id}`, { token: admin.token })
    check('admin removes the agent', r.status === 200 && !r.data.some(s => s.id === agent.user.id))
    check('removed agent locked out', (await call('GET', '/helpdesk/summary', { token: agent.token })).status === 403)
    check('their open tickets unassigned', db.prepare(`SELECT COUNT(*) AS n FROM support_tickets WHERE assignee_id = ? AND status IN ('open','pending')`).get(agent.user.id).n === 0)

    db.close()
}

main()
    .catch(err => { failures.push(`crash: ${err.message}`); console.error(err) })
    .finally(() => {
        server.kill()
        console.log(`\n${passed} passed, ${failures.length} failed`)
        if (failures.length) {
            console.log('Server log:\n' + log.split('\n').slice(-40).join('\n'))
            process.exitCode = 1
        }
        setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* Windows may hold the db open */ } }, 1000)
    })
