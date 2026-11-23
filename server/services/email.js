// Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
// Without RESEND_API_KEY (local development) emails are logged instead of sent.
const RESEND_URL = 'https://api.resend.com/emails'

export const emailConfigured = () => !!process.env.RESEND_API_KEY
export const emailFrom = () => process.env.EMAIL_FROM || 'Rentaleze <notifications@rentaleze.com>'
export const appUrl = () => (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// One branded layout for every email: heading, paragraphs, optional button
export function renderEmail({ heading, paragraphs = [], button, footer }) {
    const btn = button
        ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="background:#1E90FF;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;display:inline-block">${esc(button.label)}</a></p>`
        : ''
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#F2F5F8;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1E2B37">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:800;color:#1E90FF;padding-bottom:20px">Rentaleze</td></tr>
<tr><td style="font-size:20px;font-weight:700;padding-bottom:12px">${esc(heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#3A4A5A">${paragraphs.map(p => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('')}${btn}</td></tr>
<tr><td style="font-size:12px;color:#8A99A8;padding-top:20px;border-top:1px solid #E6ECF1">${esc(footer || 'You can change which emails you get in Dashboard → Notifications.')}<br>Rentaleze · Atlanta, GA</td></tr>
</table></td></tr></table></body></html>`
    const text = [heading, '', ...paragraphs, button ? `\n${button.label}: ${button.url}` : '', '', footer || ''].join('\n').trim()
    return { html, text }
}

export const maskEmail = (e) => String(e || '').replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => a + '*'.repeat(Math.min(b.length, 6)) + c)

// Returns { status: 'sent' | 'dev', id }
export async function sendEmail({ to, subject, html, text }) {
    if (!emailConfigured()) {
        if (process.env.NODE_ENV === 'production') throw new Error('Email is not configured (RESEND_API_KEY missing)')
        if (process.env.LOG_EMAILS !== 'false') console.log(`✉️  [dev email] to=${to} subject="${subject}"`)
        return { status: 'dev', id: null }
    }
    const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: emailFrom(), to: [to], subject, html, text }),
        signal: AbortSignal.timeout(15000)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Resend error ${res.status}`)
    return { status: 'sent', id: data.id || null }
}
