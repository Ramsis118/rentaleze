import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import db, { demoListingsEnabled } from '../db/database.js'
import { UPLOADS_DIR } from '../utils/paths.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'
import { CATEGORIES } from '../../src/data/listings.js'

const router = Router()

const VALID_CATEGORIES = CATEGORIES.filter(c => c.id !== 'all').map(c => c.id)
const VALID_CONDITIONS = ['New', 'Like New', 'Good', 'Fair']
const OWNER_STATUSES = ['active', 'paused', 'draft']
const MAX_IMAGES = 10

// ─── Photo uploads ──────────────────────────────────────────────────────────
const listingUploadDir = path.join(UPLOADS_DIR, 'listings')

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const photoUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, listingUploadDir),
        filename: (req, file, cb) => {
            cb(null, `${req.user.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${IMAGE_TYPES[file.mimetype]}`)
        }
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: MAX_IMAGES },
    fileFilter: (req, file, cb) => {
        if (IMAGE_TYPES[file.mimetype]) cb(null, true)
        else cb(new Error('Only JPG, PNG or WebP images are allowed'))
    }
})

// ─── Helpers ────────────────────────────────────────────────────────────────
const parseJSON = (value, fallback) => {
    if (!value) return fallback
    try { return JSON.parse(value) } catch { return fallback }
}

export const BASE_SELECT = `
    SELECT l.*, u.first_name AS u_first, u.last_name AS u_last, u.avatar AS u_avatar,
           u.is_verified AS u_verified, u.created_at AS u_created
    FROM listings l
    JOIN users u ON u.id = l.owner_id
`

// Owner verification: demo listings keep their sample flag, real listings use the owner's account
const VERIFIED_SQL = `(CASE WHEN l.is_demo = 1 THEN l.verified ELSE (COALESCE(u.is_verified, 0) > 0) END)`

export function toListing(row) {
    const isDemo = !!row.is_demo
    const ownerName = isDemo
        ? row.owner_name
        : `${row.u_first} ${row.u_last ? row.u_last[0] + '.' : ''}`.trim()
    return {
        id: row.id,
        ownerId: row.owner_id,
        title: row.title,
        description: row.description || '',
        category: row.category,
        pricePerDay: row.price_per_day,
        rating: row.rating || 0,
        reviewCount: row.review_count || 0,
        location: row.location || '',
        distance: row.distance || null,
        image: row.image || null,
        ownerName,
        ownerAvatar: isDemo ? row.owner_avatar : (row.u_avatar || null),
        badges: parseJSON(row.badges, []),
        verified: isDemo ? !!row.verified : (row.u_verified || 0) > 0,
        shipping: !!row.shipping,
        instantBook: !!row.instant_book,
        condition: row.item_condition || null,
        status: row.status,
        isDemo,
        createdAt: row.created_at
    }
}

function withDetails(listing, row) {
    const d = db.prepare('SELECT * FROM listing_details WHERE listing_id = ?').get(listing.id) || {}
    const reviews = db.prepare(`
        SELECT user_name AS name, user_avatar AS avatar, rating, text, date, created_at
        FROM reviews WHERE listing_id = ? ORDER BY created_at DESC
    `).all(listing.id)
    const images = parseJSON(d.images, [])
    return {
        ...listing,
        images: images.length ? images : (listing.image ? [listing.image] : []),
        includes: parseJSON(d.includes, []),
        specs: parseJSON(d.specs, {}),
        rules: parseJSON(d.rules, []),
        ownerSince: d.owner_since || (row.u_created ? new Date(row.u_created).getFullYear() : new Date().getFullYear()),
        ownerResponseRate: d.owner_response_rate ?? null,
        ownerResponseTime: d.owner_response_time || null,
        ownerTotalReviews: d.owner_total_reviews || 0,
        ownerBio: d.owner_bio || '',
        reviews: reviews.map(r => ({ ...r, date: r.date || (r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '') }))
    }
}

const cleanList = (arr, max = 30, len = 200) =>
    Array.isArray(arr) ? arr.map(s => String(s).trim()).filter(Boolean).slice(0, max).map(s => s.slice(0, len)) : []

