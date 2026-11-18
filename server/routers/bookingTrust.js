// Trust features attached to a booking:
//   • check-in photos at pickup and return (evidence for both sides)
//   • two-way reviews after the rental is completed
//   • damage / problem claims, which an admin resolves
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { createHmac, timingSafeEqual } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { authenticate, isAdmin } from '../middleware/auth.js'
import { UPLOADS_DIR } from '../utils/paths.js'

const router = Router()

export const REVIEW_WINDOW_DAYS = 14
export const CLAIM_WINDOW_HOURS = 72
const MAX_PHOTOS_PER_STAGE = 12
const MAX_CLAIM_AMOUNT = 10000

export const CLAIM_TYPES = {
    owner: {
        damage: 'Item was damaged',
        missing_item: 'Item or parts not returned',
        late_return: 'Returned late',
        other: 'Something else'
    },
    renter: {
        not_as_described: 'Item was not as described',
        damage: 'Item was broken when I got it',
        other: 'Something else'
    }
}

const photoDir = path.join(UPLOADS_DIR, 'bookings')
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' }
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, photoDir),
        filename: (req, file, cb) => cb(null, `${uuidv4()}${IMAGE_TYPES[file.mimetype]}`)
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: MAX_PHOTOS_PER_STAGE },
    fileFilter: (req, file, cb) => (IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG, WebP or HEIC photos are allowed')))
})

// ─── Helpers ────────────────────────────────────────────────────────────────
const money = (n) => Math.round(n * 100) / 100
const hoursSince = (iso) => (iso ? (Date.now() - Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)) / 36e5 : Infinity)

function getBooking(id) {
    return db.prepare(`
        SELECT b.*, l.owner_id, l.title, l.image,
               r.first_name AS renter_first, r.last_name AS renter_last, r.avatar AS renter_avatar,
               o.first_name AS owner_first, o.last_name AS owner_last, o.avatar AS owner_avatar
        FROM bookings b
        JOIN listings l ON l.id = b.listing_id
        JOIN users r ON r.id = b.user_id
        JOIN users o ON o.id = l.owner_id
        WHERE b.id = ?
    `).get(id)
}

// Which side of the booking is this person on? null = not part of it
function partyRole(b, user) {
    if (b.owner_id === user.id) return 'owner'
    if (b.user_id === user.id) return 'renter'
    return null
}

const returnedAt = (b) => b.returned_at || (b.status === 'completed' ? b.updated_at : null)

function canUploadPhoto(b, stage) {
    if (stage === 'pickup') return ['accepted', 'active'].includes(b.status)
    if (stage === 'return') return b.status === 'active' || (b.status === 'completed' && hoursSince(returnedAt(b)) <= CLAIM_WINDOW_HOURS)
    if (stage === 'claim') return claimWindowOpen(b) || hasOpenClaim(b.id)
    return false
}

const claimWindowOpen = (b) =>
    b.status === 'active' || (b.status === 'completed' && hoursSince(returnedAt(b)) <= CLAIM_WINDOW_HOURS)

const hasOpenClaim = (bookingId) =>
    !!db.prepare(`SELECT 1 FROM claims WHERE booking_id = ? AND status IN ('open','under_review')`).get(bookingId)

const reviewWindowOpen = (b) => b.status === 'completed' && hoursSince(returnedAt(b)) <= REVIEW_WINDOW_DAYS * 24

// Short-lived signed links so <img> tags can show private photos without a login header
const FILE_SECRET = process.env.FILE_URL_SECRET || process.env.ACCESS_TOKEN_SECRET || 'dev-only-file-secret'
const sign = (photoId, exp) => createHmac('sha256', FILE_SECRET).update(`${photoId}.${exp}`).digest('hex')

export function photoUrl(bookingId, photoId) {
    const exp = Date.now() + 60 * 60 * 1000 // 1 hour
    return `/api/bookings/${bookingId}/photos/${photoId}/file?exp=${exp}&sig=${sign(photoId, exp)}`
}

export function listPhotos(bookingId) {
    const rows = db.prepare(`SELECT p.*, u.first_name FROM booking_photos p JOIN users u ON u.id = p.uploaded_by
        WHERE p.booking_id = ? ORDER BY p.created_at`).all(bookingId)
    const out = { pickup: [], return: [], claim: [] }
    for (const p of rows) {
        out[p.stage]?.push({ id: p.id, url: photoUrl(bookingId, p.id), uploadedBy: p.uploaded_by, uploaderName: p.first_name, createdAt: p.created_at })
    }
    return out
}

