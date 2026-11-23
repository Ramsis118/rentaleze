// Phone verification codes with Twilio Verify (Twilio sends and checks the code;
// nothing is stored on our side). Uses Twilio's REST API directly, no extra package.
const BASE = 'https://verify.twilio.com/v2/Services'

export const smsConfigured = () =>
    !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID)

// Local development without Twilio: the code is always 123456
export const smsDevMode = () => !smsConfigured() && process.env.NODE_ENV !== 'production'
export const DEV_CODE = '123456'

// US-first: turn "(404) 555-1234" into "+14045551234". Returns null if it can't be a real number.
export function toE164(input) {
    const raw = String(input || '').trim()
    const digits = raw.replace(/\D/g, '')
    if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    return null
}

async function twilio(path, params) {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const res = await fetch(`${BASE}/${process.env.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const err = new Error(data.message || `Twilio error ${res.status}`)
        err.status = res.status
        throw err
    }
    return data
}

export async function sendCode(phone) {
    if (smsDevMode()) return { status: 'pending', dev: true }
    return twilio('Verifications', { To: phone, Channel: 'sms' })
}

export async function checkCode(phone, code) {
    if (smsDevMode()) return String(code).trim() === DEV_CODE
    try {
        const result = await twilio('VerificationCheck', { To: phone, Code: String(code).trim() })
        return result.status === 'approved'
    } catch (err) {
        // 404 = code expired or already used
        if (err.status === 404) return false
        throw err
    }
}


// ─── Notification texts (Twilio Messaging) ──────────────────────────────────
// Needs TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID
// (recommended — handles A2P 10DLC registration and STOP replies) or TWILIO_FROM_NUMBER.
export const smsSendingConfigured = () =>
    !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER))

export const maskPhone = (p) => String(p || '').replace(/.(?=.{4})/g, '•')

// Returns { status: 'sent' | 'dev', id }
export async function sendSms(to, body) {
    if (!smsSendingConfigured()) {
        if (process.env.NODE_ENV === 'production') throw new Error('Text messages are not configured (Twilio messaging missing)')
        if (process.env.LOG_EMAILS !== 'false') console.log(`📱 [dev sms] to=${maskPhone(to)} "${body}"`)
        return { status: 'dev', id: null }
    }
    const sid = process.env.TWILIO_ACCOUNT_SID
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const params = { To: to, Body: body }
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.MessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
    else params.From = process.env.TWILIO_FROM_NUMBER
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
        signal: AbortSignal.timeout(15000)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Twilio error ${res.status}`)
    return { status: 'sent', id: data.sid || null }
}
