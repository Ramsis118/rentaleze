import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js'

const router = Router()

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password, firstName, lastName, role } = req.body

        // Validate
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' })
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' })
        }

        // Check if email exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' })
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12)

        // Create user
        const userId = uuidv4()
        db.prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, passwordHash, firstName, lastName, role || 'renter')

        const user = { id: userId, email, first_name: firstName, last_name: lastName, role: role || 'renter' }

        // Generate tokens
        const accessToken = generateAccessToken(user)
        const refreshToken = generateRefreshToken(user)

        res.status(201).json({
            message: 'Account created successfully',
            user: { id: userId, email, firstName, lastName, role: role || 'renter' },
            accessToken,
            refreshToken
        })
    } catch (error) {
        console.error('Signup error:', error)
        res.status(500).json({ error: 'Failed to create account' })
    }
})

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' })
        }

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' })
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash)

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' })
        }

        // Generate tokens
        const accessToken = generateAccessToken(user)
        const refreshToken = generateRefreshToken(user)

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                avatar: user.avatar,
                bio: user.bio,
                phone: user.phone,
                address: user.address,
                phone_verified: user.phone_verified,
                is_verified: user.is_verified,
                role: user.role
            },
            accessToken,
            refreshToken
        })
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ error: 'Login failed' })
    }
})

// Refresh token
router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' })
    }

    const decoded = verifyRefreshToken(refreshToken)

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid refresh token' })
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId)

    if (!user) {
        return res.status(401).json({ error: 'User not found' })
    }

    const newAccessToken = generateAccessToken(user)
    const newRefreshToken = generateRefreshToken(user)

    res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
    })
})

// Get current user
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({ error: 'Not authenticated' })
    }

    const token = authHeader.split(' ')[1]
    const jwt = await import('jsonwebtoken')
    const decoded = jwt.default.verify(token, process.env.ACCESS_TOKEN_SECRET)

    const user = db.prepare(`
    SELECT id, email, first_name, last_name, avatar, bio, phone, address, role, is_verified, phone_verified, created_at
    FROM users WHERE id = ?
  `).get(decoded.userId)

    if (!user) {
        return res.status(404).json({ error: 'User not found' })
    }

    res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
        bio: user.bio,
        phone: user.phone,
        address: user.address,
        role: user.role,
        isVerified: user.is_verified,
        phoneVerified: user.phone_verified,
        createdAt: user.created_at
    })
})

// Logout
router.post('/logout', (req, res) => {
    const { refreshToken } = req.body

    if (refreshToken) {
        // Remove session from database
        db.prepare('DELETE FROM sessions WHERE refresh_token = ?').run(refreshToken)
    }

    res.json({ message: 'Logged out successfully' })
})

export default router