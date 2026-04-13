import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const db = new Database(join(__dirname, 'rentaleze.db'))

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Initialize schema
export function initDatabase() {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
    db.exec(schema)
    console.log('✅ Database initialized')
}

// Seed sample data
export async function seedDatabase() {
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get()
    if (existingUsers.count > 0) {
        console.log('📦 Database already seeded')
        return
    }

    // Import seed data
    const { users, listings, listingDetails, reviews } = await import('./seed.js')

    const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, avatar, role, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

    const insertListing = db.prepare(`
    INSERT INTO listings (id, owner_id, title, description, category, price_per_day, rating, review_count, location, distance, image, owner_name, owner_avatar, badges, verified, shipping, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

    // Seed users
    for (const user of users) {
        insertUser.run(user.id, user.email, user.password_hash, user.first_name, user.last_name, user.avatar, user.role, user.is_verified ? 1 : 0)
    }

    console.log('✅ Database seeded with sample data')
}

export default db