jsx
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'

const CheckIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
)
const CalendarIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
)

export default function CheckoutPage() {
    const navigate = useNavigate()
    const { cart, cartTotal, clearCart } = useCart()
    const [step, setStep] = useState(1) // 1: form, 2: confirm
    const [loading, setLoading] = useState(false)

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        intendedUse: '',
        agreedToTerms: false,
    })

    const [errors, setErrors] = useState({})

    const hasShipping = cart.some((item) => item.shipping)

    const update = (key, value) => {
        setForm((f) => ({ ...f, [key]: value }))
        if (errors[key]) setErrors((e) => ({ ...e, [key]: null }))
    }

    const validate = () => {
        const e = {}
        if (!form.firstName.trim()) e.firstName = 'Required'
        if (!form.lastName.trim()) e.lastName = 'Required'
        if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required'
        if (!form.phone.trim()) e.phone = 'Required'
        if (hasShipping) {
            if (!form.address.trim()) e.address = 'Required for shipped items'
            if (!form.city.trim()) e.city = 'Required'
            if (!form.state.trim()) e.state = 'Required'
            if (!form.zip.trim()) e.zip = 'Required'
        }
        if (!form.intendedUse.trim() || form.intendedUse.trim().length < 20)
            e.intendedUse = 'Please describe your intended use (min 20 characters)'
        if (!form.agreedToTerms) e.agreedToTerms = 'You must agree to the rental terms'

        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return

        setLoading(true)
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500))
        setLoading(false)
        setStep(2)
        clearCart()
    }

    const inputCls = (key) =>
        `w-full px-4 py-3 rounded-xl border bg-white text-rl-dark text-sm focus:outline-none focus:ring-2 focus:ring-rl-blue-300 focus:border-rl-blue transition-all ${errors[key] ? 'border-red-400' : 'border-rl-gray-3'
        }`

    // Empty cart
    if (cart.length === 0 && step === 1) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-rl-off-white">
                <div className="text-center px-4">
                    <div className="text-5xl mb-4">🛒</div>
                    <h2 className="text-xl font-extrabold text-rl-dark mb-2">Your cart is empty</h2>
                    <Link to="/browse" className="btn-primary text-sm mt-4 inline-block">
                        Browse Items
                    </Link>
                </div>
            </div>
        )
    }

    // Confirmation Step
    if (step === 2) {
        return (
            <div className="min-h-screen bg-rl-off-white py-12 px-4">
                <div className="max-w-lg mx-auto">
                    <div className="bg-white rounded-2xl shadow-card p-8 text-center mb-6">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-extrabold text-rl-dark mb-2">Booking Confirmed!</h2>
                        <p className="text-rl-gray text-sm mb-4">
                            Your rental request has been submitted. Confirmation sent to <strong>{form.email}</strong>.
                        </p>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-left">
                            <p className="text-sm text-emerald-800 font-medium flex items-center gap-2">
                                <CheckIcon /> {hasShipping ? 'Shipping labels generated' : 'Check your email for pickup details'}
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-rl-blue text-white font-bold py-3 rounded-xl text-sm hover:bg-rl-blue-500 transition-colors"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Form Step
    return (
        <div className="min-h-screen bg-rl-off-white py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <Link to="/browse" className="inline-flex items-center gap-1 text-rl-gray text-sm mb-6 hover:text-rl-dark transition-colors">
                    ← Continue Shopping
                </Link>
                <h1 className="text-2xl font-extrabold text-rl-dark mb-6">Checkout</h1>

                <div className="grid lg:grid-cols-5 gap-6">
                    {/* Left: Form */}
                    <div className="lg:col-span-3 space-y-5">
                        {/* Contact Info */}
                        <div className="bg-white rounded-2xl shadow-card p-6">
                            <h2 className="font-extrabold text-rl-dark mb-4">Your Information</h2>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">First Name</label>
                                    <input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputCls('firstName')} placeholder="Jane" />
                                    {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Last Name</label>
                                    <input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputCls('lastName')} placeholder="Smith" />
                                    {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Email</label>
                                    <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputCls('email')} placeholder="jane@example.com" />
                                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Phone</label>
                                    <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputCls('phone')} placeholder="(555) 000-0000" />
                                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Shipping Address */}
                        {hasShipping && (
                            <div className="bg-white rounded-2xl shadow-card p-6">
                                <h2 className="font-extrabold text-rl-dark mb-1">Shipping Address</h2>
                                <p className="text-xs text-rl-gray mb-4">Prepaid return labels included via EasyPost.</p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Street Address</label>
                                        <input value={form.address} onChange={(e) => update('address', e.target.value)} className={inputCls('address')} placeholder="123 Main St, Apt 4B" />
                                        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-1">
                                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">City</label>
                                            <input value={form.city} onChange={(e) => update('city', e.target.value)} className={inputCls('city')} placeholder="Austin" />
                                            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">State</label>
                                            <input value={form.state} onChange={(e) => update('state', e.target.value)} className={inputCls('state')} placeholder="TX" />
                                            {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">ZIP</label>
                                            <input value={form.zip} onChange={(e) => update('zip', e.target.value)} className={inputCls('zip')} placeholder="78701" />
                                            {errors.zip && <p className="text-red-500 text-xs mt-1">{errors.zip}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Intended Use */}
                        <div className="bg-white rounded-2xl shadow-card p-6">
                            <h2 className="font-extrabold text-rl-dark mb-1">Intended Use <span className="text-red-500">*</span></h2>
                            <p className="text-xs text-rl-gray mb-3">Tell the owner what you plan to use this item for.</p>
                            <textarea
                                value={form.intendedUse}
                                onChange={(e) => update('intendedUse', e.target.value)}
                                rows={4}
                                className={`w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rl-blue-300 focus:border-rl-blue ${errors.intendedUse ? 'border-red-400' : 'border-rl-gray-3'}`}
                                placeholder="e.g. I'm building a deck this weekend and need the drill for mounting boards..."
                            />
                            <div className="flex justify-between mt-1">
                                {errors.intendedUse ? <p className="text-red-500 text-xs">{errors.intendedUse}</p> : <span />}
                                <p className={`text-xs ${form.intendedUse.length < 20 ? 'text-rl-gray-2' : 'text-emerald-600'}`}>
                                    {form.intendedUse.length} / 20+ chars
                                </p>
                            </div>
                        </div>

                        {/* Terms */}
                        <div className="bg-white rounded-2xl shadow-card p-6">
                            <h2 className="font-extrabold text-rl-dark mb-3">Rental Terms</h2>
                            <div className="bg-rl-gray-4 rounded-xl p-4 text-xs text-rl-dark-3 leading-relaxed space-y-2 max-h-48 overflow-y-auto mb-4 border border-rl-gray-3">
                                <p><strong>Late Returns:</strong> 1.5× daily rate per late day. After 5 days, full replacement value charged.</p>
                                <p><strong>Damage:</strong> Renter responsible for damage beyond normal wear. Insurance covers eligible claims.</p>
                                <p><strong>Cancellation:</strong> Free up to 48 hours before rental. 50% charge within 48 hours.</p>
                                <p><strong>Shipping:</strong> Two prepaid labels included. Return before rental end date.</p>
                            </div>
                            <label className={`flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border transition-all ${form.agreedToTerms ? 'border-emerald-400 bg-emerald-50' : errors.agreedToTerms ? 'border-red-400 bg-red-50' : 'border-rl-gray-3 hover:border-rl-blue'}`}>
                                <input type="checkbox" checked={form.agreedToTerms} onChange={(e) => update('agreedToTerms', e.target.checked)} className="mt-0.5 w-4 h-4 accent-rl-blue shrink-0" />
                                <span className="text-sm text-rl-dark">I agree to the <span className="font-semibold text-rl-blue">Rental Terms</span>, damage policy, and cancellation policy.</span>
                            </label>
                            {errors.agreedToTerms && <p className="text-red-500 text-xs mt-2">{errors.agreedToTerms}</p>}
                        </div>
                    </div>

                    {/* Right: Summary */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24">
                            <h2 className="font-extrabold text-rl-dark mb-4">Order Summary</h2>
                            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                                {cart.map((item) => (
                                    <div key={item.cartId} className="flex gap-3">
                                        <img src={item.image} alt={item.title} className="w-14 h-12 object-cover rounded-lg shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-rl-dark leading-tight line-clamp-2">{item.title}</p>
                                            <p className="text-xs text-rl-gray mt-0.5">{item.days}d · ×{item.qty}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-sm font-bold text-rl-dark">${item.total}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-rl-gray-3 pt-3 space-y-1.5 mb-4 text-sm">
                                <div className="flex justify-between text-rl-gray"><span>Subtotal</span><span>${cartTotal}</span></div>
                                <div className="flex justify-between text-rl-gray"><span>Insurance (8%)</span><span>${Math.round(cartTotal * 0.08)}</span></div>
                                <div className="flex justify-between text-rl-gray"><span>Service fee (12%)</span><span>${Math.round(cartTotal * 0.12)}</span></div>
                                <div className="flex justify-between font-extrabold text-rl-dark text-base pt-2 border-t border-rl-gray-3">
                                    <span>Total</span>
                                    <span>${Math.round(cartTotal * 1.20)}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-rl-blue hover:bg-rl-blue-500 text-white font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Processing...
                                    </>
                                ) : (
                                    'Place Order →'
                                )}
                            </button>
                            <p className="text-xs text-center text-rl-gray-2 mt-3">🔒 Secure checkout · Rentaleze Guarantee</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}