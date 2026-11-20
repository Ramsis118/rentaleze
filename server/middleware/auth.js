import { verifyAccessToken } from '../utils/jwt.js'
import db, { adminEmails } from '../db/database.js'

const USER_FIELDS = 'id, email, first_name, last_name, avatar, role, is_verified, phone_verified, id_status, suspended'

function loadUser(req) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) return { error: 'No token provided' }
    const decoded = verifyAccessToken(authHeader.split(' ')[1])
    if (!decoded) return { error: 'Invalid or expired token' }
    const user = db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(decoded.userId)
    if (!user) return { error: 'User not found' }
    return { user }
}

export const isAdmin = (user) =>
    !!user && (user.role === 'admin' || adminEmails().includes(String(user.email || '').toLowerCase()))

export function authenticate(req, res, next) {
    const { user, error } = loadUser(req)
    if (error) return res.status(401).json({ error })
    // Suspended accounts can still sign in and read, but can't change anything
    if (user.suspended && req.method !== 'GET' && !isAdmin(user)) {
        return res.status(403).json({ error: 'Your account is suspended. Contact support@rentaleze.com.' })
    }
    req.user = user
    next()
}

export function optionalAuth(req, res, next) {
    const { user } = loadUser(req)
    if (user) req.user = user
    next()
}

export function requireAdmin(req, res, next) {
    authenticate(req, res, () => {
        if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admins only' })
        next()
    })
}

// "Verified" means a real ID check plus a confirmed phone number
export const isFullyVerified = (user) => user?.is_verified === 1 && user?.phone_verified === 1
