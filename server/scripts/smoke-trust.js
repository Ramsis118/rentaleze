// End-to-end check of verification, photos, reviews, claims and admin.
// Starts the server on a throwaway database in development mode (no Stripe/Twilio keys needed).
//   node server/scripts/smoke-trust.js
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rentaleze-smoke-'))
const PORT = 3999
const BASE = `http://localhost:${PORT}/api`
const env = {
    ...process.env, PORT: String(PORT), NODE_ENV: 'development', SHOW_DEMO_LISTINGS: 'false',
    DB_PATH: path.join(tmp, 'test.db'), UPLOADS_DIR: path.join(tmp, 'uploads'),
    ADMIN_EMAILS: 'admin@smoke.test', STRIPE_SECRET_KEY: '', TWILIO_ACCOUNT_SID: '', BETA_PASSWORD: '', WAITLIST_HOSTS: ''
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

async function call(method, url, { token, body, form } = {}) {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(url.startsWith('http') ? url : BASE + url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) })
    const text = await res.text()
    let data; try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, data }
}

const signup = async (email, firstName) => {
    const r = await call('POST', '/auth/signup', { body: { email, password: 'password123', firstName, lastName: 'Tester', role: 'both' } })
    if (r.status !== 201) throw new Error(`signup ${email}: ${JSON.stringify(r.data)}`)
    return { token: r.data.accessToken, user: r.data.user }
}

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const photoForm = () => { const f = new FormData(); f.append('photos', new Blob([PNG], { type: 'image/png' }), 'item.png'); return f }
const isoDay = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)

