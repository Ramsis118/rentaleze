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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}))

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
})
app.use('/api/', limiter)

// Body parsing
app.use(express.json())

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/listings', listingsRoutes)
app.use('/api/bookings', bookingsRoutes)

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
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