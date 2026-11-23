// Notifications: one call — notify(userId, type, data) — creates the in-app notification and
// sends the email and/or text the event calls for, respecting the person's preferences.
// Sending happens in the background; every attempt is recorded in notification_deliveries.
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { sendEmail, renderEmail, appUrl, maskEmail } from './email.js'
import { sendSms, maskPhone } from './sms.js'

const day = (s) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '')
const link = (path) => `${appUrl()}${path}`

// ─── Event catalog ──────────────────────────────────────────────────────────
// channels: which ways it can go out. required: email is sent even if the person turned emails off
// (security and account notices). SMS only ever goes to a verified phone with texts turned on.
export const EVENTS = {
    welcome: {
        channels: ['inapp', 'email'],
        build: (u) => ({
            title: 'Welcome to Rentaleze',
            body: 'Verify your ID and phone to start renting, or list your first item.',
            link: '/dashboard/verification',
            email: {
                subject: 'Welcome to Rentaleze',
                heading: `Welcome, ${u.first_name}!`,
                paragraphs: ['Rentaleze lets you rent what you need from people nearby, and earn from things you already own.',
                    'Before your first rental, verify your ID and phone number. It takes about two minutes.'],
                button: { label: 'Verify my account', url: link('/dashboard/verification') }
            }
        })
    },
    verification_reminder: {
        channels: ['inapp', 'email'],
        build: (u) => ({
            title: 'Finish verifying your account',
            body: 'You need a verified ID and phone number before you can rent or get booked.',
            link: '/dashboard/verification',
            email: {
                subject: 'One step left before your first rental',
                heading: 'Finish verifying your account',
                paragraphs: ['You signed up for Rentaleze but haven’t finished verification yet. Owners and renters only deal with verified people.'],
                button: { label: 'Finish verification', url: link('/dashboard/verification') }
            }
        })
    },
    id_verified: {
        channels: ['inapp', 'email'],
        build: () => ({
            title: 'Your ID is verified',
            body: 'Thanks — your identity check passed.',
            link: '/dashboard/verification',
            email: { subject: 'Your ID is verified', heading: 'You’re verified', paragraphs: ['Your identity check passed. Once your phone is confirmed too, you can rent and list freely.'], button: { label: 'Browse items', url: link('/browse') } }
        })
    },
    id_failed: {
        channels: ['inapp', 'email'],
        build: (u, d) => ({
            title: 'We couldn’t verify your ID',
            body: d.reason || 'Please try again with a clear photo of a valid ID.',
            link: '/dashboard/verification',
            email: { subject: 'Your ID check didn’t go through', heading: 'Let’s try that again', paragraphs: [d.reason || 'We couldn’t verify your ID.', 'You can try again any time. If it keeps failing, reply to a support ticket and we’ll help.'], button: { label: 'Try again', url: link('/dashboard/verification') } }
        })
    },
    password_reset: {
        channels: ['email'],
        required: true,
        build: (u, d) => ({
            title: 'Reset your password',
            email: {
                subject: 'Reset your Rentaleze password',
                heading: 'Reset your password',
                paragraphs: ['Someone asked to reset the password for this account. The link works for 1 hour, one time.',
                    'If this wasn’t you, ignore this email — your password won’t change.'],
                button: { label: 'Choose a new password', url: link(`/reset-password?token=${encodeURIComponent(d.token)}`) },
                footer: 'You’re getting this because a password reset was requested for your Rentaleze account.'
            }
        })
    },
    password_changed: {
        channels: ['inapp', 'email', 'sms'],
        required: true,
        build: () => ({
            title: 'Your password was changed',
            body: 'If this wasn’t you, contact support right away.',
            link: '/dashboard/support',
            email: { subject: 'Your Rentaleze password was changed', heading: 'Password changed', paragraphs: ['Your password was just changed and you were signed out on other devices.', 'If you didn’t do this, open a support ticket immediately.'], button: { label: 'Contact support', url: link('/dashboard/support') }, footer: 'Security notice — sent to every account owner.' },
            sms: 'Rentaleze: your password was just changed. Not you? Contact support right away.'
        })
    },
    account_suspended: {
        channels: ['inapp', 'email'],
        required: true,
        build: (u, d) => ({
            title: 'Your account is on hold',
            body: d.reason || 'Contact support to resolve this.',
            link: '/dashboard/support',
            email: { subject: 'Your Rentaleze account is on hold', heading: 'Your account is on hold', paragraphs: [d.reason ? `Reason: ${d.reason}` : 'Your account was placed on hold by our team.', 'Your listings are paused. You can still contact support to sort this out.'], button: { label: 'Contact support', url: link('/dashboard/support') }, footer: 'Account notice.' }
        })
    },
    account_reinstated: {
        channels: ['inapp', 'email'],
        required: true,
        build: () => ({
            title: 'Your account is active again',
            body: 'You can rent and list again. Paused listings stay paused until you turn them back on.',
            link: '/dashboard/listings',
            email: { subject: 'Your Rentaleze account is active again', heading: 'You’re back', paragraphs: ['Your account hold was lifted. Listings that were paused stay paused until you turn them back on.'], button: { label: 'My listings', url: link('/dashboard/listings') }, footer: 'Account notice.' }
        })
    },

    // ─── Bookings ───────────────────────────────────────────────────────────
    booking_requested: {   // → owner
        channels: ['inapp', 'email', 'sms'],
        build: (u, b) => ({
            title: `New request: ${b.title}`,
            body: `${b.renterName} wants it ${day(b.start_date)}–${day(b.end_date)}. Accept or decline.`,
            link: '/dashboard/bookings?tab=owner',
            email: { subject: `New rental request for ${b.title}`, heading: 'You have a new request', paragraphs: [`${b.renterName} wants to rent ${b.title} from ${day(b.start_date)} to ${day(b.end_date)}${b.fulfillment === 'shipping' ? ' (shipped)' : ''}.`, 'Requests are first come, first served — answer soon so they don’t book elsewhere.'], button: { label: 'Review request', url: link('/dashboard/bookings?tab=owner') } },
            sms: `Rentaleze: ${b.renterName} requested ${b.title} for ${day(b.start_date)}-${day(b.end_date)}. Accept or decline: ${link('/dashboard/bookings?tab=owner')}`
        })
    },
    booking_instant: {     // → owner (Instant Book)
        channels: ['inapp', 'email', 'sms'],
        build: (u, b) => ({
            title: `Booked: ${b.title}`,
            body: `${b.renterName} booked it ${day(b.start_date)}–${day(b.end_date)} with Instant Book.`,
            link: '/dashboard/bookings?tab=owner',
            email: { subject: `${b.title} was booked`, heading: 'New Instant Book rental', paragraphs: [`${b.renterName} booked ${b.title} from ${day(b.start_date)} to ${day(b.end_date)}.`, b.fulfillment === 'shipping' ? 'Your prepaid send and return labels are ready on the Bookings page.' : 'Arrange pickup with the renter in Messages.'], button: { label: 'View booking', url: link('/dashboard/bookings?tab=owner') } },
            sms: `Rentaleze: ${b.renterName} booked ${b.title} for ${day(b.start_date)}-${day(b.end_date)}.`
        })
    },
    booking_accepted: {    // → renter
        channels: ['inapp', 'email', 'sms'],
        build: (u, b) => ({
            title: `Confirmed: ${b.title}`,
            body: b.fulfillment === 'shipping' ? `It ships to you for ${day(b.start_date)}.` : `Pick it up ${day(b.start_date)}.`,
            link: '/dashboard/bookings',
            email: { subject: `You’re confirmed: ${b.title}`, heading: 'Your rental is confirmed', paragraphs: [`${b.ownerName} confirmed ${b.title} for ${day(b.start_date)}–${day(b.end_date)}.`, b.fulfillment === 'shipping' ? 'It’s shipping to you. Tracking and your prepaid return label are on your Bookings page.' : 'Message the owner to set a pickup time.'], button: { label: 'View booking', url: link('/dashboard/bookings') } },
            sms: `Rentaleze: ${b.ownerName} confirmed ${b.title} for ${day(b.start_date)}-${day(b.end_date)}.`
        })
    },
    booking_declined: {    // → renter
        channels: ['inapp', 'email'],
        build: (u, b) => ({
            title: `Not available: ${b.title}`,
            body: `${b.ownerName} couldn’t take this request.${b.owner_note ? ` “${b.owner_note}”` : ''}`,
            link: '/browse',
            email: { subject: `${b.title} isn’t available`, heading: 'Request declined', paragraphs: [`${b.ownerName} couldn’t take your request for ${day(b.start_date)}–${day(b.end_date)}.`, 'You haven’t been charged. There are similar items nearby.'], button: { label: 'Find something similar', url: link('/browse') } }
        })
    },
    booking_cancelled: {   // → the other side
        channels: ['inapp', 'email', 'sms'],
        build: (u, b, d) => ({
            title: `Cancelled: ${b.title}`,
            body: `${d.by} cancelled the booking for ${day(b.start_date)}–${day(b.end_date)}.`,
            link: '/dashboard/bookings',
            email: { subject: `Booking cancelled: ${b.title}`, heading: 'A booking was cancelled', paragraphs: [`${d.by} cancelled ${b.title} for ${day(b.start_date)}–${day(b.end_date)}.`, d.reason ? `Note: ${d.reason}` : '', b.fulfillment === 'shipping' ? 'Any unused shipping labels were voided.' : ''].filter(Boolean), button: { label: 'View bookings', url: link('/dashboard/bookings') } },
            sms: `Rentaleze: ${b.title} (${day(b.start_date)}) was cancelled by ${d.by}.`
        })
    },
    rental_tomorrow: {     // → both (pickup)
        channels: ['inapp', 'sms'],
        build: (u, b) => ({
            title: `Tomorrow: ${b.title}`,
            body: 'Your rental starts tomorrow. Confirm the pickup time in Messages.',
            link: '/dashboard/messages',
            sms: `Rentaleze reminder: ${b.title} starts tomorrow. Confirm pickup time in Messages.`
        })
    },
    ship_reminder: {       // → owner
        channels: ['inapp', 'email', 'sms'],
        build: (u, b) => ({
            title: `Ship ${b.title} today`,
            body: `It needs to arrive by ${day(b.start_date)}. Print the send label on the Bookings page.`,
            link: '/dashboard/bookings?tab=owner',
            email: { subject: `Time to ship ${b.title}`, heading: 'Time to ship', paragraphs: [`${b.title} needs to reach ${b.renterName} by ${day(b.start_date)}.`, 'Print the prepaid send label, pack the return label in the box, and drop it off today.'], button: { label: 'Print label', url: link('/dashboard/bookings?tab=owner') } },
            sms: `Rentaleze: ship ${b.title} today so it arrives by ${day(b.start_date)}. Label: ${link('/dashboard/bookings?tab=owner')}`
        })
    },
    return_due: {          // → renter
        channels: ['inapp', 'email', 'sms'],
        build: (u, b) => ({
            title: `Return ${b.title} tomorrow`,
            body: b.fulfillment === 'shipping' ? 'Ship it back with your prepaid return label by tomorrow.' : 'Return it to the owner tomorrow.',
            link: '/dashboard/bookings',
            email: { subject: `${b.title} is due back tomorrow`, heading: 'Due back tomorrow', paragraphs: [`Your rental of ${b.title} ends ${day(b.end_date)}.`, b.fulfillment === 'shipping' ? 'Pack it the way it arrived and drop it off with the prepaid return label.' : 'Message the owner to set a return time.', 'Late returns can be charged extra days.'], button: { label: 'View booking', url: link('/dashboard/bookings') } },
            sms: `Rentaleze: ${b.title} is due back ${day(b.end_date)}.${b.fulfillment === 'shipping' ? ' Use your prepaid return label.' : ''}`
        })
    },
    return_overdue: {      // → renter (+ owner gets owner_return_overdue)
        channels: ['inapp', 'email', 'sms'],
        build: (u, b) => ({
            title: `Overdue: ${b.title}`,
            body: `This was due back ${day(b.end_date)}. Please return it as soon as you can.`,
            link: '/dashboard/bookings',
            email: { subject: `${b.title} is overdue`, heading: 'Your rental is overdue', paragraphs: [`${b.title} was due back ${day(b.end_date)}.`, 'Please return it today. Extra days may be charged, and the owner can open a claim.'], button: { label: 'View booking', url: link('/dashboard/bookings') } },
            sms: `Rentaleze: ${b.title} was due back ${day(b.end_date)}. Please return it today.`
        })
    },
    owner_return_overdue: {
        channels: ['inapp', 'email'],
        build: (u, b) => ({
            title: `Not returned yet: ${b.title}`,
            body: `${b.renterName} hasn’t returned it (due ${day(b.end_date)}). We’ve reminded them.`,
            link: '/dashboard/bookings?tab=owner',
            email: { subject: `${b.title} hasn’t been returned`, heading: 'Return is late', paragraphs: [`${b.renterName} hasn’t returned ${b.title} yet (due ${day(b.end_date)}). We’ve sent them a reminder.`, 'If it doesn’t come back, open a support ticket or a claim from the booking page.'], button: { label: 'View booking', url: link('/dashboard/bookings?tab=owner') } }
        })
    },
    booking_completed: {   // → both
        channels: ['inapp', 'email'],
        build: (u, b, d) => ({
            title: `Finished: ${b.title}`,
            body: `Leave a review for ${d.otherName}.`,
            link: `/dashboard/bookings/${b.id}`,
            email: { subject: `How did ${b.title} go?`, heading: 'Rental finished', paragraphs: [`Your rental of ${b.title} is complete.`, `Reviews help everyone on Rentaleze. How was ${d.otherName}?`], button: { label: 'Leave a review', url: link(`/dashboard/bookings/${b.id}`) } }
        })
    },

    // ─── Shipping ───────────────────────────────────────────────────────────
    labels_ready: {        // → owner
        channels: ['inapp', 'email'],
        build: (u, b) => ({
            title: `Labels ready: ${b.title}`,
            body: 'Print the send label and put the return label in the box.',
            link: '/dashboard/bookings?tab=owner',
            email: { subject: `Shipping labels ready for ${b.title}`, heading: 'Your labels are ready', paragraphs: [`Prepaid send and return labels for ${b.title} are ready.`, `Ship it so it arrives by ${day(b.start_date)}. Put the return label (or a printed copy) in the box for ${b.renterName}.`], button: { label: 'Print labels', url: link('/dashboard/bookings?tab=owner') } }
        })
    },
    label_failed: {        // → owner
        channels: ['inapp', 'email'],
        build: (u, b, d) => ({
            title: `Label problem: ${b.title}`,
            body: d.error || 'We couldn’t create the shipping label.',
            link: '/dashboard/bookings?tab=owner',
            email: { subject: `We couldn’t create a shipping label for ${b.title}`, heading: 'Shipping label problem', paragraphs: [d.error || 'The shipping label could not be created.', 'Check the package size and ship-from address on your listing, then press “Try creating labels again” on the booking.'], button: { label: 'Fix it', url: link('/dashboard/bookings?tab=owner') } }
        })
    },
    item_delivered: {      // → renter
        channels: ['inapp', 'sms'],
        build: (u, b) => ({
            title: `Delivered: ${b.title}`,
            body: `Your rental arrived. It’s due back ${day(b.end_date)}.`,
            link: `/dashboard/bookings/${b.id}`,
            sms: `Rentaleze: ${b.title} was delivered. Add check-in photos and keep the return label. Due back ${day(b.end_date)}.`
        })
    },
    owner_item_delivered: {
        channels: ['inapp'],
        build: (u, b) => ({ title: `Delivered to ${b.renterName}`, body: `${b.title} arrived. The rental is now in progress.`, link: '/dashboard/bookings?tab=owner' })
    },
    return_shipped: {      // → owner
        channels: ['inapp', 'sms'],
        build: (u, b) => ({
            title: `On its way back: ${b.title}`,
            body: `${b.renterName} shipped it back.`,
            link: '/dashboard/bookings?tab=owner',
            sms: `Rentaleze: ${b.renterName} shipped ${b.title} back to you.`
        })
    },
    return_delivered: {    // → owner
        channels: ['inapp', 'email', 'sms'],
        build: (u, b) => ({
            title: `Returned: ${b.title}`,
            body: 'It was delivered back to you. Check it over, then mark it returned.',
            link: '/dashboard/bookings?tab=owner',
            email: { subject: `${b.title} was delivered back to you`, heading: 'Your item is back', paragraphs: [`${b.title} was delivered back to you.`, 'Check it over and add return photos. If something’s wrong, open a claim within 48 hours. Otherwise, mark it returned.'], button: { label: 'Finish the rental', url: link('/dashboard/bookings?tab=owner') } },
            sms: `Rentaleze: ${b.title} was delivered back to you. Check it and mark it returned.`
        })
    },

    // ─── Support ────────────────────────────────────────────────────────────
    ticket_received: {     // → customer
        channels: ['inapp', 'email'],
        required: true,
        build: (u, t) => ({
            title: `We got your message (#${t.number})`,
            body: t.subject,
            link: `/dashboard/support/${t.id}`,
            email: { subject: `[#${t.number}] ${t.subject}`, heading: 'We got your message', paragraphs: [`Thanks for contacting Rentaleze support. Your ticket number is #${t.number}.`, 'Our team usually answers within one business day. You’ll get an email when we reply.'], button: { label: 'View ticket', url: link(`/dashboard/support/${t.id}`) }, footer: 'Support notice.' }
        })
    },
    ticket_reply: {        // → customer
        channels: ['inapp', 'email'],
        required: true,
        build: (u, t, d) => ({
            title: `Support replied (#${t.number})`,
            body: d.preview,
            link: `/dashboard/support/${t.id}`,
            email: { subject: `Re: [#${t.number}] ${t.subject}`, heading: 'Support replied to your ticket', paragraphs: [d.preview, 'Reply from the ticket page so the whole conversation stays together.'], button: { label: 'View and reply', url: link(`/dashboard/support/${t.id}`) }, footer: 'Support notice.' }
        })
    },
    ticket_solved: {
        channels: ['inapp', 'email'],
        required: true,
        build: (u, t) => ({
            title: `Ticket solved (#${t.number})`,
            body: 'Reply within 7 days if you still need help and it will reopen.',
            link: `/dashboard/support/${t.id}`,
            email: { subject: `[#${t.number}] marked solved`, heading: 'We’ve marked your ticket solved', paragraphs: [`Ticket #${t.number}: ${t.subject}`, 'Still need help? Reply on the ticket page within 7 days and it reopens.'], button: { label: 'View ticket', url: link(`/dashboard/support/${t.id}`) }, footer: 'Support notice.' }
        })
    },
    ticket_assigned: {     // → staff member
        channels: ['inapp'],
        build: (u, t) => ({ title: `Assigned to you: #${t.number}`, body: t.subject, link: `/helpdesk?ticket=${t.id}` })
    },
    ticket_customer_reply: { // → assigned staff
        channels: ['inapp'],
        build: (u, t) => ({ title: `Customer replied: #${t.number}`, body: t.subject, link: `/helpdesk?ticket=${t.id}` })
    }
}

