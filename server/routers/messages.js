import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Get all conversations for a user
router.get('/', authenticate, (req, res) => {
    try {
        const userId = req.user.id
        const convos = db.prepare(`
            SELECT 
                c.id, 
                c.last_message, 
                c.updated_at,
                l.title as listing_title,
                l.image as listing_image,
                u.id as other_user_id,
                u.first_name as other_first_name,
                u.last_name as other_last_name,
                u.avatar as other_avatar
            FROM conversations c
            JOIN listings l ON c.listing_id = l.id
            JOIN users u ON (u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
            WHERE c.user1_id = ? OR c.user2_id = ?
            ORDER BY c.updated_at DESC
        `).all(userId, userId, userId)
        
        res.json(convos)
    } catch (error) {
        console.error('Get conversations error:', error)
        res.status(500).json({ error: 'Failed to fetch conversations' })
    }
})

// Get messages for a specific conversation
router.get('/:id', authenticate, (req, res) => {
    try {
        // First verify user is in this conversation
        const convo = db.prepare('SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(req.params.id, req.user.id, req.user.id)
        
        if (!convo) {
            return res.status(404).json({ error: 'Conversation not found' })
        }

        const messages = db.prepare(`
            SELECT m.*, u.first_name as sender_name, u.avatar as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
        `).all(req.params.id)

        // Mark unread messages as read
        db.prepare('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0').run(req.params.id, req.user.id)

        res.json({ conversation: convo, messages })
    } catch (error) {
        console.error('Get messages error:', error)
        res.status(500).json({ error: 'Failed to fetch messages' })
    }
})

// Create or get conversation and send message
router.post('/', authenticate, (req, res) => {
    try {
        const { listingId, recipientId, text } = req.body
        const senderId = req.user.id

        if (!listingId || !recipientId || !text) {
            return res.status(400).json({ error: 'Missing fields' })
        }

        let conversation = db.prepare(`
            SELECT id FROM conversations 
            WHERE listing_id = ? AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
        `).get(listingId, senderId, recipientId, recipientId, senderId)

        let convoId = conversation?.id
        
        if (!convoId) {
            convoId = uuidv4()
            db.prepare(`
                INSERT INTO conversations (id, listing_id, user1_id, user2_id, last_message)
                VALUES (?, ?, ?, ?, ?)
            `).run(convoId, listingId, senderId, recipientId, text)
        } else {
            db.prepare('UPDATE conversations SET last_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(text, convoId)
        }

        const messageId = uuidv4()
        db.prepare(`
            INSERT INTO messages (id, conversation_id, sender_id, text)
            VALUES (?, ?, ?, ?)
        `).run(messageId, convoId, senderId, text)

        res.status(201).json({ conversationId: convoId, messageId })
    } catch (error) {
        console.error('Send message error:', error)
        res.status(500).json({ error: 'Failed to send message' })
    }
})

export default router