export function claimWithEvents(claim) {
    const events = db.prepare(`SELECT e.*, u.first_name FROM claim_events e LEFT JOIN users u ON u.id = e.author_id
        WHERE e.claim_id = ? ORDER BY e.created_at`).all(claim.id)
    return {
        id: claim.id,
        bookingId: claim.booking_id,
        filedBy: claim.filed_by,
        againstUser: claim.against_user,
        filerRole: claim.filer_role,
        type: claim.type,
        typeLabel: CLAIM_TYPES[claim.filer_role]?.[claim.type] || claim.type,
        description: claim.description,
        amountRequested: claim.amount_requested,
        amountApproved: claim.amount_approved,
        status: claim.status,
        resolutionNote: claim.resolution_note,
        resolvedAt: claim.resolved_at,
        createdAt: claim.created_at,
        updatedAt: claim.updated_at,
        events: events.map(e => ({
            id: e.id, kind: e.kind, body: e.body, authorRole: e.author_role,
            authorName: e.author_role === 'admin' ? 'Rentaleze Support' : (e.author_role === 'system' ? 'Rentaleze' : e.first_name),
            createdAt: e.created_at
        }))
    }
}

export function addClaimEvent(claimId, authorId, authorRole, kind, body) {
    db.prepare(`INSERT INTO claim_events (id, claim_id, author_id, author_role, kind, body) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), claimId, authorId, authorRole, kind, String(body).slice(0, 2000))
}

// Recalculate a listing's star rating from renters' reviews
export function refreshListingRating(listingId) {
    const r = db.prepare(`SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews
        WHERE listing_id = ? AND COALESCE(reviewer_role, 'renter') = 'renter'`).get(listingId)
    db.prepare('UPDATE listings SET rating = ?, review_count = ? WHERE id = ?')
        .run(r.n ? Math.round(r.avg * 10) / 10 : 0, r.n, listingId)
}

function reviewView(r) {
    return r && { rating: r.rating, text: r.text, createdAt: r.created_at, reviewerRole: r.reviewer_role, reviewerName: r.user_name }
}

// Everything the booking detail page needs, from this person's point of view
export function trustSummary(b, user) {
    const role = partyRole(b, user) || (isAdmin(user) ? 'admin' : null)
    const reviews = db.prepare('SELECT * FROM reviews WHERE booking_id = ?').all(b.id)
    const mine = reviews.find(r => r.user_id === user.id)
    const theirs = reviews.find(r => r.user_id !== user.id)
    const windowOpen = reviewWindowOpen(b)
    // Double-blind: you see the other person's review once you've written yours, or the window closes
    const showTheirs = !!theirs && (!!mine || !windowOpen || role === 'admin')
    const claims = db.prepare('SELECT * FROM claims WHERE booking_id = ? ORDER BY created_at DESC').all(b.id)
    const myOpenClaim = claims.find(c => c.filed_by === user.id && ['open', 'under_review'].includes(c.status))
    const ret = returnedAt(b)

    return {
        booking: {
            id: b.id, listingId: b.listing_id, title: b.title, image: b.image, status: b.status,
            startDate: b.start_date, endDate: b.end_date, days: b.days, total: b.total, baseTotal: b.base_total,
            pickedUpAt: b.picked_up_at || null, returnedAt: ret,
            ownerId: b.owner_id, renterId: b.user_id,
            ownerName: `${b.owner_first} ${b.owner_last?.[0] || ''}.`, renterName: `${b.renter_first} ${b.renter_last?.[0] || ''}.`
        },
        role,
        photos: listPhotos(b.id),
        canUpload: { pickup: canUploadPhoto(b, 'pickup'), return: canUploadPhoto(b, 'return'), claim: canUploadPhoto(b, 'claim') },
        review: {
            canWrite: role !== 'admin' && !!role && windowOpen && !mine,
            windowEndsAt: ret ? new Date(Date.parse(ret.includes('T') ? ret : `${ret.replace(' ', 'T')}Z`) + REVIEW_WINDOW_DAYS * 864e5).toISOString() : null,
            mine: reviewView(mine),
            theirs: showTheirs ? reviewView(theirs) : null,
            theirsPending: !!theirs && !showTheirs
        },
        claims: claims.map(claimWithEvents),
        canFileClaim: role !== 'admin' && !!role && claimWindowOpen(b) && !myOpenClaim,
        claimWindowHours: CLAIM_WINDOW_HOURS,
        claimTypes: role && role !== 'admin' ? CLAIM_TYPES[role] : {}
    }
}

// Load the booking and make sure this person may see it
function loadForUser(req, res) {
    const b = getBooking(req.params.id)
    if (!b) { res.status(404).json({ error: 'Booking not found' }); return null }
    if (!partyRole(b, req.user) && !isAdmin(req.user)) { res.status(403).json({ error: 'Not authorized' }); return null }
    return b
}

// ─── Routes ─────────────────────────────────────────────────────────────────

router.get('/:id/trust', authenticate, (req, res) => {
    try {
        const b = loadForUser(req, res)
        if (b) res.json(trustSummary(b, req.user))
    } catch (error) {
        console.error('Trust summary error:', error)
        res.status(500).json({ error: 'Failed to load booking details' })
    }
})

// Upload check-in photos: ?stage=pickup|return|claim (form field "photos")
router.post('/:id/photos', authenticate, (req, res) => {
    const b = getBooking(req.params.id)
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    if (!partyRole(b, req.user)) return res.status(403).json({ error: 'Not authorized' })
    const stage = req.query.stage
    if (!['pickup', 'return', 'claim'].includes(stage)) return res.status(400).json({ error: 'Unknown photo type' })
    if (!canUploadPhoto(b, stage)) return res.status(400).json({ error: `You can't add ${stage} photos to this booking right now.` })

    const already = db.prepare('SELECT COUNT(*) AS n FROM booking_photos WHERE booking_id = ? AND stage = ? AND uploaded_by = ?')
        .get(b.id, stage, req.user.id).n
    if (already >= MAX_PHOTOS_PER_STAGE) return res.status(400).json({ error: `You can add up to ${MAX_PHOTOS_PER_STAGE} photos here.` })

    upload.array('photos', MAX_PHOTOS_PER_STAGE - already)(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Too many photos' : err.message })
        if (!req.files?.length) return res.status(400).json({ error: 'Choose at least one photo' })
        const insert = db.prepare('INSERT INTO booking_photos (id, booking_id, stage, uploaded_by, file_name) VALUES (?, ?, ?, ?, ?)')
        db.transaction(() => { for (const f of req.files) insert.run(uuidv4(), b.id, stage, req.user.id, f.filename) })()
        res.status(201).json({ photos: listPhotos(b.id) })
    })
})

