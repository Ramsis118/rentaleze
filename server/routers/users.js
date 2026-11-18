import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import { BASE_SELECT, toListing } from './listings.js'

import { UPLOADS_DIR } from '../utils/paths.js'
import { toE164 } from '../services/sms.js'

// Configure Multer Storage for file uploads
const uploadDir = UPLOADS_DIR

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'avatar') {
            cb(null, path.join(uploadDir, 'avatars'))
        } else {
            cb(new Error('Invalid fieldname'))
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, req.user.id + '-' + file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

const router = Router()

// Update user profile
router.put('/profile', authenticate, (req, res) => {
    try {
        const { firstName, lastName, avatar, bio, phone, address } = req.body
        
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First and last name required' })
        }

        // Changing the phone number here un-verifies it until a new code is confirmed
        const current = db.prepare('SELECT phone FROM users WHERE id = ?').get(req.user.id)
        const newPhone = phone ? (toE164(phone) || String(phone).slice(0, 20)) : null
        const phoneChanged = (newPhone || null) !== (current?.phone || null)

        db.prepare(`
            UPDATE users 
            SET first_name = ?, last_name = ?, avatar = ?, bio = ?, phone = ?, address = ?,
                phone_verified = CASE WHEN ? THEN 0 ELSE phone_verified END, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(String(firstName).slice(0, 60), String(lastName).slice(0, 60), avatar || null, bio ? String(bio).slice(0, 1000) : null,
            newPhone, address || null, phoneChanged ? 1 : 0, req.user.id)

        const updatedUser = db.prepare('SELECT id, email, first_name, last_name, avatar, bio, phone, address, role, is_verified, phone_verified, created_at FROM users WHERE id = ?').get(req.user.id)
        res.json(updatedUser)
    } catch (error) {
        console.error('Update profile error:', error)
        res.status(500).json({ error: 'Failed to update profile' })
    }
})

// Upload Avatar Image
router.post('/profile/avatar', authenticate, upload.single('avatar'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
        
        // Return URL path for the client
        const avatarUrl = `/uploads/avatars/${req.file.filename}`
        res.json({ avatar: avatarUrl })
    } catch (error) {
        console.error('Avatar upload error:', error)
        res.status(500).json({ error: 'Failed to upload avatar' })
    }
})

// ID photos are no longer uploaded to Rentaleze. Stripe Identity handles the ID check:
// see server/routers/verification.js (/api/verification/*).
router.post('/profile/verification', authenticate, (req, res) => {
    res.status(410).json({ error: 'ID upload has moved. Use Verify my ID on the verification page.' })
})
router.post('/profile/verify-phone', authenticate, (req, res) => {
    res.status(410).json({ error: 'Phone checks have moved. Use the verification page.' })
})

// Get saved listings
router.get('/saved', authenticate, (req, res) => {
    try {
        const saved = db.prepare(`
            ${BASE_SELECT}
            JOIN saved_listings sl ON sl.listing_id = l.id
            WHERE sl.user_id = ? AND l.status = 'active'
            ORDER BY sl.created_at DESC
        `).all(req.user.id)

        res.json(saved.map(toListing))
    } catch (error) {
        console.error('Get saved listings error:', error)
        res.status(500).json({ error: 'Failed to fetch saved listings' })
    }
})

// Check if a specific listing is saved
router.get('/saved/:listingId', authenticate, (req, res) => {
    try {
        const saved = db.prepare('SELECT 1 FROM saved_listings WHERE user_id = ? AND listing_id = ?').get(req.user.id, req.params.listingId)
        res.json({ saved: !!saved })
    } catch (error) {
        res.status(500).json({ error: 'Failed' })
    }
})

// Save a listing
router.post('/saved/:listingId', authenticate, (req, res) => {
    try {
        db.prepare('INSERT OR IGNORE INTO saved_listings (user_id, listing_id) VALUES (?, ?)').run(req.user.id, req.params.listingId)
        res.json({ message: 'Saved successfully' })
    } catch (error) {
        console.error('Save listing error:', error)
        res.status(500).json({ error: 'Failed to save listing' })
    }
})

// Unsave a listing
router.delete('/saved/:listingId', authenticate, (req, res) => {
    try {
        db.prepare('DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?').run(req.user.id, req.params.listingId)
        res.json({ message: 'Removed successfully' })
    } catch (error) {
        console.error('Unsave listing error:', error)
        res.status(500).json({ error: 'Failed to remove saved listing' })
    }
})

// Public profile: name, verification badges and reviews (no contact details)
router.get('/:id/public', (req, res) => {
    try {
        const u = db.prepare(`SELECT id, first_name, last_name, avatar, bio, is_verified, phone_verified, created_at, is_demo
            FROM users WHERE id = ? AND COALESCE(suspended, 0) = 0`).get(req.params.id)
        if (!u) return res.status(404).json({ error: 'User not found' })
        const reviews = db.prepare(`
            SELECT r.rating, r.text, r.created_at, r.reviewer_role, r.user_name AS reviewer_name, r.user_avatar AS reviewer_avatar,
                   l.title AS listing_title
            FROM reviews r LEFT JOIN listings l ON l.id = r.listing_id
            WHERE r.subject_user_id = ? ORDER BY r.created_at DESC LIMIT 50
        `).all(u.id)
        const avg = (role) => {
            const list = reviews.filter(r => r.reviewer_role === role)
            return list.length ? Math.round(list.reduce((s, r) => s + r.rating, 0) / list.length * 10) / 10 : null
        }
        res.json({
            id: u.id,
            name: `${u.first_name} ${u.last_name ? u.last_name[0] + '.' : ''}`.trim(),
            avatar: u.avatar || null,
            bio: u.bio || '',
            memberSince: u.created_at ? new Date(u.created_at).getFullYear() : null,
            idVerified: u.is_verified === 1,
            phoneVerified: u.phone_verified === 1,
            asOwner: { rating: avg('renter'), count: reviews.filter(r => r.reviewer_role === 'renter').length },
            asRenter: { rating: avg('owner'), count: reviews.filter(r => r.reviewer_role === 'owner').length },
            reviews: reviews.map(r => ({
                rating: r.rating, text: r.text, createdAt: r.created_at,
                about: r.reviewer_role === 'renter' ? 'owner' : 'renter',
                reviewerName: r.reviewer_name, reviewerAvatar: r.reviewer_avatar, listingTitle: r.listing_title
            }))
        })
    } catch (error) {
        console.error('Public profile error:', error)
        res.status(500).json({ error: 'Failed to load profile' })
    }
})

export default router
