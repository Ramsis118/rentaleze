// Checks the ShipStation API key in .env and lists carrier IDs for SHIPSTATION_CARRIER_IDS.
// Never prints the key.   node server/scripts/shipstation-carriers.js
import 'dotenv/config'

const key = (process.env.SHIPSTATION_API_KEY || '').trim()
if (!key) {
    console.log('No SHIPSTATION_API_KEY found in .env')
    process.exit(1)
}
console.log(`Key found (${key.length} characters).`)

const res = await fetch('https://api.shipstation.com/v2/carriers', { headers: { 'API-Key': key } })
const text = await res.text()
let data; try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 300) } }
if (!res.ok) {
    console.log(`ShipStation said ${res.status}:`, data?.errors?.map(e => e.message).join('; ') || data.raw || '')
    process.exit(1)
}

const carriers = data.carriers || []
console.log(`Key works. ${carriers.length} carrier(s):\n`)
for (const c of carriers) {
    const services = (c.services || []).filter(s => s.domestic).map(s => s.service_code)
    console.log(`  ${c.carrier_id}  ${c.friendly_name || c.carrier_code}${c.nickname ? ` (${c.nickname})` : ''}`)
    console.log(`     code: ${c.carrier_code}  balance: ${c.balance ?? 'n/a'}  primary: ${c.primary ? 'yes' : 'no'}`)
    if (services.length) console.log(`     domestic services: ${services.join(', ')}`)
}
if (carriers.length) console.log(`\nSHIPSTATION_CARRIER_IDS=${carriers.map(c => c.carrier_id).join(',')}`)
