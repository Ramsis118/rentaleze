// Shipping for rentals: price quotes from the item's packed size, and the
// send + return labels bought through ShipStation once a shipped rental is confirmed.
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import {
    shipstationMode, estimateRate, createOutboundLabel, createReturnLabel, voidLabel, trackLabel
} from './shipstation.js'

export const FLAT_SHIPPING_FEE = () => Number(process.env.SHIPPING_FLAT_FEE) || 24
const HANDLING_FEE = () => Number(process.env.SHIPPING_HANDLING_FEE) || 0   // added once per round trip
const centsUp = (n) => Math.ceil(n * 100 - 1e-9) / 100

const parseJSON = (v) => { try { return v ? JSON.parse(v) : null } catch { return null } }
const ZIP_RE = /^\d{5}$/
const STATE_RE = /^[A-Z]{2}$/

// ─── Package and addresses ──────────────────────────────────────────────────
export const PACKAGE_LIMITS = { maxWeightLb: 150, maxSideIn: 108, maxLengthPlusGirthIn: 165 }

export function listingPackage(row) {
    const p = {
        weightOz: Number(row.ship_weight_oz),
        lengthIn: Number(row.ship_length_in),
        widthIn: Number(row.ship_width_in),
        heightIn: Number(row.ship_height_in)
    }
    return Object.values(p).every(n => Number.isFinite(n) && n > 0) ? p : null
}

// Validate the size fields from the listing form. Weight arrives in pounds.
export function validatePackage(body) {
    const errors = []
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
    const lb = num(body.weightLb), l = num(body.lengthIn), w = num(body.widthIn), h = num(body.heightIn)
    if ([lb, l, w, h].every(v => v === null)) return { errors, data: null }
    if (!(lb > 0 && lb <= PACKAGE_LIMITS.maxWeightLb)) errors.push(`Packed weight must be between 0.1 and ${PACKAGE_LIMITS.maxWeightLb} lb`)
    for (const [name, v] of [['Length', l], ['Width', w], ['Height', h]]) {
        if (!(v >= 1 && v <= PACKAGE_LIMITS.maxSideIn)) errors.push(`${name} must be between 1 and ${PACKAGE_LIMITS.maxSideIn} inches`)
    }
    if (!errors.length) {
        const [longest, ...rest] = [l, w, h].sort((a, b) => b - a)
        if (longest + 2 * (rest[0] + rest[1]) > PACKAGE_LIMITS.maxLengthPlusGirthIn) {
            errors.push(`That box is too big to ship by parcel (length + girth over ${PACKAGE_LIMITS.maxLengthPlusGirthIn} in)`)
        }
    }
    const r1 = (n) => Math.round(n * 10) / 10
    return { errors, data: errors.length ? null : { ship_weight_oz: r1(lb * 16), ship_length_in: r1(l), ship_width_in: r1(w), ship_height_in: r1(h) } }
}

// Address in / out: { name, phone, line1, line2, city, state, zip }
export function validateAddress(a, label = 'Address') {
    const errors = []
    const s = (v, max) => String(v ?? '').trim().slice(0, max)
    const out = {
        name: s(a?.name, 80),
        phone: s(a?.phone, 20),
        line1: s(a?.line1, 100),
        line2: s(a?.line2, 100),
        city: s(a?.city, 60),
        state: s(a?.state, 2).toUpperCase(),
        zip: s(a?.zip, 10).slice(0, 5)
    }
    if (!out.name) errors.push(`${label}: add a name`)
    if (!out.line1) errors.push(`${label}: add a street address`)
    if (!out.city) errors.push(`${label}: add a city`)
    if (!STATE_RE.test(out.state)) errors.push(`${label}: use a 2-letter state, like GA`)
    if (!ZIP_RE.test(out.zip)) errors.push(`${label}: use a 5-digit ZIP code`)
    return { errors, data: errors.length ? null : out }
}

export const listingShipFrom = (row) => parseJSON(row.ship_from)

// What the public can see about the package (never the address)
export function publicPackage(row) {
    const p = listingPackage(row)
    if (!p) return null
    return { weightLb: Math.round((p.weightOz / 16) * 10) / 10, lengthIn: p.lengthIn, widthIn: p.widthIn, heightIn: p.heightIn }
}

// ─── Quotes ─────────────────────────────────────────────────────────────────
const quoteCache = new Map()
const QUOTE_TTL_MS = 30 * 60 * 1000

