import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

// Configure Multer Storage for file uploads
const uploadDir = path.join(process.cwd(), 'uploads')
fs.mkdirSync(path.join(uploadDir, 'avatars'), { recursive: true })
fs.mkdirSync(path.join(uploadDir, 'ids'), { recursive: true })

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'avatar') {
            cb(null, path.join(uploadDir, 'avatars'))
        } else if (file.fieldname === 'id_front' || file.fieldname === 'id_back') {
            cb(null, path.join(uploadDir, 'ids'))
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

        db.prepare(`
            UPDATE users 
            SET first_name = ?, last_name = ?, avatar = ?, bio = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(firstName, lastName, avatar || null, bio || null, phone || null, address || null, req.user.id)

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

// Upload ID Documents
router.post('/profile/verification', authenticate, upload.fields([{ name: 'id_front', maxCount: 1 }, { name: 'id_back', maxCount: 1 }]), (req, res) => {
    try {
        const files = req.files
        if (!files || !files.id_front || !files.id_back) {
            return res.status(400).json({ error: 'Both front and back ID images are required' })
        }

        const idFrontUrl = `/uploads/ids/${files.id_front[0].filename}`
        const idBackUrl = `/uploads/ids/${files.id_back[0].filename}`

        db.prepare(`
            UPDATE users SET id_front = ?, id_back = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(idFrontUrl, idBackUrl, req.user.id)

        res.json({ message: 'ID documents uploaded successfully' })
    } catch (error) {
        console.error('ID upload error:', error)
        res.status(500).json({ error: 'Failed to upload ID' })
    }
})

// Mock Phone Verification
router.post('/profile/verify-phone', authenticate, (req, res) => {
    try {
        const { code } = req.body
        if (code !== '123456') {
            return res.status(400).json({ error: 'Invalid verification code. Enter 123456 for demo.' })
        }

        db.prepare(`
            UPDATE users SET phone_verified = 1, is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.user.id)

        res.json({ message: 'Phone verified successfully' })
    } catch (error) {
        console.error('Phone verification error:', error)
        res.status(500).json({ error: 'Failed to verify phone' })
    }
})

// Get saved listings
router.get('/saved', authenticate, (req, res) => {
    try {
        const saved = db.prepare(`
            SELECT l.*, 
                   EXISTS(SELECT 1 FROM saved_listings sl WHERE sl.listing_id = l.id AND sl.user_id = ?) as is_saved
            FROM saved_listings sl
            JOIN listings l ON sl.listing_id = l.id
            WHERE sl.user_id = ?
            ORDER BY sl.created_at DESC
        `).all(req.user.id, req.user.id)
        
        res.json(saved)
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

export default router