async function main() {
    for (let i = 0; i < 40; i++) {
        try { if ((await fetch(`${BASE}/health`)).ok) break } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 250))
    }

    console.log('Accounts & verification')
    const owner = await signup('owner@smoke.test', 'Olivia')
    const renter = await signup('renter@smoke.test', 'Ray')
    const admin = await signup('admin@smoke.test', 'Ada')
    check('admin flag comes from ADMIN_EMAILS', admin.user.isAdmin === true && owner.user.isAdmin === false)

    check('old ID upload route is gone (410)', (await call('POST', '/users/profile/verification', { token: renter.token })).status === 410)
    let st = await call('GET', '/verification/status', { token: renter.token })
    check('status starts unverified', st.status === 200 && st.data.idStatus === 'none' && !st.data.phoneVerified)

    const early = await call('POST', '/bookings', { token: renter.token, body: { listingId: 'x', startDate: isoDay(1), endDate: isoDay(3) } })
    check('unverified renter cannot book', early.status === 403)

    check('bad phone rejected', (await call('POST', '/verification/phone/send', { token: renter.token, body: { phone: '123' } })).status === 400)
    const sent = await call('POST', '/verification/phone/send', { token: renter.token, body: { phone: '(404) 555-0101' } })
    check('code sent, phone normalized', sent.status === 200 && sent.data.phone === '+14045550101', JSON.stringify(sent.data))
    check('wrong code rejected', (await call('POST', '/verification/phone/check', { token: renter.token, body: { code: '000000' } })).status === 400)
    st = await call('POST', '/verification/phone/check', { token: renter.token, body: { code: '123456' } })
    check('right code verifies phone', st.status === 200 && st.data.phoneVerified)
    const dup = await call('POST', '/verification/phone/send', { token: owner.token, body: { phone: '4045550101' } })
    check('same phone blocked on a second account', dup.status === 409)

    const start = await call('POST', '/verification/identity/start', { token: renter.token })
    check('identity start in dev mode', start.status === 200 && start.data.dev === true)
    st = await call('POST', '/verification/identity/dev-complete', { token: renter.token })
    check('renter fully verified', st.data.fullyVerified === true)

    console.log('Booking with photos')
    const listing = await call('POST', '/listings', {
        token: owner.token,
        body: { title: 'DeWalt drill kit', description: 'Cordless drill', category: 'tools', pricePerDay: 20, location: 'Atlanta, GA',
            images: ['https://images.example.com/drill.jpg'], status: 'active' }
    })
    check('owner creates listing', listing.status === 201, JSON.stringify(listing.data))
    const lid = listing.data.id

    const bk = await call('POST', '/bookings', { token: renter.token, body: { listingId: lid, startDate: isoDay(0), endDate: isoDay(2) } })
    check('renter books', bk.status === 201, JSON.stringify(bk.data))
    const bid = bk.data.id

    check('admin can open any booking', (await call('GET', `/bookings/${bid}/trust`, { token: admin.token })).status === 200)
    const stranger = await signup('stranger@smoke.test', 'Sam')
    check('stranger blocked from trust page', (await call('GET', `/bookings/${bid}/trust`, { token: stranger.token })).status === 403)

    check('no pickup photos before accept', (await call('POST', `/bookings/${bid}/photos?stage=pickup`, { token: owner.token, form: photoForm() })).status === 400)
    await call('PUT', `/bookings/${bid}/accept`, { token: owner.token })
    const up = await call('POST', `/bookings/${bid}/photos?stage=pickup`, { token: owner.token, form: photoForm() })
    check('owner adds pickup photo', up.status === 201 && up.data.photos.pickup.length === 1, JSON.stringify(up.data))

    const url = up.data.photos.pickup[0].url
    const img = await fetch(`http://localhost:${PORT}${url}`)
    check('signed photo link works', img.ok && img.headers.get('content-type')?.includes('image'))
    const bad = await fetch(`http://localhost:${PORT}${url.replace(/sig=[a-f0-9]{4}/, 'sig=0000')}`)
    check('tampered photo link refused', bad.status === 403)

    check('no review before completion', (await call('POST', `/bookings/${bid}/review`, { token: renter.token, body: { rating: 5, text: 'Great drill, worked well' } })).status === 400)
    await call('PUT', `/bookings/${bid}/pickup`, { token: owner.token })
    const ret = await call('PUT', `/bookings/${bid}/return`, { token: owner.token })
    check('booking completed with return time', ret.data.status === 'completed' && !!ret.data.returnedAt, JSON.stringify(ret.data))
    check('renter adds return photo', (await call('POST', `/bookings/${bid}/photos?stage=return`, { token: renter.token, form: photoForm() })).status === 201)

    console.log('Reviews')
    check('short review rejected', (await call('POST', `/bookings/${bid}/review`, { token: renter.token, body: { rating: 5, text: 'ok' } })).status === 400)
    const rv = await call('POST', `/bookings/${bid}/review`, { token: renter.token, body: { rating: 4, text: 'Drill was great, pickup was easy.' } })
    check('renter reviews', rv.status === 201 && rv.data.review.mine.rating === 4)
    check('duplicate review blocked', (await call('POST', `/bookings/${bid}/review`, { token: renter.token, body: { rating: 4, text: 'Again again again' } })).status === 409)
    let ot = await call('GET', `/bookings/${bid}/trust`, { token: owner.token })
    check('double-blind: owner cannot see it yet', ot.data.review.theirs === null && ot.data.review.theirsPending === true)
    ot = await call('POST', `/bookings/${bid}/review`, { token: owner.token, body: { rating: 5, text: 'Ray returned it clean and on time.' } })
    check('owner reviews, now sees renter review', ot.status === 201 && ot.data.review.theirs?.rating === 4)
    const lst = await call('GET', `/listings/${lid}`)
    check('listing rating updated, owner review not shown on listing', lst.data.rating === 4 && lst.data.reviewCount === 1 && lst.data.reviews.length === 1)
    const prof = await call('GET', `/users/${renter.user.id}/public`)
    check('renter public profile shows owner review', prof.data.asRenter.count === 1 && prof.data.idVerified === true)

    console.log('Claims & admin')
    const cl = await call('POST', `/bookings/${bid}/claims`, { token: owner.token, body: { type: 'damage', description: 'Chuck is cracked and the battery will not charge.', amountRequested: 80 } })
    check('owner files claim', cl.status === 201 && cl.data.claims.length === 1, JSON.stringify(cl.data))
    const claimId = cl.data.claims[0].id
    check('second open claim blocked', (await call('POST', `/bookings/${bid}/claims`, { token: owner.token, body: { type: 'other', description: 'Another problem with this item here.', amountRequested: 0 } })).status === 409)
    check('evidence photo allowed', (await call('POST', `/bookings/${bid}/photos?stage=claim`, { token: owner.token, form: photoForm() })).status === 201)
    const reply = await call('POST', `/bookings/${bid}/claims/${claimId}/comment`, { token: renter.token, body: { body: 'It was already cracked at pickup, see photos.' } })
    check('renter replies', reply.status === 200 && reply.data.claims[0].events.length === 2)

    check('non-admin blocked from admin API', (await call('GET', '/admin/stats', { token: owner.token })).status === 403)
    const stats = await call('GET', '/admin/stats', { token: admin.token })
    check('admin stats', stats.status === 200 && stats.data.claims.open === 1 && stats.data.users.total === 4, JSON.stringify(stats.data))
    const q = await call('GET', '/admin/claims', { token: admin.token })
    check('claim in admin queue', q.data.claims?.[0]?.id === claimId)
    const det = await call('GET', `/admin/claims/${claimId}`, { token: admin.token })
    check('admin claim detail with photos', det.status === 200 && det.data.photos.pickup.length === 1 && det.data.photos.claim.length === 1, JSON.stringify(det.data).slice(0, 300))
    check('resolve needs a note', (await call('PUT', `/admin/claims/${claimId}`, { token: admin.token, body: { status: 'resolved', amountApproved: 50 } })).status === 400)
    const res = await call('PUT', `/admin/claims/${claimId}`, { token: admin.token, body: { status: 'resolved', amountApproved: 500, note: 'Pickup photos show no crack; approving repair cost.' } })
    check('admin resolves, amount capped at request', res.status === 200 && res.data.claim.amountApproved === 80, JSON.stringify(res.data))
    check('closed claim takes no replies', (await call('POST', `/bookings/${bid}/claims/${claimId}/comment`, { token: renter.token, body: { body: 'more' } })).status === 400)

    const rm = await call('PUT', `/admin/listings/${lid}/status`, { token: admin.token, body: { status: 'removed', note: 'Test removal' } })
    check('admin removes listing', rm.status === 200)
    check('owner cannot re-publish removed listing', (await call('PUT', `/listings/${lid}`, { token: owner.token, body: { status: 'active' } })).status === 403)
    check('removed listing hidden from public', (await call('GET', `/listings/${lid}`)).status === 404)

    await call('PUT', `/admin/users/${stranger.user.id}/suspend`, { token: admin.token, body: { suspended: true, reason: 'test' } })
    const susp = await call('PUT', '/users/profile', { token: stranger.token, body: { firstName: 'Sam', lastName: 'T' } })
    check('suspended user cannot make changes', susp.status === 403)
    const audit = await call('GET', '/admin/audit', { token: admin.token })
    check('admin actions logged', audit.data.actions.length >= 3)
}

main()
    .catch(err => { failures.push(`crashed: ${err.message}`); console.error(err) })
    .finally(async () => {
        // Wait for the server to let go of the database file (Windows locks open files)
        await new Promise(resolve => { server.once('exit', resolve); server.kill() })
        try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* temp folder; safe to leave */ }
        console.log(`\n${passed} passed, ${failures.length} failed`)
        if (failures.length) { console.log('Server log:\n' + log.slice(-3000)); process.exitCode = 1 }
    })