// Serve one private photo (signed link from photoUrl)
router.get('/:id/photos/:photoId/file', (req, res) => {
    const { exp, sig } = req.query
    const expected = sign(req.params.photoId, exp)
    if (!exp || Number(exp) < Date.now() || !sig || sig.length !== expected.length ||
        !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return res.status(403).send('Link expired')
    }
    const p = db.prepare('SELECT file_name FROM booking_photos WHERE id = ? AND booking_id = ?').get(req.params.photoId, req.params.id)
    if (!p) return res.status(404).send('Not found')
    const file = path.join(photoDir, path.basename(p.file_name))
    if (!fs.existsSync(file)) return res.status(404).send('Not found')
    res.set('Cache-Control', 'private, max-age=3600')
    res.sendFile(file)
})

// Delete your own photo (only while you could still add photos to that stage)
router.delete('/:id/photos/:photoId', authenticate, (req, res) => {
    const b = getBooking(req.params.id)
    if (!b || !partyRole(b, req.user)) return res.status(404).json({ error: 'Not found' })
    const p = db.prepare('SELECT * FROM booking_photos WHERE id = ? AND booking_id = ? AND uploaded_by = ?').get(req.params.photoId, b.id, req.user.id)
    if (!p) return res.status(404).json({ error: 'Photo not found' })
    if (!canUploadPhoto(b, p.stage) || p.stage === 'claim') return res.status(400).json({ error: 'This photo is locked as evidence.' })
    db.prepare('DELETE FROM booking_photos WHERE id = ?').run(p.id)
    fs.rmSync(path.join(photoDir, path.basename(p.file_name)), { force: true })
    res.json({ photos: listPhotos(b.id) })
})

