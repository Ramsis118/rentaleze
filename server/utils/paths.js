import path from 'path'
import fs from 'fs'

// Where uploaded files (avatars, ID photos, listing photos) are stored.
// On Render this must point at the persistent disk (e.g. /data/uploads),
// otherwise every deploy wipes the files.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')

for (const sub of ['avatars', 'ids', 'listings']) {
    fs.mkdirSync(path.join(UPLOADS_DIR, sub), { recursive: true })
}