// Round-trip price for a shipped rental (send + return). Falls back to the flat fee.
export async function quoteShipping(listingRow, to) {
    const flat = { fee: FLAT_SHIPPING_FEE(), estimated: false }
    const pkg = listingPackage(listingRow)
    const from = listingShipFrom(listingRow)
    if (!pkg || !from) return { ...flat, reason: 'The owner has not added the package size yet.' }
    if (!ZIP_RE.test(to?.zip || '')) return { ...flat, reason: 'Enter a ZIP code for an exact price.' }
    if (shipstationMode() === 'off') return { ...flat, reason: 'Live rates are not set up yet.' }

    const key = [listingRow.id, listingRow.updated_at, to.zip, to.state || ''].join('|')
    const hit = quoteCache.get(key)
    if (hit && hit.at > Date.now() - QUOTE_TTL_MS) return hit.quote

    try {
        const out = await estimateRate({ from, to, pkg })
        if (!out) return { ...flat, reason: 'No carrier rate was available for this route.' }
        const back = await estimateRate({ from: to, to: from, pkg }).catch(() => null) || out
        const quote = {
            fee: centsUp(out.amount + back.amount + HANDLING_FEE()),
            estimated: true,
            outbound: out.amount,
            return: back.amount,
            deliveryDays: out.deliveryDays,
            service: out.serviceCode
        }
        quoteCache.set(key, { at: Date.now(), quote })
        if (quoteCache.size > 2000) quoteCache.delete(quoteCache.keys().next().value)
        return quote
    } catch (err) {
        console.error('Shipping quote error:', err.message)
        return { ...flat, reason: 'Live rates are unavailable right now.' }
    }
}

// ─── Labels ─────────────────────────────────────────────────────────────────
const BOOKING_SHIP_SELECT = `
    SELECT b.*, l.title, l.owner_id, l.ship_from, l.ship_weight_oz, l.ship_length_in, l.ship_width_in, l.ship_height_in,
           o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone,
           r.first_name AS renter_first, r.last_name AS renter_last, r.phone AS renter_phone
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users o ON o.id = l.owner_id
    JOIN users r ON r.id = b.user_id
    WHERE b.id = ?
`

const insertShipment = (bookingId, direction, fields) => db.prepare(`
    INSERT INTO shipments (id, booking_id, direction, status, mode, label_id, shipment_id, carrier_code, service_code,
        tracking_number, label_url, cost, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(uuidv4(), bookingId, direction, fields.status, fields.mode || null, fields.labelId || null, fields.shipmentId || null,
    fields.carrierCode || null, fields.serviceCode || null, fields.trackingNumber || null, fields.labelUrl || null,
    fields.cost ?? null, fields.error || null)

const clearErrors = (bookingId, direction) =>
    db.prepare(`DELETE FROM shipments WHERE booking_id = ? AND direction = ? AND status = 'error'`).run(bookingId, direction)

const activeLabel = (bookingId, direction) =>
    db.prepare(`SELECT * FROM shipments WHERE booking_id = ? AND direction = ? AND status = 'created' ORDER BY created_at DESC LIMIT 1`)
        .get(bookingId, direction)

const recordError = (bookingId, direction, message) => {
    clearErrors(bookingId, direction)
    insertShipment(bookingId, direction, { status: 'error', mode: shipstationMode(), error: String(message).slice(0, 500) })
}

const inflight = new Map()

// Buy the send label, then the return label. Safe to call repeatedly: labels that exist are kept.
export function generateLabelsForBooking(bookingId) {
    if (!inflight.has(bookingId)) {
        inflight.set(bookingId, buyLabels(bookingId).finally(() => inflight.delete(bookingId)))
    }
    return inflight.get(bookingId)
}

async function buyLabels(bookingId) {
    const b = db.prepare(BOOKING_SHIP_SELECT).get(bookingId)
    if (!b || b.fulfillment !== 'shipping' || !['accepted', 'active'].includes(b.status)) return []

    const pkg = listingPackage(b)
    const from = listingShipFrom(b)
    const shipFrom = from && { ...from, phone: from.phone || b.owner_phone || '' }
    const shipTo = {
        name: b.shipping_name || `${b.renter_first} ${b.renter_last}`,
        phone: b.shipping_phone || b.renter_phone || '',
        line1: b.shipping_address, line2: '', city: b.shipping_city, state: b.shipping_state, zip: b.shipping_zip
    }

    let outbound = activeLabel(b.id, 'outbound')
    if (!outbound) {
        const problem = !pkg ? 'The listing is missing its package size and weight.'
            : !from ? 'The listing is missing its ship-from address.'
                : validateAddress(shipTo, 'Renter address').errors[0]
        if (problem) {
            recordError(b.id, 'outbound', problem)
            return getShipments(b.id)
        }
        try {
            const label = await createOutboundLabel({ shipFrom, shipTo, pkg, externalId: `rentaleze-${b.id}-out` })
            clearErrors(b.id, 'outbound')
            insertShipment(b.id, 'outbound', { ...label, status: 'created' })
            outbound = activeLabel(b.id, 'outbound')
        } catch (err) {
            console.error(`Outbound label failed for booking ${b.id}:`, err.message)
            recordError(b.id, 'outbound', err.message)
            return getShipments(b.id)
        }
    }

    if (!activeLabel(b.id, 'return')) {
        try {
            const label = await createReturnLabel(outbound.label_id, pkg || { weightOz: 16, lengthIn: 6, widthIn: 6, heightIn: 6 })
            clearErrors(b.id, 'return')
            insertShipment(b.id, 'return', { ...label, status: 'created' })
        } catch (err) {
            console.error(`Return label failed for booking ${b.id}:`, err.message)
            recordError(b.id, 'return', err.message)
        }
    }
    return getShipments(b.id)
}

// Void labels that haven't been used (booking cancelled or declined)
export async function voidLabelsForBooking(bookingId) {
    const rows = db.prepare(`SELECT * FROM shipments WHERE booking_id = ? AND status = 'created'`).all(bookingId)
    for (const s of rows) {
        if (s.tracking_status && !['UN', 'AC', 'NY'].includes(s.tracking_status)) continue // already moving — can't void
        try {
            const r = await voidLabel(s.label_id)
            db.prepare(`UPDATE shipments SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                .run(r?.approved === false ? 'created' : 'voided', r?.approved === false ? (r.message || 'Void not approved') : null, s.id)
        } catch (err) {
            console.error(`Void label ${s.label_id} failed:`, err.message)
            db.prepare(`UPDATE shipments SET error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(`Void failed: ${err.message}`.slice(0, 500), s.id)
        }
    }
}

// ─── Tracking ───────────────────────────────────────────────────────────────
const TRACK_URLS = {
    usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
    stamps_com: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
    ups: 'https://www.ups.com/track?tracknum=',
    fedex: 'https://www.fedex.com/fedextrack/?trknbr=',
    dhl_express: 'https://www.dhl.com/us-en/home/tracking.html?tracking-id='
}
const TRACK_LABELS = { AC: 'Accepted by carrier', IT: 'In transit', DE: 'Delivered', EX: 'Delivery problem', AT: 'Delivery attempted', NY: 'Not yet in system', UN: 'Label created' }

// Apply a tracking event (from the ShipStation webhook or a poll)
export function applyTrackingUpdate({ trackingNumber, statusCode, description }) {
    if (!trackingNumber) return 0
    const rows = db.prepare(`SELECT * FROM shipments WHERE tracking_number = ? AND status = 'created'`).all(trackingNumber)
    for (const s of rows) {
        db.prepare(`UPDATE shipments SET tracking_status = ?, tracking_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(statusCode || s.tracking_status, String(description || TRACK_LABELS[statusCode] || '').slice(0, 200), s.id)
        // Item reached the renter → rental is in progress
        if (s.direction === 'outbound' && statusCode === 'DE') {
            db.prepare(`UPDATE bookings SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'accepted'`).run(s.booking_id)
        }
    }
    return rows.length
}