const isAllowedImage = (url) =>
    typeof url === 'string' && (url.startsWith('/uploads/listings/') || /^https:\/\/[^\s]+$/.test(url))

// Validate create/update input. `partial` allows missing fields on update.
function validateListing(body, { partial = false } = {}) {
    const errors = []
    const out = {}
    const has = (k) => body[k] !== undefined

    if (!partial || has('title')) {
        const title = String(body.title || '').trim()
        if (title.length < 3 || title.length > 100) errors.push('Title must be 3–100 characters')
        out.title = title
    }
    if (!partial || has('description')) {
        const description = String(body.description || '').trim()
        if (description.length > 5000) errors.push('Description must be under 5,000 characters')
        out.description = description
    }
    if (!partial || has('category')) {
        if (!VALID_CATEGORIES.includes(body.category)) errors.push('Choose a valid category')
        out.category = body.category
    }
    if (!partial || has('pricePerDay')) {
        const price = Number(body.pricePerDay)
        if (!Number.isFinite(price) || price < 1 || price > 10000) errors.push('Daily price must be between $1 and $10,000')
        out.price_per_day = Math.round(price * 100) / 100
    }
    if (!partial || has('location')) {
        out.location = String(body.location || '').trim().slice(0, 120)
    }
    if (!partial || has('condition')) {
        if (body.condition && !VALID_CONDITIONS.includes(body.condition)) errors.push('Choose a valid condition')
        out.item_condition = body.condition || null
    }
    if (!partial || has('shipping')) out.shipping = body.shipping ? 1 : 0
    if (!partial || has('instantBook')) out.instant_book = body.instantBook ? 1 : 0
    if (!partial || has('images')) {
        const images = Array.isArray(body.images) ? body.images : []
        if (images.length > MAX_IMAGES) errors.push(`Up to ${MAX_IMAGES} photos allowed`)
        if (images.some(u => !isAllowedImage(u))) errors.push('One or more photos are invalid')
        out.images = images.slice(0, MAX_IMAGES)
    }
    if (!partial || has('includes')) out.includes = cleanList(body.includes)
    if (!partial || has('rules')) out.rules = cleanList(body.rules)
    if (!partial || has('specs')) {
        const specs = {}
        if (body.specs && typeof body.specs === 'object' && !Array.isArray(body.specs)) {
            for (const [k, v] of Object.entries(body.specs).slice(0, 20)) {
                const key = String(k).trim().slice(0, 50)
                const val = String(v).trim().slice(0, 100)
                if (key && val) specs[key] = val
            }
        }
        out.specs = specs
    }
    if (!partial || has('status')) {
        const status = body.status || 'active'
        if (!OWNER_STATUSES.includes(status)) errors.push('Invalid status')
        out.status = status
    }
    return { errors, data: out }
}

