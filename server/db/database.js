import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = process.env.DB_PATH || join(__dirname, 'rentaleze.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Demo (sample) listings are for development only. They never show in production
// unless SHOW_DEMO_LISTINGS=true is set explicitly.
export const demoListingsEnabled =
    process.env.SHOW_DEMO_LISTINGS === 'true' ||
    (process.env.SHOW_DEMO_LISTINGS !== 'false' && process.env.NODE_ENV !== 'production')

// Initialize schema
export function initDatabase() {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
    db.exec(schema)
    console.log('✅ Database initialized')
    upgradeDatabase()
}

// Upgrade schema safely (adds columns that older databases are missing)
function upgradeDatabase() {
    const columns = [
        ['users', 'bio', 'TEXT'],
        ['users', 'phone', 'TEXT'],
        ['users', 'address', 'TEXT'],
        ['users', 'id_front', 'TEXT'],
        ['users', 'id_back', 'TEXT'],
        ['users', 'phone_verified', 'INTEGER DEFAULT 0'],
        ['listings', 'instant_book', 'INTEGER DEFAULT 0'],
        ['listings', 'item_condition', 'TEXT'],
        ['listings', 'is_demo', 'INTEGER DEFAULT 0'],
        ['users', 'is_demo', 'INTEGER DEFAULT 0'],
        ['bookings', 'updated_at', 'TEXT'],
        ['bookings', 'cancelled_by', 'TEXT'],
        ['bookings', 'owner_note', 'TEXT']
    ]

    for (const [table, name, type] of columns) {
        const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === name)
        if (!exists) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run()
    }
    // Old bookings used "pending" for requests
    db.prepare(`UPDATE bookings SET status = 'requested' WHERE status = 'pending'`).run()
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_listings_status_category ON listings(status, category);
        CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id);
    `)
    console.log('✅ Database migrations checked')
}

// Seed demo listings (development only)
export async function seedDatabase() {
    if (!demoListingsEnabled) return

    const existing = db.prepare('SELECT COUNT(*) AS count FROM listings WHERE is_demo = 1').get()
    if (existing.count > 0) {
        console.log('📦 Demo listings already loaded')
        return
    }

    const { demoOwners, demoListings, demoReviewer } = await import('./seed.js')

    // Demo accounts get a random password nobody knows, so they can't be signed into
    const lockedHash = () => bcrypt.hashSync(randomUUID(), 10)

    const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, avatar, role, is_verified, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, 'owner', ?, 1)
    `)
    const insertListing = db.prepare(`
        INSERT INTO listings (id, owner_id, title, description, category, price_per_day, rating, review_count, location,
            distance, image, owner_name, owner_avatar, badges, verified, shipping, instant_book, item_condition, status, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)
    `)
    const insertDetails = db.prepare(`
        INSERT INTO listing_details (id, listing_id, images, includes, specs, rules, owner_since, owner_response_rate,
            owner_response_time, owner_total_reviews, owner_bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertReview = db.prepare(`
        INSERT INTO reviews (id, listing_id, user_id, user_name, user_avatar, rating, text, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    db.transaction(() => {
        insertUser.run(demoReviewer.id, demoReviewer.email, lockedHash(), demoReviewer.firstName, demoReviewer.lastName, null, 0)
        for (const o of demoOwners) {
            insertUser.run(o.id, o.email, lockedHash(), o.firstName, o.lastName, o.avatar, o.verified ? 1 : 0)
        }
        for (const l of demoListings) {
            insertListing.run(l.id, l.ownerId, l.title, l.description, l.category, l.pricePerDay, l.rating, l.reviewCount,
                l.location, l.distance, l.image, l.ownerName, l.ownerAvatar, JSON.stringify(l.badges), l.verified ? 1 : 0,
                l.shipping ? 1 : 0, l.instantBook ? 1 : 0, l.condition)
            insertDetails.run(randomUUID(), l.id, JSON.stringify(l.images), JSON.stringify(l.includes), JSON.stringify(l.specs),
                JSON.stringify(l.rules), l.ownerSince, l.ownerResponseRate, l.ownerResponseTime, l.ownerTotalReviews, l.ownerBio)
            for (const r of l.reviews) {
                insertReview.run(randomUUID(), l.id, demoReviewer.id, r.name, r.avatar, r.rating, r.text, r.date)
            }
        }
    })()

    console.log(`✅ Loaded ${demoListings.length} demo listings (development only)`)
}

export default db
