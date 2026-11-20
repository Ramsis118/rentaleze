// End-to-end check of ShipStation shipping: package dimensions, quotes, send + return labels.
// Runs the server on a throwaway database with no SHIPSTATION_API_KEY (mock mode).
//   node server/scripts/smoke-shipping.js
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rentaleze-ship-'))
const PORT = 3998
const BASE = `http://localhost:${PORT}/api`
const DB_PATH = path.join(tmp, 'test.db')
const env = {
    ...process.env, PORT: String(PORT), NODE_ENV: 'development', SHOW_DEMO_LISTINGS: 'false',
    DB_PATH, UPLOADS_DIR: path.join(tmp, 'uploads'), BETA_PASSWORD: '', WAITLIST_HOSTS: '',
    SHIPSTATION_API_KEY: '', SHIPSTATION_WEBHOOK_TOKEN: 'hook-secret-123'
}
fs.mkdirSync(path.join(tmp, 'uploads', 'listings'), { recursive: true })
fs.mkdirSync(path.join(tmp, 'uploads', 'avatars'), { recursive: true })
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
    return { token: r.data.accessToken, user: r.data.user }
}
const isoDay = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)

const shipFrom = { name: 'Olivia Owner', phone: '4045550100', line1: '100 Peachtree St NW', city: 'Atlanta', state: 'ga', zip: '30303' }
const pkg = { lengthIn: 24, widthIn: 14, heightIn: 12, weightLb: 18 }
const baseListing = {
    title: 'Pressure washer', category: 'tools', pricePerDay: 30, location: 'Atlanta, GA',
    images: ['https://example.com/a.jpg'], shipping: true, status: 'active'
}
const deliver = { fulfillment: 'shipping', shippingAddress: '1 Main St', shippingCity: 'Decatur', shippingState: 'GA', shippingZip: '30030' }

