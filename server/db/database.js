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
        ['bookings', 'owner_note', 'TEXT'],
        // Shipping: packed size of the item (for rate estimates and labels)
        ['listings', 'ship_weight_oz', 'REAL'],
        ['listings', 'ship_length_in', 'REAL'],
        ['listings', 'ship_width_in', 'REAL'],
        ['listings', 'ship_height_in', 'REAL'],
        ['listings', 'ship_from', 'TEXT'],          // JSON address, private to the owner
        ['bookings', 'shipping_name', 'TEXT'],
        ['bookings', 'shipping_phone', 'TEXT'],
        ['bookings', 'shipping_estimated', 'INTEGER DEFAULT 0'],
        // Trust & safety: real ID + phone verification
        ['users', 'id_status', "TEXT DEFAULT 'none'"],      // none | pending | verified | failed
        ['users', 'identity_session_id', 'TEXT'],
        ['users', 'id_verified_at', 'TEXT'],
        ['users', 'id_last_error', 'TEXT'],
        ['users', 'phone_verified_at', 'TEXT'],
        ['users', 'suspended', 'INTEGER DEFAULT 0'],
        ['users', 'suspended_reason', 'TEXT'],
        // Reviews tied to a finished rental
        ['reviews', 'booking_id', 'TEXT'],
        ['reviews', 'reviewer_role', 'TEXT'],              // renter | owner
        ['reviews', 'subject_user_id', 'TEXT'],
        // Rental timeline
        ['bookings', 'picked_up_at', 'TEXT'],
        ['bookings', 'returned_at', 'TEXT'],
        // Admin moderation
        ['listings', 'moderation_note', 'TEXT']
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
        CREATE INDEX IF NOT EXISTS idx_shipments_booking ON shipments(booking_id);
        CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
    `)
    upgradeTrustTables()
    console.log('✅ Database migrations checked')
}

// Tables for check-in photos, damage claims and the admin audit log
function upgradeTrustTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS booking_photos (
            id TEXT PRIMARY KEY,
            booking_id TEXT NOT NULL,
            stage TEXT NOT NULL,              -- pickup | return | claim
            uploaded_by TEXT NOT NULL,
            file_name TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_booking_photos_booking ON booking_photos(booking_id);

        CREATE TABLE IF NOT EXISTS claims (
            id TEXT PRIMARY KEY,
            booking_id TEXT NOT NULL,
            filed_by TEXT NOT NULL,
            against_user TEXT NOT NULL,
            filer_role TEXT NOT NULL,         -- owner | renter
            type TEXT NOT NULL,               -- damage | late_return | missing_item | not_as_described | other
            description TEXT NOT NULL,
            amount_requested REAL DEFAULT 0,
            amount_approved REAL,
            status TEXT DEFAULT 'open',       -- open | under_review | resolved | rejected | withdrawn
            resolution_note TEXT,
            resolved_by TEXT,
            resolved_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id),
            FOREIGN KEY (filed_by) REFERENCES users(id),
            FOREIGN KEY (against_user) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_claims_booking ON claims(booking_id);
        CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

        CREATE TABLE IF NOT EXISTS claim_events (
            id TEXT PRIMARY KEY,
            claim_id TEXT NOT NULL,
            author_id TEXT,
            author_role TEXT NOT NULL,        -- owner | renter | admin | system
            kind TEXT NOT NULL,               -- comment | status
            body TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (claim_id) REFERENCES claims(id)
        );
        CREATE INDEX IF NOT EXISTS idx_claim_events_claim ON claim_events(claim_id);

        CREATE TABLE IF NOT EXISTS admin_actions (
            id TEXT PRIMARY KEY,
            admin_id TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            detail TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_booking_reviewer ON reviews(booking_id, user_id) WHERE booking_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_reviews_subject ON reviews(subject_user_id);
    `)

    // The old demo flow set is_verified = 2 after a fake phone code, without checking any ID.
    // Those accounts are not ID-verified, so reset them; their phone check stays.
    db.prepare(`UPDATE users SET is_verified = 0 WHERE is_verified = 2`).run()
    // Demo owners count as verified
    db.prepare(`UPDATE users SET id_status = 'verified' WHERE is_demo = 1 AND is_verified = 1 AND COALESCE(id_status, 'none') = 'none'`).run()

    syncAdmins()
}

// Emails listed in ADMIN_EMAILS (comma separated) get the admin role. Nobody can sign up as admin.
export const adminEmails = () => (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export function syncAdmins() {
    const emails = adminEmails()
    if (!emails.length) return
    const stmt = db.prepare(`UPDATE users SET role = 'admin' WHERE lower(email) = ? AND role != 'admin'`)
    for (const e of emails) stmt.run(e)
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
