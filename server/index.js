import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

import { initDatabase, seedDatabase } from './db/database.js'
import authRoutes from './routers/auth.js'
import listingsRoutes from './routers/listings.js'
import bookingsRoutes from './routers/bookings.js'
import usersRoutes from './routers/users.js'
import paymentsRoutes from './routers/payments.js'
import messagesRoutes from './routers/messages.js'
import waitlistRoutes from './routers/waitlist.js'
import shippingRoutes from './routers/shipping.js'
import { siteRouting } from './middleware/siteRouting.js'
import { UPLOADS_DIR } from './utils/paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Render (and most hosts) sit behind one proxy; this makes req.hostname,
// req.secure and rate-limit IPs reflect the real visitor
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            // Listing photos and avatars can come from secure (https) image hosts
            'img-src': ["'self'", 'data:', 'blob:', 'https:']
        }
    }
}))
// rentaleze.com → coming-soon page; beta host → password gate (see middleware/siteRouting.js)
app.use(siteRouting())

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}))

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500 // per IP per window; browsing with filters makes many small requests
})
app.use('/api/', limiter)

// Body parsing
app.use(express.json())

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/listings', listingsRoutes)
app.use('/api/bookings', bookingsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/waitlist', waitlistRoutes)
app.use('/api/shipping', shippingRoutes)

// Serve avatars and listing photos publicly (ID photos are never served)
app.use('/uploads/avatars', express.static(join(UPLOADS_DIR, 'avatars')))
app.use('/uploads/listings', express.static(join(UPLOADS_DIR, 'listings')))

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Unknown API routes return JSON 404 (not the website's HTML)
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '../dist')))
    app.get('*', (req, res) => {
        res.sendFile(join(__dirname, '../dist/index.html'))
    })
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err)
    res.status(500).json({ error: 'Internal server error' })
})

// Initialize database and start server
initDatabase()
seedDatabase()

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
    console.log(`📡 API: http://localhost:${PORT}/api`)
})