// Leave a review (renter reviews the item + owner; owner reviews the renter)
router.post('/:id/review', authenticate, (req, res) => {
    try {
        const b = getBooking(req.params.id)
        if (!b) return res.status(404).json({ error: 'Booking not found' })
        const role = partyRole(b, req.user)
        if (!role) return res.status(403).json({ error: 'Not authorized' })
        if (b.status !== 'completed') return res.status(400).json({ error: 'You can review once the rental is finished.' })
        if (!reviewWindowOpen(b)) return res.status(400).json({ error: `Reviews close ${REVIEW_WINDOW_DAYS} days after the item is returned.` })

        const rating = parseInt(req.body?.rating, 10)
        const text = String(req.body?.text || '').trim()
        if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Choose 1 to 5 stars.' })
        if (text.length < 10) return res.status(400).json({ error: 'Write at least a sentence (10+ characters).' })

        const exists = db.prepare('SELECT 1 FROM reviews WHERE booking_id = ? AND user_id = ?').get(b.id, req.user.id)
        if (exists) return res.status(409).json({ error: 'You already reviewed this rental.' })

        const subject = role === 'renter' ? b.owner_id : b.user_id
        const name = `${req.user.first_name} ${req.user.last_name?.[0] || ''}.`
        db.prepare(`INSERT INTO reviews (id, listing_id, user_id, user_name, user_avatar, rating, text, booking_id, reviewer_role, subject_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(uuidv4(), b.listing_id, req.user.id, name, req.user.avatar || null, rating, text.slice(0, 2000), b.id, role, subject)
        if (role === 'renter') refreshListingRating(b.listing_id)

        res.status(201).json(trustSummary(getBooking(b.id), req.user))
    } catch (error) {
        console.error('Create review error:', error)
        res.status(500).json({ error: 'Failed to save review' })
    }
})

// File a claim (damage, missing parts, late return, not as described…)
router.post('/:id/claims', authenticate, (req, res) => {
    try {
        const b = getBooking(req.params.id)
        if (!b) return res.status(404).json({ error: 'Booking not found' })
        const role = partyRole(b, req.user)
        if (!role) return res.status(403).json({ error: 'Not authorized' })
        if (!claimWindowOpen(b)) {
            return res.status(400).json({ error: `Claims can be filed during the rental or within ${CLAIM_WINDOW_HOURS} hours after return.` })
        }
        const type = req.body?.type
        if (!CLAIM_TYPES[role][type]) return res.status(400).json({ error: 'Choose what went wrong.' })
        const description = String(req.body?.description || '').trim()
        if (description.length < 20) return res.status(400).json({ error: 'Describe what happened in a few sentences (20+ characters).' })
        const amount = money(Number(req.body?.amountRequested) || 0)
        if (amount < 0 || amount > MAX_CLAIM_AMOUNT) return res.status(400).json({ error: `Amount must be between $0 and $${MAX_CLAIM_AMOUNT.toLocaleString()}.` })

        const open = db.prepare(`SELECT 1 FROM claims WHERE booking_id = ? AND filed_by = ? AND status IN ('open','under_review')`).get(b.id, req.user.id)
        if (open) return res.status(409).json({ error: 'You already have an open claim on this rental.' })

        const id = uuidv4()
        const against = role === 'owner' ? b.user_id : b.owner_id
        db.transaction(() => {
            db.prepare(`INSERT INTO claims (id, booking_id, filed_by, against_user, filer_role, type, description, amount_requested)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, b.id, req.user.id, against, role, type, description.slice(0, 4000), amount)
            addClaimEvent(id, null, 'system', 'status', 'Claim opened. The other person can respond here, and Rentaleze Support will review it.')
        })()

        res.status(201).json(trustSummary(getBooking(b.id), req.user))
    } catch (error) {
        console.error('Create claim error:', error)
        res.status(500).json({ error: 'Failed to file claim' })
    }
})

// Reply on a claim (either side of the booking)
router.post('/:id/claims/:claimId/comment', authenticate, (req, res) => {
    const b = getBooking(req.params.id)
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    const role = partyRole(b, req.user)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    const claim = db.prepare('SELECT * FROM claims WHERE id = ? AND booking_id = ?').get(req.params.claimId, b.id)
    if (!claim) return res.status(404).json({ error: 'Claim not found' })
    if (!['open', 'under_review'].includes(claim.status)) return res.status(400).json({ error: 'This claim is closed.' })
    const body = String(req.body?.body || '').trim()
    if (body.length < 2) return res.status(400).json({ error: 'Write a reply first.' })
    addClaimEvent(claim.id, req.user.id, role, 'comment', body)
    db.prepare('UPDATE claims SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(claim.id)
    res.json(trustSummary(b, req.user))
})

// Withdraw your own claim
router.post('/:id/claims/:claimId/withdraw', authenticate, (req, res) => {
    const b = getBooking(req.params.id)
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    const claim = db.prepare('SELECT * FROM claims WHERE id = ? AND booking_id = ? AND filed_by = ?').get(req.params.claimId, b.id, req.user.id)
    if (!claim) return res.status(404).json({ error: 'Claim not found' })
    if (!['open', 'under_review'].includes(claim.status)) return res.status(400).json({ error: 'This claim is already closed.' })
    db.prepare(`UPDATE claims SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(claim.id)
    addClaimEvent(claim.id, req.user.id, partyRole(b, req.user), 'status', 'Claim withdrawn by the person who filed it.')
    res.json(trustSummary(b, req.user))
})

export default router