async function main() {
    for (let i = 0; i < 40; i++) {
        try { if ((await fetch(`${BASE}/health`)).ok) break } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 250))
    }

    const owner = await signup('owner@ship.test', 'Olivia')
    const renter = await signup('renter@ship.test', 'Ray')
    const db = new Database(DB_PATH)
    db.prepare('UPDATE users SET is_verified = 1, phone_verified = 1, phone = ? WHERE id = ?').run('+14045550101', renter.user.id)
    db.prepare('UPDATE users SET is_verified = 1, phone_verified = 1 WHERE id = ?').run(owner.user.id)

    console.log('Listing dimensions')
    let r = await call('POST', '/listings', { token: owner.token, body: baseListing })
    check('shipping listing without size is rejected', r.status === 400 && /size and weight/i.test(r.data.error), JSON.stringify(r.data))
    r = await call('POST', '/listings', { token: owner.token, body: { ...baseListing, package: pkg } })
    check('shipping listing without ship-from is rejected', r.status === 400 && /ship-from/i.test(r.data.error), JSON.stringify(r.data))
    r = await call('POST', '/listings', { token: owner.token, body: { ...baseListing, package: { ...pkg, lengthIn: 200 } , shipFrom } })
    check('oversized side is rejected', r.status === 400 && /Length/i.test(r.data.error), JSON.stringify(r.data))
    r = await call('POST', '/listings', { token: owner.token, body: { ...baseListing, package: { ...pkg, weightLb: 0 }, shipFrom } })
    check('zero weight is rejected', r.status === 400 && /weight/i.test(r.data.error))
    r = await call('POST', '/listings', { token: owner.token, body: { ...baseListing, package: pkg, shipFrom } })
    check('shipping listing with size + address is created', r.status === 201, JSON.stringify(r.data))
    const listing = r.data
    check('package returned in lb/in', listing.package?.weightLb === 18 && listing.package?.lengthIn === 24)
    check('owner sees ship-from, state normalized', listing.shipFrom?.state === 'GA' && listing.shipFrom?.zip === '30303')
    const pub = await call('GET', `/listings/${listing.id}`, { token: renter.token })
    check('renter sees package but not the address', pub.data.package?.heightIn === 12 && pub.data.shipFrom === undefined)
    const browse = await call('GET', '/listings?shipping=true')
    check('browse never exposes ship-from', browse.data.listings.every(l => l.shipFrom === undefined))
    const stored = db.prepare('SELECT ship_weight_oz FROM listings WHERE id = ?').get(listing.id)
    check('weight stored in ounces', stored.ship_weight_oz === 288)

    r = await call('PUT', `/listings/${listing.id}`, { token: owner.token, body: { package: null } })
    check('cannot clear size on an active shipping listing', r.status === 400)
    r = await call('PUT', `/listings/${listing.id}`, { token: owner.token, body: { package: { ...pkg, weightLb: 20 } } })
    check('owner can update package size', r.status === 200 && r.data.package.weightLb === 20)

    console.log('Quotes')
    r = await call('GET', `/shipping/quote?listingId=${listing.id}&zip=30030`)
    check('quote is a live estimate in mock mode', r.status === 200 && r.data.estimated === true && r.data.fee > 0, JSON.stringify(r.data))
    check('quote covers both directions', Math.abs(r.data.fee - (r.data.outbound + r.data.return)) < 0.02)
    const quotedFee = r.data.fee
    r = await call('GET', `/shipping/quote?listingId=${listing.id}&zip=abc`)
    check('bad ZIP falls back to the flat fee', r.status === 200 && r.data.estimated === false && r.data.fee === 24)
    const pickupOnly = await call('POST', '/listings', { token: owner.token, body: { ...baseListing, title: 'Ladder', shipping: false } })
    r = await call('GET', `/shipping/quote?listingId=${pickupOnly.data.id}&zip=30030`)
    check('pickup-only listing has no quote', r.status === 400)

    console.log('Request → accept → labels')
    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(3), endDate: isoDay(6), fulfillment: 'shipping' } })
    check('shipping booking needs an address', r.status === 400 && /Delivery address/.test(r.data.error))
    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: pickupOnly.data.id, startDate: isoDay(3), endDate: isoDay(6), ...deliver } })
    check('cannot ship a pickup-only item', r.status === 400)
    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(3), endDate: isoDay(6), ...deliver } })
    check('shipping booking created', r.status === 201, JSON.stringify(r.data))
    const booking = r.data
    check('booking charges the quoted round-trip fee', booking.shippingFee === quotedFee && booking.shippingEstimated === true, `${booking.shippingFee} vs ${quotedFee}`)
    check('total includes shipping', Math.abs(booking.total - (booking.baseTotal + booking.serviceFee + booking.shippingFee)) < 0.01)
    check('no labels before the owner accepts', booking.shipments.length === 0)

    r = await call('PUT', `/bookings/${booking.id}/accept`, { token: owner.token })
    check('owner accepts', r.status === 200 && r.data.status === 'accepted')
    const out = r.data.shipments.find(s => s.direction === 'outbound')
    const ret = r.data.shipments.find(s => s.direction === 'return')
    check('send label created on accept', out?.status === 'created' && !!out.trackingNumber, JSON.stringify(r.data.shipments))
    check('return label created on accept', ret?.status === 'created' && !!ret.trackingNumber)
    check('labels marked as test (mock)', out?.mode === 'mock')

    r = await call('GET', `/shipping/bookings/${booking.id}`, { token: renter.token })
    check('renter sees both labels', r.status === 200 && r.data.shipments.length === 2)
    const stranger = await signup('x@ship.test', 'Xena')
    r = await call('GET', `/shipping/bookings/${booking.id}`, { token: stranger.token })
    check('stranger cannot see shipping', r.status === 403)

    r = await call('POST', `/shipping/bookings/${booking.id}/labels`, { token: owner.token })
    check('retry is idempotent (still 2 labels)', r.status === 200 && r.data.shipments.length === 2)
    r = await call('POST', `/shipping/bookings/${booking.id}/labels`, { token: renter.token })
    check('renter cannot buy labels', r.status === 403)

    console.log('Tracking webhook')
    r = await call('POST', '/shipping/webhook?token=wrong', { body: { data: { tracking_number: out.trackingNumber, status_code: 'DE' } } })
    check('webhook rejects a bad token', r.status === 401)
    r = await call('POST', '/shipping/webhook?token=hook-secret-123', { body: { resource_type: 'API_TRACK', data: { tracking_number: out.trackingNumber, status_code: 'IT', status_description: 'In Transit' } } })
    check('webhook updates tracking', r.status === 200 && r.data.updated === 1)
    r = await call('POST', '/shipping/webhook?token=hook-secret-123', { body: { data: { tracking_number: out.trackingNumber, status_code: 'DE', status_description: 'Delivered' } } })
    const after = (await call('GET', '/bookings/my', { token: renter.token })).data.find(b => b.id === booking.id)
    check('delivery of the send label starts the rental', after.status === 'active', after.status)
    check('tracking text shown', after.shipments.find(s => s.direction === 'outbound').trackingDescription === 'Delivered')

    console.log('Instant Book + cancel voids labels')
    await call('PUT', `/listings/${listing.id}`, { token: owner.token, body: { instantBook: true } })
    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(20), endDate: isoDay(22), ...deliver } })
    check('instant booking buys labels immediately', r.status === 201 && r.data.status === 'accepted' && r.data.shipments.filter(s => s.status === 'created').length === 2, JSON.stringify(r.data.shipments))
    const ib = r.data
    r = await call('PUT', `/bookings/${ib.id}/cancel`, { token: renter.token })
    check('cancel succeeds', r.status === 200 && r.data.status === 'cancelled')
    const rows = db.prepare('SELECT status FROM shipments WHERE booking_id = ?').all(ib.id)
    check('both labels voided on cancel', rows.length === 2 && rows.every(x => x.status === 'voided'), JSON.stringify(rows))
    check('voided labels hidden from booking', r.data.shipments.length === 0)

    console.log('Missing data is reported, not crashed')
    db.prepare('UPDATE listings SET ship_from = NULL WHERE id = ?').run(listing.id)
    r = await call('POST', '/bookings', { token: renter.token, body: { listingId: listing.id, startDate: isoDay(30), endDate: isoDay(32), ...deliver } })
    check('booking still created (flat fee fallback)', r.status === 201 && r.data.shippingFee === 24 && r.data.shippingEstimated === false, JSON.stringify(r.data))
    const ownerView = (await call('GET', '/bookings/rentals', { token: owner.token })).data.find(b => b.id === r.data.id)
    const errRow = ownerView.shipments.find(s => s.status === 'error')
    check('owner sees the label error', /ship-from/i.test(errRow?.error || ''), JSON.stringify(ownerView.shipments))
    const renterView = (await call('GET', '/bookings/my', { token: renter.token })).data.find(b => b.id === r.data.id)
    check('renter does not see the error details', renterView.shipments.length === 0)
    db.prepare('UPDATE listings SET ship_from = ? WHERE id = ?').run(JSON.stringify({ ...shipFrom, state: 'GA' }), listing.id)
    r = await call('POST', `/shipping/bookings/${r.data.id}/labels`, { token: owner.token })
    check('retry after fixing the address creates both labels', r.data.shipments.filter(s => s.status === 'created').length === 2 && !r.data.shipments.some(s => s.status === 'error'))

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
        setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* Windows may hold the db open briefly */ } }, 1000)
    })
