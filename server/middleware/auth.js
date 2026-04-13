import { verifyAccessToken } from '../utils/jwt.js'
import db from '../db/database.js'

export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyAccessToken(token)

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Get user from database
    const user = db.prepare('SELECT id, email, first_name, last_name, avatar, role, is_verified FROM users WHERE id = ?').get(decoded.userId)

    if (!user) {
        return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
}

export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next()
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyAccessToken(token)

    if (decoded) {
        const user = db.prepare('SELECT id, email, first_name, last_name, avatar, role, is_verified FROM users WHERE id = ?').get(decoded.userId)
        req.user = user
    }

    next()
}