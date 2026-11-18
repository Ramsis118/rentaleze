// ID verification with Stripe Identity (document + matching selfie).
// Rentaleze never stores ID photos: Stripe collects and checks them, and we
// keep only the result (verified / failed) and the session id.
import Stripe from 'stripe'
import db from '../db/database.js'

let client = null
export function identityStripe() {
    if (!process.env.STRIPE_SECRET_KEY) return null
    if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY)
    return client
}

export const identityConfigured = () => !!process.env.STRIPE_SECRET_KEY
// Local development without Stripe keys: allow a simulated check so the app is testable
export const identityDevMode = () => !identityConfigured() && process.env.NODE_ENV !== 'production'

const FRIENDLY_ERRORS = {
    consent_declined: 'You declined the ID check. You can try again any time.',
    under_supported_age: 'You must be 18 or older to use Rentaleze.',
    country_not_supported: 'IDs from this country are not supported yet.',
    document_expired: 'That ID has expired. Please use a current ID.',
    document_type_not_supported: 'Please use a driver’s license, state ID or passport.',
    document_unverified_other: 'We could not verify that ID. Please try again with a clear photo.',
    selfie_face_mismatch: 'The selfie did not match the photo on your ID. Please try again.',
    selfie_document_missing_photo: 'Your ID needs to have a photo of your face.',
    selfie_manipulated: 'The selfie could not be accepted. Please try again.',
    selfie_unverified_other: 'We could not verify the selfie. Please try again in good light.'
}

export const friendlyError = (lastError) =>
    lastError ? (FRIENDLY_ERRORS[lastError.code] || lastError.reason || 'Verification did not pass. Please try again.') : null

export async function createIdentitySession(user, returnUrl) {
    const stripe = identityStripe()
    const session = await stripe.identity.verificationSessions.create({
        type: 'document',
        client_reference_id: user.id,
        metadata: { user_id: user.id },
        provided_details: { email: user.email },
        options: {
            document: {
                allowed_types: ['driving_license', 'id_card', 'passport'],
                require_live_capture: true,
                require_matching_selfie: true
            }
        },
        return_url: returnUrl
    })
    db.prepare(`UPDATE users SET identity_session_id = ?, id_status = 'pending', id_last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(session.id, user.id)
    return session
}

// Apply a VerificationSession's state to the matching user (from webhook or a manual refresh)
export function applyIdentitySession(session) {
    const userId = session.metadata?.user_id || session.client_reference_id
    if (!userId) return null
    const user = db.prepare('SELECT id, identity_session_id FROM users WHERE id = ?').get(userId)
    if (!user) return null
    // Ignore events from an older session the user has since replaced
    if (user.identity_session_id && user.identity_session_id !== session.id) return null

    if (session.status === 'verified') {
        db.prepare(`UPDATE users SET id_status = 'verified', is_verified = 1, id_verified_at = CURRENT_TIMESTAMP,
            id_last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(userId)
    } else if (session.status === 'requires_input') {
        // requires_input with no error just means the person hasn't finished yet
        if (session.last_error) {
            db.prepare(`UPDATE users SET id_status = 'failed', is_verified = 0, id_last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                .run(friendlyError(session.last_error), userId)
        }
    } else if (session.status === 'processing') {
        db.prepare(`UPDATE users SET id_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(userId)
    } else if (session.status === 'canceled') {
        db.prepare(`UPDATE users SET id_status = CASE WHEN is_verified = 1 THEN 'verified' ELSE 'none' END,
            identity_session_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(userId)
    }
    return userId
}

export async function refreshIdentityStatus(userId) {
    const stripe = identityStripe()
    const user = db.prepare('SELECT identity_session_id FROM users WHERE id = ?').get(userId)
    if (!stripe || !user?.identity_session_id) return
    const session = await stripe.identity.verificationSessions.retrieve(user.identity_session_id)
    applyIdentitySession(session)
}
