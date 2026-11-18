import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

// In production the secrets must come from the environment. A built-in fallback
// would let anyone who reads this code forge a login for any account.
if (process.env.NODE_ENV === 'production' && (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET)) {
    throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set in production')
}
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-only-access-secret'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-only-refresh-secret'
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'

export function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    )
}

export function generateRefreshToken(user) {
    return jwt.sign(
        // jti makes every refresh token unique, even two issued in the same second
        { userId: user.id, type: 'refresh', jti: randomUUID() },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    )
}

export function verifyAccessToken(token) {
    try {
        return jwt.verify(token, ACCESS_TOKEN_SECRET)
    } catch {
        return null
    }
}

export function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, REFRESH_TOKEN_SECRET)
    } catch {
        return null
    }
}