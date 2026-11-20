// Thin client for the ShipStation API v2 (https://docs.shipstation.com).
// Auth is a single API key sent as the `API-Key` header.
//
// Modes
//   live — SHIPSTATION_API_KEY is set: real rates, real (paid) labels.
//   mock — no key and not production: fake rates/labels so the app works locally and in tests.
//   off  — no key in production: shipping falls back to the flat fee and no labels are bought.

const BASE_URL = (process.env.SHIPSTATION_BASE_URL || 'https://api.shipstation.com').replace(/\/$/, '')
const TIMEOUT_MS = 15000

export function shipstationMode() {
    if (process.env.SHIPSTATION_API_KEY) return 'live'
    return process.env.NODE_ENV === 'production' ? 'off' : 'mock'
}

const list = (v) => String(v || '').split(',').map(s => s.trim()).filter(Boolean)
const carrierIds = () => list(process.env.SHIPSTATION_CARRIER_IDS)
const serviceCodes = () => list(process.env.SHIPSTATION_SERVICE_CODES)
const maxTransitDays = () => Number(process.env.SHIPSTATION_MAX_TRANSIT_DAYS) || 5

export class ShipStationError extends Error {
    constructor(message, status, details) {
        super(message)
        this.status = status
        this.details = details
    }
}