// A listing can only go live with at least one photo and a location
function publishErrors(merged) {
    const errors = []
    if (merged.status === 'active') {
        if (!merged.images || merged.images.length === 0) errors.push('Add at least one photo before publishing')
        if (!merged.location) errors.push('Add a pickup location before publishing')
    }
    return errors
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// Categories
router.get('/meta/categories', (req, res) => {
    res.json(CATEGORIES)
})

// Search / browse
router.get('/', optionalAuth, (req, res) => {
    try {
        const { category, q, minPrice, maxPrice, instantBook, shipping, verified, sort, owner } = req.query
        const where = [`l.status = 'active'`]
        const params = []

        if (!demoListingsEnabled) where.push('l.is_demo = 0')
        if (category && category !== 'all') { where.push('l.category = ?'); params.push(category) }
        if (q) {
            const like = `%${String(q).trim().slice(0, 100)}%`
            where.push('(l.title LIKE ? OR l.description LIKE ? OR l.location LIKE ? OR l.category LIKE ?)')
            params.push(like, like, like, like)
        }
        if (minPrice !== undefined && minPrice !== '') { where.push('l.price_per_day >= ?'); params.push(Number(minPrice) || 0) }
        if (maxPrice !== undefined && maxPrice !== '') { where.push('l.price_per_day <= ?'); params.push(Number(maxPrice) || 0) }
        if (instantBook === 'true') where.push('l.instant_book = 1')
        if (shipping === 'true') where.push('l.shipping = 1')
        if (verified === 'true') where.push(`${VERIFIED_SQL} = 1`)
        if (owner) { where.push('l.owner_id = ?'); params.push(owner) }

        const SORTS = {
            price_asc: 'l.price_per_day ASC',
            price_desc: 'l.price_per_day DESC',
            rating: 'l.rating DESC, l.review_count DESC',
            newest: 'l.created_at DESC',
            relevance: 'l.is_demo ASC, l.review_count DESC, l.created_at DESC'
        }
        const orderBy = SORTS[sort] || SORTS.relevance
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100)
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
        const whereSql = `WHERE ${where.join(' AND ')}`

        const total = db.prepare(`SELECT COUNT(*) AS n FROM listings l JOIN users u ON u.id = l.owner_id ${whereSql}`).get(...params).n
        const rows = db.prepare(`${BASE_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset)

        res.json({ listings: rows.map(toListing), total, limit, offset })
    } catch (error) {
        console.error('Get listings error:', error)
        res.status(500).json({ error: 'Failed to fetch listings' })
    }
})

// The signed-in owner's own listings (all statuses except deleted)
router.get('/mine', authenticate, (req, res) => {
    try {
        const rows = db.prepare(`${BASE_SELECT} WHERE l.owner_id = ? AND l.status != 'deleted' ORDER BY l.created_at DESC`).all(req.user.id)
        const counts = db.prepare(`
            SELECT listing_id, COUNT(*) AS n FROM bookings
            WHERE listing_id IN (SELECT id FROM listings WHERE owner_id = ?) AND status NOT IN ('cancelled', 'declined')
            GROUP BY listing_id
        `).all(req.user.id)
        const byId = Object.fromEntries(counts.map(c => [c.listing_id, c.n]))
        res.json(rows.map(r => ({ ...toListing(r), bookingCount: byId[r.id] || 0 })))
    } catch (error) {
        console.error('Get my listings error:', error)
        res.status(500).json({ error: 'Failed to fetch your listings' })
    }
})

// Upload listing photos → returns URLs to include in create/update
router.post('/photos', authenticate, (req, res) => {
    photoUpload.array('photos', MAX_IMAGES)(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'Upload failed' })
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No photos uploaded' })
        res.status(201).json({ urls: req.files.map(f => `/uploads/listings/${f.filename}`) })
    })
})

// Single listing with details and reviews
router.get('/:id', optionalAuth, (req, res) => {
    try {
        const row = db.prepare(`${BASE_SELECT} WHERE l.id = ?`).get(req.params.id)
        const isOwner = row && req.user && row.owner_id === req.user.id
        if (!row || row.status === 'deleted' || (row.status !== 'active' && !isOwner) || (row.is_demo && !demoListingsEnabled)) {
            return res.status(404).json({ error: 'Listing not found' })
        }
        res.json(withDetails(toListing(row), row))
    } catch (error) {
        console.error('Get listing error:', error)
        res.status(500).json({ error: 'Failed to fetch listing' })
    }
})

// Create listing
router.post('/', authenticate, (req, res) => {
    try {
        const { errors, data } = validateListing(req.body)
        errors.push(...publishErrors(data))
        if (errors.length) return res.status(400).json({ error: errors[0], errors })

        const id = uuidv4()
        const badges = data.instant_book ? ['Instant Book'] : []
        const ownerSince = db.prepare('SELECT created_at FROM users WHERE id = ?').get(req.user.id)?.created_at

        db.transaction(() => {
            db.prepare(`
                INSERT INTO listings (id, owner_id, title, description, category, price_per_day, location, image,
                    owner_name, owner_avatar, badges, verified, shipping, instant_book, item_condition, status, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0)
            `).run(id, req.user.id, data.title, data.description, data.category, data.price_per_day, data.location,
                data.images[0] || null, `${req.user.first_name} ${req.user.last_name?.[0] || ''}.`, req.user.avatar || null,
                JSON.stringify(badges), data.shipping, data.instant_book, data.item_condition, data.status)

            db.prepare(`
                INSERT INTO listing_details (id, listing_id, images, includes, specs, rules, owner_since)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), id, JSON.stringify(data.images), JSON.stringify(data.includes), JSON.stringify(data.specs),
                JSON.stringify(data.rules), ownerSince ? new Date(ownerSince).getFullYear() : new Date().getFullYear())
        })()

        const row = db.prepare(`${BASE_SELECT} WHERE l.id = ?`).get(id)
        res.status(201).json(withDetails(toListing(row), row))
    } catch (error) {
        console.error('Create listing error:', error)
        res.status(500).json({ error: 'Failed to create listing' })
    }
})

