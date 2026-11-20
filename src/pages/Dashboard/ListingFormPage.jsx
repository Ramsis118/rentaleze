import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../api'
import { CATEGORIES } from '../../data/listings'

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']
const MAX_PHOTOS = 10

const EMPTY = {
    title: '',
    category: '',
    description: '',
    pricePerDay: '',
    condition: '',
    location: '',
    shipping: false,
    instantBook: false,
    images: [],
    includesText: '',
    rulesText: '',
    specsText: '',
    // Packed size for shipping quotes and labels
    weightLb: '',
    lengthIn: '',
    widthIn: '',
    heightIn: '',
    shipFrom: { name: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '' },
}

const hasAny = (obj) => Object.values(obj).some(v => String(v || '').trim())

// "Key: value" per line  <->  { Key: 'value' }
const specsToText = (specs = {}) => Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join('\n')
const textToSpecs = (text) => {
    const specs = {}
    for (const line of text.split('\n')) {
        const i = line.indexOf(':')
        if (i > 0) {
            const k = line.slice(0, i).trim()
            const v = line.slice(i + 1).trim()
            if (k && v) specs[k] = v
        }
    }
    return specs
}
const lines = (text) => text.split('\n').map(s => s.trim()).filter(Boolean)

function Field({ label, hint, children }) {
    return (
        <div>
            <label className="block text-sm font-bold text-rl-dark mb-1.5">{label}</label>
            {children}
            {hint && <p className="text-xs text-rl-gray-2 mt-1">{hint}</p>}
        </div>
    )
}

