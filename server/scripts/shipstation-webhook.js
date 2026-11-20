// Registers (or shows) the ShipStation tracking webhook. Never prints the API key.
//   node server/scripts/shipstation-webhook.js https://beta.rentaleze.com <SHIPSTATION_WEBHOOK_TOKEN>
import 'dotenv/config'

const key = (process.env.SHIPSTATION_API_KEY || '').trim()
const [base, token] = process.argv.slice(2)
if (!key || !base || !token) {
    console.log('Usage: node server/scripts/shipstation-webhook.js <site url> <webhook token>  (API key comes from .env)')
    process.exit(1)
}
const url = `${base.replace(/\/$/, '')}/api/shipping/webhook?token=${encodeURIComponent(token)}`
const api = async (method, path, body) => {
    const res = await fetch(`https://api.shipstation.com${path}`, {
        method, headers: { 'API-Key': key, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body)
    })
    const text = await res.text()
    let data; try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text.slice(0, 300) } }
    if (!res.ok) throw new Error(`${res.status}: ${data?.errors?.map(e => e.message).join('; ') || data.raw || ''}`)
    return data
}
const hide = (u) => String(u).replace(/token=[^&]+/, 'token=…')

const existing = await api('GET', '/v2/environment/webhooks')
const list = Array.isArray(existing) ? existing : existing.webhooks || []
console.log(`Existing webhooks: ${list.length}`)
for (const w of list) console.log(`  ${w.webhook_id}  ${w.event}  ${hide(w.url)}`)

const same = list.find(w => w.event === 'track' && w.url === url)
if (same) {
    console.log('Tracking webhook already registered.')
} else {
    const created = await api('POST', '/v2/environment/webhooks', { event: 'track', url })
    console.log(`Registered tracking webhook ${created.webhook_id} → ${hide(created.url || url)}`)
}
