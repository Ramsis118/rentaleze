// One-time cleanup: delete ID photos saved by the old upload flow.
// Stripe Identity now handles ID checks, so Rentaleze should not keep copies.
// Run once on each environment:  node server/scripts/purge-id-photos.js
import fs from 'fs'
import path from 'path'
import 'dotenv/config'
import db from '../db/database.js'
import { UPLOADS_DIR } from '../utils/paths.js'

const dir = path.join(UPLOADS_DIR, 'ids')
let removed = 0
if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
        fs.rmSync(path.join(dir, name), { force: true })
        removed++
    }
    fs.rmSync(dir, { recursive: true, force: true })
}
const cleared = db.prepare('UPDATE users SET id_front = NULL, id_back = NULL WHERE id_front IS NOT NULL OR id_back IS NOT NULL').run().changes
console.log(`Deleted ${removed} ID photo file(s); cleared ID photo links on ${cleared} account(s).`)
