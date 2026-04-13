import { Router } from 'express'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Update user profile
router.put('/profile', authenticate, (req, res) => {
    try {
        const { firstName, lastName, avatar } = req.body
        
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First and last name required' })
        }

        db.prepare(`
            UPDATE users 
            SET first_name = ?, last_name = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(firstName, lastName, avatar || null, req.user.id)

        const updatedUser = db.prepare('SELECT id, email, first_name, last_name, avatar, role, is_verified, created_at FROM users WHERE id = ?').get(req.user.id)
        res.json(updatedUser)
    } catch (error) {
        console.error('Update profile error:', error)
        res.status(500).json({ error: 'Failed to update profile' })
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