// ─── Sending ────────────────────────────────────────────────────────────────
const pending = new Set()
// Lets tests (and shutdown) wait for background sends
export const flushNotifications = () => Promise.allSettled([...pending])

function recordDelivery(fields) {
    db.prepare(`INSERT INTO notification_deliveries (id, notification_id, user_id, type, channel, destination, status, provider_id, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), fields.notificationId || null, fields.userId, fields.type, fields.channel,
        fields.destination || null, fields.status, fields.providerId || null, fields.error ? String(fields.error).slice(0, 500) : null)
}

function track(promise) {
    pending.add(promise)
    promise.finally(() => pending.delete(promise))
}

/**
 * notify(userId, type, data, { dedupeKey, args })
 * data is the subject (booking row, ticket row, …); args are extra values for the template.
 * Returns the in-app notification id (or null if deduped / not in-app).
 */
export function notify(userId, type, data = {}, { dedupeKey = null, args = {} } = {}) {
    const ev = EVENTS[type]
    if (!ev) throw new Error(`Unknown notification type: ${type}`)
    const user = db.prepare('SELECT id, email, first_name, phone, phone_verified, notify_email, notify_sms, is_demo FROM users WHERE id = ?').get(userId)
    if (!user || user.is_demo) return null

    if (dedupeKey && db.prepare('SELECT 1 FROM notifications WHERE user_id = ? AND dedupe_key = ?').get(userId, dedupeKey)) return null

    let content
    try {
        content = ev.build(user, data, args)
    } catch (err) {
        console.error(`Notification template ${type} failed:`, err)
        return null
    }

    let notificationId = null
    // In-app row (also the dedupe record, so scheduled reminders only go once)
    if (ev.channels.includes('inapp') || dedupeKey) {
        notificationId = uuidv4()
        db.prepare(`INSERT INTO notifications (id, user_id, type, title, body, link, dedupe_key, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(notificationId, userId, type, content.title, content.body || null, content.link || null, dedupeKey,
                ev.channels.includes('inapp') ? null : new Date().toISOString())
    }

    if (ev.channels.includes('email') && content.email) {
        if (ev.required || user.notify_email !== 0) {
            const { html, text } = renderEmail(content.email)
            track(sendEmail({ to: user.email, subject: content.email.subject, html, text })
                .then(r => recordDelivery({ notificationId, userId, type, channel: 'email', destination: maskEmail(user.email), status: r.status, providerId: r.id }))
                .catch(err => { console.error(`Email ${type} failed:`, err.message); recordDelivery({ notificationId, userId, type, channel: 'email', destination: maskEmail(user.email), status: 'failed', error: err.message }) }))
        } else {
            recordDelivery({ notificationId, userId, type, channel: 'email', status: 'skipped', error: 'Emails turned off' })
        }
    }

    if (ev.channels.includes('sms') && content.sms) {
        if (user.phone && user.phone_verified === 1 && user.notify_sms !== 0) {
            track(sendSms(user.phone, content.sms.slice(0, 320))
                .then(r => recordDelivery({ notificationId, userId, type, channel: 'sms', destination: maskPhone(user.phone), status: r.status, providerId: r.id }))
                .catch(err => { console.error(`SMS ${type} failed:`, err.message); recordDelivery({ notificationId, userId, type, channel: 'sms', destination: maskPhone(user.phone), status: 'failed', error: err.message }) }))
        } else {
            recordDelivery({ notificationId, userId, type, channel: 'sms', status: 'skipped', error: user.notify_sms === 0 ? 'Texts turned off' : 'No verified phone' })
        }
    }
    return notificationId
}

// Never let a notification problem break the action that triggered it
export function safeNotify(...args) {
    try { return notify(...args) } catch (err) { console.error('Notify error:', err); return null }
}

// ─── Booking triggers ───────────────────────────────────────────────────────
function bookingInfo(bookingId) {
    const b = db.prepare(`
        SELECT b.*, l.title, l.owner_id, r.first_name AS r_first, r.last_name AS r_last, o.first_name AS o_first, o.last_name AS o_last
        FROM bookings b JOIN listings l ON l.id = b.listing_id JOIN users r ON r.id = b.user_id JOIN users o ON o.id = l.owner_id
        WHERE b.id = ?`).get(bookingId)
    if (!b) return null
    return { ...b, renterName: `${b.r_first} ${b.r_last?.[0] || ''}.`.trim(), ownerName: `${b.o_first} ${b.o_last?.[0] || ''}.`.trim() }
}

// event: created | accept | decline | cancel | pickup | return
export function bookingEvent(bookingId, event, { actorId, reason, bySupport = false } = {}) {
    try {
        const b = bookingInfo(bookingId)
        if (!b) return
        const renter = b.user_id, owner = b.owner_id
        switch (event) {
            case 'created':
                safeNotify(owner, b.status === 'accepted' ? 'booking_instant' : 'booking_requested', b)
                if (b.status === 'accepted') safeNotify(renter, 'booking_accepted', b)
                break
            case 'accept': safeNotify(renter, 'booking_accepted', b); break
            case 'decline': safeNotify(renter, 'booking_declined', b); break
            case 'cancel': {
                const by = bySupport ? 'Rentaleze support' : actorId === owner ? b.ownerName : b.renterName
                for (const uid of bySupport ? [renter, owner] : [actorId === owner ? renter : owner]) {
                    safeNotify(uid, 'booking_cancelled', b, { args: { by, reason } })
                }
                break
            }
            case 'return':
                safeNotify(renter, 'booking_completed', b, { args: { otherName: b.ownerName } })
                safeNotify(owner, 'booking_completed', b, { args: { otherName: b.renterName } })
                break
            default: break
        }
    } catch (err) {
        console.error('Booking notification error:', err)
    }
}

// event: labels_ready | label_failed | outbound_delivered | return_in_transit | return_delivered
export function shippingEvent(bookingId, event, { error, key } = {}) {
    try {
        const b = bookingInfo(bookingId)
        if (!b) return
        switch (event) {
            case 'labels_ready': safeNotify(b.owner_id, 'labels_ready', b, { dedupeKey: `labels_ready:${b.id}` }); break
            case 'label_failed': safeNotify(b.owner_id, 'label_failed', b, { args: { error }, dedupeKey: `label_failed:${b.id}:${key || error}` }); break
            case 'outbound_delivered':
                safeNotify(b.user_id, 'item_delivered', b, { dedupeKey: `delivered:${b.id}` })
                safeNotify(b.owner_id, 'owner_item_delivered', b, { dedupeKey: `delivered:${b.id}` })
                break
            case 'return_in_transit': safeNotify(b.owner_id, 'return_shipped', b, { dedupeKey: `return_shipped:${b.id}` }); break
            case 'return_delivered': safeNotify(b.owner_id, 'return_delivered', b, { dedupeKey: `return_delivered:${b.id}` }); break
            default: break
        }
    } catch (err) {
        console.error('Shipping notification error:', err)
    }
}

// ─── Scheduled triggers (run every 15 minutes) ─────────────────────────────
const isoDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)

