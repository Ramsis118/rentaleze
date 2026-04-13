import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Get user's payment methods
router.get('/', authenticate, (req, res) => {
    try {
        const methods = db.prepare('SELECT * FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.id)
        res.json(methods)
    } catch (error) {
        console.error('Get payment methods error:', error)
        res.status(500).json({ error: 'Failed to fetch payment methods' })
    }
})

// Add new payment method (Mocked for now)
router.post('/', authenticate, (req, res) => {
    try {
        const { last4, brand, expMonth, expYear } = req.body
        
        if (!last4 || !brand || !expMonth || !expYear) {
            return res.status(400).json({ error: 'Missing card details' })
        }

        // Check if user has any methods
        const hasMethods = db.prepare('SELECT 1 FROM payment_methods WHERE user_id = ?').get(req.user.id)
        const isDefault = hasMethods ? 0 : 1

        const id = uuidv4()
        db.prepare(`
            INSERT INTO payment_methods (id, user_id, last_4, brand, exp_month, exp_year, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.user.id, last4, brand, expMonth, expYear, isDefault)

        const newMethod = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id)
        res.status(201).json(newMethod)
    } catch (error) {
        console.error('Add payment method error:', error)
        res.status(500).json({ error: 'Failed to add payment method' })
    }
})

// Set as default
router.put('/:id/default', authenticate, (req, res) => {
    try {
        const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
        
        if (!method) {
            return res.status(404).json({ error: 'Payment method not found' })
        }

        // Transaction to reset others and set this to default
        const transaction = db.transaction(() => {
            db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.user.id)
            db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(req.params.id)
        })
        
        transaction()
        res.json({ message: 'Default payment method updated' })
    } catch (error) {
        console.error('Set default payment error:', error)
        res.status(500).json({ error: 'Failed to update default payment method' })
    }
})

// Delete payment method
router.delete('/:id', authenticate, (req, res) => {
    try {
        const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
        
        if (!method) {
            return res.status(404).json({ error: 'Payment method not found' })
        }

        db.prepare('DELETE FROM payment_methods WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)

        // If it was default, make the most recently added one default
        if (method.is_default) {
            const next = db.prepare('SELECT id FROM payment_methods WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id)
            if (next) {
                db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(next.id)
            }
        }

        res.json({ message: 'Payment method removed' })
    } catch (error) {
        console.error('Delete payment method error:', error)
        res.status(500).json({ error: 'Failed to remove payment method' })
    }
})

export default router
