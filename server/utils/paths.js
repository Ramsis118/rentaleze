import path from 'path'
import fs from 'fs'

// Where uploaded files (avatars, listing photos, rental check-in photos) are stored.
// ID photos are NOT stored here any more — Stripe Identity handles them.
// On Render this must point at the persistent disk (e.g. /data/uploads),
// otherwise every deploy wipes the files.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')

for (const sub of ['avatars', 'listings', 'bookings']) {
    fs.mkdirSync(path.join(UPLOADS_DIR, sub), { recursive: true })
}
