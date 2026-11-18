import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import rateLimit from 'express-rate-limit'
import db from '../db/database.js'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from '../utils/jwt.js'

const router = Router()

// People may choose how they plan to use Rentaleze — never an admin role
const SIGNUP_ROLES = ['renter', 'owner', 'both']
const REFRESH_DAYS = 7

// Slow down password guessing
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })

// Refresh tokens are stored hashed, so a leaked database can't be used to sign in
const hashToken = (t) => createHash('sha256').update(t).digest('hex')

// One shape for the user everywhere. snake_case copies keep older pages working.
export function publicUser(u) {
    return {
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        avatar: u.avatar || null,
        bio: u.bio || null,
        phone: u.phone || null,
        address: u.address || null,
        role: u.role,
        isVerified: u.is_verified || 0,
        phoneVerified: u.phone_verified || 0,
        createdAt: u.created_at,
        first_name: u.first_name,
        last_name: u.last_name,
        is_verified: u.is_verified || 0,
        phone_verified: u.phone_verified || 0
    }
}

function issueTokens(user) {
    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)
    const expires = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString()
    db.prepare('INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), user.id, hashToken(refreshToken), expires)
    // Housekeeping: drop this user's expired sessions
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').run(user.id, new Date().toISOString())
    return { accessToken, refreshToken }
}

// Signup
router.post('/signup', authLimiter, async (req, res) => {
    try {
        const { password, firstName, lastName } = req.body || {}
        const email = String(req.body?.email || '').trim().toLowerCase()
        const role = SIGNUP_ROLES.includes(req.body?.role) ? req.body.role : 'renter'

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' })
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' })
        }
        if (String(password).length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' })
        }

        const existing = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email)
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' })
        }

        const passwordHash = await bcrypt.hash(String(password), 12)
        const userId = uuidv4()
        db.prepare(`
            INSERT INTO users (id, email, password_hash, first_name, last_name, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, email, passwordHash, String(firstName).trim().slice(0, 60), String(lastName).trim().slice(0, 60), role)

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        res.status(201).json({ message: 'Account created successfully', user: publicUser(user), ...issueTokens(user) })
    } catch (error) {
        console.error('Signup error:', error)
        res.status(500).json({ error: 'Failed to create account' })
    }
})

// Login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase()
        const password = String(req.body?.password || '')

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' })
        }

        const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email)
        // Same answer whether the email or the password is wrong
        if (!user || user.is_demo || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid email or password' })
        }

        res.json({ message: 'Login successful', user: publicUser(user), ...issueTokens(user) })
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ error: 'Login failed' })
    }
})

// Exchange a refresh token for a new pair (the old one stops working)
router.post('/refresh', (req, res) => {
    try {
        const refreshToken = req.body?.refreshToken
        if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' })

        const decoded = verifyRefreshToken(refreshToken)
        const session = decoded && db.prepare('SELECT * FROM sessions WHERE refresh_token = ? AND user_id = ?')
            .get(hashToken(refreshToken), decoded.userId)
        if (!session || session.expires_at < new Date().toISOString()) {
            return res.status(401).json({ error: 'Session expired. Please sign in again.' })
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId)
        if (!user) return res.status(401).json({ error: 'User not found' })

        db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id)
        res.json(issueTokens(user))
    } catch (error) {
        console.error('Refresh error:', error)
        res.status(500).json({ error: 'Could not refresh session' })
    }
})

// Current user
router.get('/me', (req, res) => {
    try {
        const header = req.headers.authorization || ''
        const decoded = header.startsWith('Bearer ') ? verifyAccessToken(header.slice(7)) : null
        if (!decoded) return res.status(401).json({ error: 'Not authenticated' })

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId)
        if (!user) return res.status(404).json({ error: 'User not found' })

        res.json(publicUser(user))
    } catch (error) {
        console.error('Get current user error:', error)
        res.status(500).json({ error: 'Failed to load account' })
    }
})

// Logout — ends this session so its refresh token can't be reused
router.post('/logout', (req, res) => {
    try {
        const refreshToken = req.body?.refreshToken
        if (refreshToken) db.prepare('DELETE FROM sessions WHERE refresh_token = ?').run(hashToken(refreshToken))
        res.json({ message: 'Logged out successfully' })
    } catch (error) {
        console.error('Logout error:', error)
        res.status(500).json({ error: 'Logout failed' })
    }
})

export default router