// Pull fresh tracking for a booking's labels at most every 30 minutes (live mode only)
export async function refreshTracking(bookingId) {
    if (shipstationMode() !== 'live') return
    const rows = db.prepare(`
        SELECT * FROM shipments WHERE booking_id = ? AND status = 'created' AND COALESCE(tracking_status, '') != 'DE'
          AND updated_at < datetime('now', '-30 minutes')
    `).all(bookingId)
    for (const s of rows) {
        try {
            const t = await trackLabel(s.label_id)
            if (t) applyTrackingUpdate({ trackingNumber: s.tracking_number, statusCode: t.status_code, description: t.status_description })
            else db.prepare(`UPDATE shipments SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(s.id)
        } catch (err) {
            console.error(`Tracking refresh failed for ${s.label_id}:`, err.message)
            db.prepare(`UPDATE shipments SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(s.id)
        }
    }
}

// Shipments as each side of the rental should see them
export function getShipments(bookingId, role = 'owner') {
    const rows = db.prepare(`SELECT * FROM shipments WHERE booking_id = ? AND status != 'voided' ORDER BY direction DESC, created_at`).all(bookingId)
    return rows
        .filter(s => role === 'owner' || s.status === 'created')
        .map(s => ({
            direction: s.direction,
            status: s.status,
            mode: s.mode,
            carrier: s.carrier_code,
            service: s.service_code,
            trackingNumber: s.tracking_number,
            trackingUrl: s.tracking_number && s.mode === 'live' && TRACK_URLS[s.carrier_code] ? TRACK_URLS[s.carrier_code] + encodeURIComponent(s.tracking_number) : null,
            trackingStatus: s.tracking_status || null,
            trackingDescription: s.tracking_description || (s.status === 'created' ? TRACK_LABELS.UN : null),
            // The owner prints both labels; the renter only needs the return label
            labelUrl: role === 'owner' || s.direction === 'return' ? s.label_url : null,
            error: role === 'owner' ? s.error : null,
            createdAt: s.created_at
        }))
}