async function call(method, path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { 'API-Key': process.env.SHIPSTATION_API_KEY, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    const text = await res.text()
    let data
    try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
    if (!res.ok) {
        const msg = data?.errors?.map(e => e.message).filter(Boolean).join('; ') || `ShipStation request failed (${res.status})`
        throw new ShipStationError(msg, res.status, data)
    }
    return data
}

// ─── Shapes ─────────────────────────────────────────────────────────────────
// Our address: { name, phone, company, line1, line2, city, state, zip }
export function toSSAddress(a) {
    return {
        name: a.name,
        phone: a.phone || '',
        company_name: a.company || undefined,
        address_line1: a.line1,
        address_line2: a.line2 || undefined,
        city_locality: a.city,
        state_province: a.state,
        postal_code: a.zip,
        country_code: 'US',
        address_residential_indicator: 'unknown'
    }
}

// Our package: { weightOz, lengthIn, widthIn, heightIn }
function toSSPackage(p) {
    return {
        weight: { value: p.weightOz, unit: 'ounce' },
        dimensions: { unit: 'inch', length: p.lengthIn, width: p.widthIn, height: p.heightIn }
    }
}

const amount = (m) => Number(m?.amount) || 0
const rateTotal = (r) => amount(r.shipping_amount) + amount(r.insurance_amount) + amount(r.confirmation_amount) + amount(r.other_amount)

// Pick the cheapest acceptable rate (allowed service, fast enough)
function pickRate(rates) {
    const allowed = serviceCodes()
    const usable = (rates || [])
        .filter(r => !r.error_messages?.length && (r.validation_status !== 'invalid'))
        .filter(r => !allowed.length || allowed.includes(r.service_code))
        .filter(r => r.delivery_days == null || r.delivery_days <= maxTransitDays())
        .map(r => ({ ...r, total: Math.round(rateTotal(r) * 100) / 100 }))
        .sort((a, b) => a.total - b.total)
    return usable[0] || null
}

function toLabel(l, mode = 'live') {
    return {
        mode,
        labelId: l.label_id,
        shipmentId: l.shipment_id,
        carrierCode: l.carrier_code,
        serviceCode: l.service_code,
        trackingNumber: l.tracking_number,
        labelUrl: l.label_download?.pdf || l.label_download?.href || null,
        cost: Math.round((amount(l.shipment_cost) + amount(l.insurance_cost)) * 100) / 100,
        status: l.status
    }
}

// ─── Mock (development / tests) ─────────────────────────────────────────────
let mockSeq = 0
const mockId = (p) => `${p}-mock-${Date.now().toString(36)}${(++mockSeq).toString(36)}`
// Rough USPS-ish price from billable weight: dimensional weight uses a 139 divisor
function mockPrice(pkg) {
    const dimLb = (pkg.lengthIn * pkg.widthIn * pkg.heightIn) / 139
    const lb = Math.max(pkg.weightOz / 16, dimLb)
    return Math.round((7.5 + lb * 0.95) * 100) / 100
}
const mockLabel = (pkg, prefix) => ({
    mode: 'mock',
    labelId: mockId('se'),
    shipmentId: mockId('shp'),
    carrierCode: 'stamps_com',
    serviceCode: 'usps_ground_advantage',
    trackingNumber: `${prefix}${Date.now()}${mockSeq}`,
    labelUrl: null,
    cost: mockPrice(pkg),
    status: 'completed'
})

// ─── API ────────────────────────────────────────────────────────────────────

// Quick estimate from ZIPs/cities only — used before the renter has typed a full address.
// Returns { amount, serviceCode, carrierId, deliveryDays } or null when nothing fits.
export async function estimateRate({ from, to, pkg }) {
    const mode = shipstationMode()
    if (mode === 'mock') return { amount: mockPrice(pkg), serviceCode: 'usps_ground_advantage', carrierId: 'mock', deliveryDays: 3 }
    if (mode !== 'live') return null
    const rates = await call('POST', '/v2/rates/estimate', {
        carrier_ids: carrierIds(),
        from_country_code: 'US',
        from_postal_code: from.zip,
        from_city_locality: from.city,
        from_state_province: from.state,
        to_country_code: 'US',
        to_postal_code: to.zip,
        to_city_locality: to.city || undefined,
        to_state_province: to.state || undefined,
        weight: { value: pkg.weightOz, unit: 'ounce' },
        dimensions: { unit: 'inch', length: pkg.lengthIn, width: pkg.widthIn, height: pkg.heightIn },
        confirmation: 'none',
        address_residential_indicator: 'unknown'
    })
    const best = pickRate(Array.isArray(rates) ? rates : rates?.rates)
    return best && { amount: best.total, serviceCode: best.service_code, carrierId: best.carrier_id, deliveryDays: best.delivery_days ?? null }
}

// Buy the outbound label: rate-shop the full shipment, then purchase the cheapest acceptable rate.
export async function createOutboundLabel({ shipFrom, shipTo, pkg, externalId }) {
    const mode = shipstationMode()
    if (mode === 'mock') return mockLabel(pkg, '9400MOCK')
    if (mode !== 'live') throw new ShipStationError('ShipStation is not configured (SHIPSTATION_API_KEY missing).', 503)

    const rated = await call('POST', '/v2/rates', {
        rate_options: { carrier_ids: carrierIds(), ...(serviceCodes().length ? { service_codes: serviceCodes() } : {}) },
        shipment: {
            external_shipment_id: externalId,
            ship_from: toSSAddress(shipFrom),
            ship_to: toSSAddress(shipTo),
            packages: [toSSPackage(pkg)]
        }
    })
    const best = pickRate(rated?.rate_response?.rates)
    if (!best) {
        const why = rated?.rate_response?.errors?.map(e => e.message).join('; ')
        throw new ShipStationError(why || 'No shipping rate available for this address and package.', 422, rated?.rate_response)
    }
    const label = await call('POST', `/v2/labels/rates/${encodeURIComponent(best.rate_id)}`, {
        label_format: 'pdf', label_layout: '4x6', label_download_type: 'url'
    })
    return toLabel(label)
}

// Return label: ShipStation swaps ship-to and ship-from from the outbound label.
// Most carriers bill a return label only when it is actually scanned/used.
export async function createReturnLabel(outboundLabelId, pkg) {
    const mode = shipstationMode()
    if (mode === 'mock') return mockLabel(pkg, '9400MOCKR')
    if (mode !== 'live') throw new ShipStationError('ShipStation is not configured (SHIPSTATION_API_KEY missing).', 503)
    const label = await call('POST', `/v2/labels/${encodeURIComponent(outboundLabelId)}/return`, {
        label_format: 'pdf', label_layout: '4x6', label_download_type: 'url'
    })
    return toLabel(label)
}

// Void an unused label (refund is requested from the carrier)
export async function voidLabel(labelId) {
    const mode = shipstationMode()
    if (mode === 'mock' || String(labelId).includes('-mock-')) return { approved: true, message: 'Mock label voided' }
    if (mode !== 'live') throw new ShipStationError('ShipStation is not configured.', 503)
    return call('PUT', `/v2/labels/${encodeURIComponent(labelId)}/void`)
}

export async function trackLabel(labelId) {
    if (shipstationMode() !== 'live') return null
    return call('GET', `/v2/labels/${encodeURIComponent(labelId)}/track`)
}