export default function ListingFormPage() {
    const { id } = useParams()
    const isEdit = Boolean(id)
    const navigate = useNavigate()
    const fileInput = useRef(null)

    const [form, setForm] = useState(EMPTY)
    const [loading, setLoading] = useState(isEdit)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [currentStatus, setCurrentStatus] = useState(null)

    useEffect(() => {
        if (!isEdit) return
        api.getListing(id)
            .then(l => {
                setForm({
                    title: l.title,
                    category: l.category,
                    description: l.description || '',
                    pricePerDay: String(l.pricePerDay),
                    condition: l.condition || '',
                    location: l.location || '',
                    shipping: l.shipping,
                    instantBook: l.instantBook,
                    images: l.images || [],
                    includesText: (l.includes || []).join('\n'),
                    rulesText: (l.rules || []).join('\n'),
                    specsText: specsToText(l.specs),
                    weightLb: l.package ? String(l.package.weightLb) : '',
                    lengthIn: l.package ? String(l.package.lengthIn) : '',
                    widthIn: l.package ? String(l.package.widthIn) : '',
                    heightIn: l.package ? String(l.package.heightIn) : '',
                    shipFrom: { ...EMPTY.shipFrom, ...(l.shipFrom || {}) },
                })
                setCurrentStatus(l.status)
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [id, isEdit])

    const set = (key) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
        setForm(f => ({ ...f, [key]: value }))
    }
    const setShipFrom = (key) => (e) => {
        const value = key === 'state' ? e.target.value.toUpperCase() : e.target.value
        setForm(f => ({ ...f, shipFrom: { ...f.shipFrom, [key]: value } }))
    }

    const handlePhotos = async (e) => {
        const files = Array.from(e.target.files || [])
        e.target.value = ''
        if (!files.length) return
        const room = MAX_PHOTOS - form.images.length
        if (room <= 0) {
            setError(`You can add up to ${MAX_PHOTOS} photos.`)
            return
        }
        setUploading(true)
        setError('')
        try {
            const { urls } = await api.uploadListingPhotos(files.slice(0, room))
            setForm(f => ({ ...f, images: [...f.images, ...urls] }))
        } catch (err) {
            setError(err.message)
        } finally {
            setUploading(false)
        }
    }

    const removePhoto = (i) => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))
    const makeCover = (i) => setForm(f => ({ ...f, images: [f.images[i], ...f.images.filter((_, j) => j !== i)] }))

    const submit = async (status) => {
        setError('')
        if (!form.title.trim() || !form.category || !form.pricePerDay) {
            setError('Add a title, category and daily price.')
            return
        }
        if (status === 'active' && form.images.length === 0) {
            setError('Add at least one photo before publishing.')
            return
        }
        if (status === 'active' && !form.location.trim()) {
            setError('Add a pickup location before publishing.')
            return
        }
        const sizeFields = [form.weightLb, form.lengthIn, form.widthIn, form.heightIn]
        if (status === 'active' && form.shipping && sizeFields.some(v => !(Number(v) > 0))) {
            setError('Add the packed size and weight (L × W × H and lb) so renters get an accurate shipping price.')
            return
        }
        if (status === 'active' && form.shipping && !hasAny(form.shipFrom)) {
            setError('Add a ship-from address so shipping labels can be created.')
            return
        }

        const payload = {
            title: form.title,
            category: form.category,
            description: form.description,
            pricePerDay: Number(form.pricePerDay),
            condition: form.condition || null,
            location: form.location,
            shipping: form.shipping,
            instantBook: form.instantBook,
            images: form.images,
            includes: lines(form.includesText),
            rules: lines(form.rulesText),
            specs: textToSpecs(form.specsText),
            package: sizeFields.some(v => String(v).trim())
                ? { weightLb: form.weightLb, lengthIn: form.lengthIn, widthIn: form.widthIn, heightIn: form.heightIn }
                : null,
            shipFrom: hasAny(form.shipFrom) ? form.shipFrom : null,
            status,
        }

        setSaving(true)
        try {
            const saved = isEdit ? await api.updateListing(id, payload) : await api.createListing(payload)
            navigate(status === 'active' ? `/listing/${saved.id}` : '/dashboard/listings')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="py-12 flex justify-center">
                <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />
            </div>
        )
    }

    const busy = saving || uploading

    return (
        <div className="max-w-2xl">
            <Link to="/dashboard/listings" className="text-sm text-rl-gray hover:text-rl-blue-600">← My Listings</Link>
            <h1 className="text-2xl font-extrabold text-rl-dark mt-2 mb-6">{isEdit ? 'Edit listing' : 'List an item'}</h1>

            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit('active') }}>
                {/* Photos */}
                <Field label="Photos" hint={`Up to ${MAX_PHOTOS}. The first photo is the cover. JPG, PNG or WebP, 8 MB max each.`}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {form.images.map((src, i) => (
                            <div key={src} className="relative aspect-square rounded-xl overflow-hidden border border-rl-gray-3 group">
                                <img src={src} alt="" className="w-full h-full object-cover" />
                                {i === 0 && (
                                    <span className="absolute top-1.5 left-1.5 bg-rl-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Cover</span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 flex justify-between p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                                    {i !== 0 ? (
                                        <button type="button" onClick={() => makeCover(i)} className="text-[11px] font-semibold text-white">Make cover</button>
                                    ) : <span />}
                                    <button type="button" onClick={() => removePhoto(i)} className="text-[11px] font-semibold text-white">Remove</button>
                                </div>
                            </div>
                        ))}
                        {form.images.length < MAX_PHOTOS && (
                            <button
                                type="button"
                                onClick={() => fileInput.current?.click()}
                                disabled={uploading}
                                className="aspect-square rounded-xl border-2 border-dashed border-rl-gray-3 hover:border-rl-blue text-rl-gray hover:text-rl-blue-600 flex flex-col items-center justify-center text-sm font-medium transition-colors disabled:opacity-60"
                            >
                                <span className="text-2xl leading-none mb-1">+</span>
                                {uploading ? 'Uploading…' : 'Add photos'}
                            </button>
                        )}
                    </div>
                    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={handlePhotos} />
                </Field>

                <Field label="Title">
                    <input className="input-field" value={form.title} onChange={set('title')} maxLength={100}
                        placeholder="e.g. Ryobi 2300 PSI Electric Pressure Washer" />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Category">
                        <select className="input-field" value={form.category} onChange={set('category')}>
                            <option value="">Choose a category</option>
                            {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Condition">
                        <select className="input-field" value={form.condition} onChange={set('condition')}>
                            <option value="">Select condition</option>
                            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Daily price (USD)">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rl-gray">$</span>
                            <input className="input-field pl-8" type="number" min="1" max="10000" step="1"
                                value={form.pricePerDay} onChange={set('pricePerDay')} placeholder="35" />
                        </div>
                    </Field>
                    <Field label="Pickup location" hint="City and state only — your exact address is never shown.">
                        <input className="input-field" value={form.location} onChange={set('location')} maxLength={120}
                            placeholder="Atlanta, GA" />
                    </Field>
                </div>

                <Field label="Description">
                    <textarea className="input-field min-h-[120px]" value={form.description} onChange={set('description')}
                        maxLength={5000} placeholder="What is it, what's it good for, and anything a renter should know." />
                </Field>

                <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={form.instantBook} onChange={set('instantBook')} />
                        <span>
                            <span className="block text-sm font-bold text-rl-dark">Instant Book</span>
                            <span className="block text-xs text-rl-gray">Renters can book without waiting for your approval.</span>
                        </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={form.shipping} onChange={set('shipping')} />
                        <span>
                            <span className="block text-sm font-bold text-rl-dark">Shipping available</span>
                            <span className="block text-xs text-rl-gray">You're willing to ship this item, not just local pickup.</span>
                        </span>
                    </label>
                </div>

                {form.shipping && (
                    <div className="border border-rl-blue-100 bg-rl-blue-50 rounded-xl p-4 space-y-5">
                        <div>
                            <p className="text-sm font-bold text-rl-dark">Package size</p>
                            <p className="text-xs text-rl-gray mt-0.5">
                                Measure the item packed in its box. Carriers price by weight and size, so this sets the
                                shipping price renters see. Prepaid send and return labels are created when you confirm a rental.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                {[['lengthIn', 'Length (in)', '24'], ['widthIn', 'Width (in)', '14'], ['heightIn', 'Height (in)', '12'], ['weightLb', 'Weight (lb)', '18']].map(([key, label, ph]) => (
                                    <Field key={key} label={label}>
                                        <input className="input-field" type="number" min={key === 'weightLb' ? '0.1' : '1'}
                                            max={key === 'weightLb' ? '150' : '108'} step="0.1"
                                            value={form[key]} onChange={set(key)} placeholder={ph} />
                                    </Field>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-bold text-rl-dark">Ship-from address</p>
                            <p className="text-xs text-rl-gray mt-0.5">
                                Printed on the send label and used as the return address. Only you and the shipping carrier see it.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <Field label="Name">
                                    <input className="input-field" value={form.shipFrom.name} onChange={setShipFrom('name')} maxLength={80} placeholder="Your name or business" />
                                </Field>
                                <Field label="Phone">
                                    <input className="input-field" type="tel" value={form.shipFrom.phone} onChange={setShipFrom('phone')} maxLength={20} placeholder="(404) 555-0100" />
                                </Field>
                                <Field label="Street address">
                                    <input className="input-field" value={form.shipFrom.line1} onChange={setShipFrom('line1')} maxLength={100} placeholder="123 Peachtree St" />
                                </Field>
                                <Field label="Apt / suite (optional)">
                                    <input className="input-field" value={form.shipFrom.line2} onChange={setShipFrom('line2')} maxLength={100} />
                                </Field>
                                <Field label="City">
                                    <input className="input-field" value={form.shipFrom.city} onChange={setShipFrom('city')} maxLength={60} placeholder="Atlanta" />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="State">
                                        <input className="input-field" value={form.shipFrom.state} onChange={setShipFrom('state')} maxLength={2} placeholder="GA" />
                                    </Field>
                                    <Field label="ZIP">
                                        <input className="input-field" inputMode="numeric" value={form.shipFrom.zip} onChange={setShipFrom('zip')} maxLength={5} placeholder="30303" />
                                    </Field>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <details className="border border-rl-gray-3 rounded-xl p-4" open={Boolean(form.includesText || form.rulesText || form.specsText)}>
                    <summary className="text-sm font-bold text-rl-dark cursor-pointer">More details (optional)</summary>
                    <div className="space-y-4 mt-4">
                        <Field label="What's included" hint="One item per line.">
                            <textarea className="input-field min-h-[90px]" value={form.includesText} onChange={set('includesText')}
                                placeholder={'Pressure washer\n25 ft hose\n3 nozzles'} />
                        </Field>
                        <Field label="Rental rules" hint="One rule per line.">
                            <textarea className="input-field min-h-[90px]" value={form.rulesText} onChange={set('rulesText')}
                                placeholder={'Return clean and dry\nNo use on painted wood'} />
                        </Field>
                        <Field label="Specifications" hint='One per line, written as "Name: value".'>
                            <textarea className="input-field min-h-[90px]" value={form.specsText} onChange={set('specsText')}
                                placeholder={'PSI: 2300\nPower: Electric'} />
                        </Field>
                    </div>
                </details>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                        {saving ? 'Saving…' : (isEdit && currentStatus === 'active' ? 'Save changes' : 'Publish listing')}
                    </button>
                    {(!isEdit || currentStatus !== 'active') && (
                        <button type="button" disabled={busy} onClick={() => submit('draft')} className="btn-outline disabled:opacity-60">
                            Save as draft
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}