// Update listing (owner only)
router.put('/:id', authenticate, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id)
        if (!existing || existing.status === 'deleted') return res.status(404).json({ error: 'Listing not found' })
        if (existing.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })

        const { errors, data } = validateListing(req.body, { partial: true })
        const details = db.prepare('SELECT * FROM listing_details WHERE listing_id = ?').get(existing.id) || {}
        const merged = {
            status: data.status ?? existing.status,
            location: data.location ?? existing.location,
            images: data.images ?? parseJSON(details.images, existing.image ? [existing.image] : [])
        }
        errors.push(...publishErrors(merged))
        if (errors.length) return res.status(400).json({ error: errors[0], errors })

        const listingCols = ['title', 'description', 'category', 'price_per_day', 'location', 'shipping', 'instant_book', 'item_condition', 'status']
        const sets = []
        const vals = []
        for (const col of listingCols) {
            if (data[col] !== undefined) { sets.push(`${col} = ?`); vals.push(data[col]) }
        }
        if (data.instant_book !== undefined) { sets.push('badges = ?'); vals.push(JSON.stringify(data.instant_book ? ['Instant Book'] : [])) }
        if (data.images !== undefined) { sets.push('image = ?'); vals.push(data.images[0] || null) }

        db.transaction(() => {
            if (sets.length) {
                db.prepare(`UPDATE listings SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, existing.id)
            }
            const detailCols = ['images', 'includes', 'specs', 'rules'].filter(k => data[k] !== undefined)
            if (detailCols.length) {
                if (!details.id) {
                    db.prepare('INSERT INTO listing_details (id, listing_id) VALUES (?, ?)').run(uuidv4(), existing.id)
                }
                db.prepare(`UPDATE listing_details SET ${detailCols.map(c => `${c} = ?`).join(', ')} WHERE listing_id = ?`)
                    .run(...detailCols.map(c => JSON.stringify(data[c])), existing.id)
            }
        })()

        const row = db.prepare(`${BASE_SELECT} WHERE l.id = ?`).get(existing.id)
        res.json(withDetails(toListing(row), row))
    } catch (error) {
        console.error('Update listing error:', error)
        res.status(500).json({ error: 'Failed to update listing' })
    }
})

// Delete listing (owner only) — soft delete, blocked while rentals are upcoming
router.delete('/:id', authenticate, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id)
        if (!existing || existing.status === 'deleted') return res.status(404).json({ error: 'Listing not found' })
        if (existing.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })

        const today = new Date().toISOString().slice(0, 10)
        const upcoming = db.prepare(`
            SELECT COUNT(*) AS n FROM bookings
            WHERE listing_id = ? AND status IN ('requested', 'pending', 'accepted', 'active') AND end_date >= ?
        `).get(existing.id, today).n
        if (upcoming > 0) {
            return res.status(409).json({ error: 'This item has upcoming rentals. Pause it instead, or wait until they finish.' })
        }

        db.prepare(`UPDATE listings SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(existing.id)
        res.json({ message: 'Listing deleted' })
    } catch (error) {
        console.error('Delete listing error:', error)
        res.status(500).json({ error: 'Failed to delete listing' })
    }
})

export default router