export function runScheduledJobs() {
    const counts = {}
    const send = (uid, type, b, key, args) => { if (safeNotify(uid, type, b, { dedupeKey: key, args })) counts[type] = (counts[type] || 0) + 1 }
    const rows = (sql, ...p) => db.prepare(sql).all(...p).map(r => bookingInfo(r.id)).filter(Boolean)

    // Pickup rentals starting tomorrow → both sides
    for (const b of rows(`SELECT id FROM bookings WHERE status = 'accepted' AND fulfillment = 'pickup' AND start_date = ?`, isoDay(1))) {
        send(b.user_id, 'rental_tomorrow', b, `rental_tomorrow:${b.id}`)
        send(b.owner_id, 'rental_tomorrow', b, `rental_tomorrow:${b.id}`)
    }
    // Shipped rentals starting within 3 days whose send label hasn't been scanned → owner
    for (const b of rows(`
        SELECT b.id FROM bookings b JOIN shipments s ON s.booking_id = b.id AND s.direction = 'outbound' AND s.status = 'created'
        WHERE b.status = 'accepted' AND b.fulfillment = 'shipping' AND b.start_date <= ? AND COALESCE(s.tracking_status, 'UN') IN ('UN', 'NY')`, isoDay(3))) {
        send(b.owner_id, 'ship_reminder', b, `ship_reminder:${b.id}`)
    }
    // Due back tomorrow → renter
    for (const b of rows(`SELECT id FROM bookings WHERE status = 'active' AND end_date = ?`, isoDay(1))) {
        send(b.user_id, 'return_due', b, `return_due:${b.id}`)
    }
    // Overdue (a day past the end date, not returned) → renter and owner, once
    for (const b of rows(`SELECT id FROM bookings WHERE status = 'active' AND end_date < ?`, isoDay(0))) {
        send(b.user_id, 'return_overdue', b, `return_overdue:${b.id}`)
        send(b.owner_id, 'owner_return_overdue', b, `return_overdue:${b.id}`)
    }
    // Signed up over a day ago (but under two weeks) and still not verified → one reminder
    const unverified = db.prepare(`
        SELECT id FROM users WHERE COALESCE(is_demo, 0) = 0 AND COALESCE(suspended, 0) = 0 AND role NOT IN ('admin', 'support')
          AND (COALESCE(is_verified, 0) != 1 OR COALESCE(phone_verified, 0) != 1)
          AND created_at < datetime('now', '-1 day') AND created_at > datetime('now', '-14 days')`).all()
    for (const u of unverified) send(u.id, 'verification_reminder', {}, 'verification_reminder:1')
    // Solved tickets with no reply for 7 days close themselves
    const closed = db.prepare(`UPDATE support_tickets SET status = 'closed', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'solved' AND updated_at < datetime('now', '-7 days')`).run().changes
    if (closed) counts.tickets_closed = closed
    return counts
}

let timer = null
export function startScheduler() {
    if (timer || process.env.DISABLE_SCHEDULER === 'true') return
    const run = () => { try { const c = runScheduledJobs(); if (Object.keys(c).length) console.log('🔔 Reminders sent:', c) } catch (err) { console.error('Scheduler error:', err) } }
    setTimeout(run, 30 * 1000).unref()
    timer = setInterval(run, 15 * 60 * 1000)
    timer.unref()
}
