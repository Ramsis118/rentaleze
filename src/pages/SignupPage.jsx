jsx
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const EyeIcon = ({ visible }) => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {visible ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        )}
    </svg>
)

const ROLES = [
    { value: 'renter', label: 'I want to rent items', icon: '🎁' },
    { value: 'owner', label: 'I want to list my items', icon: '💰' },
    { value: 'both', label: 'Both', icon: '🤝' },
]

export default function SignupPage() {
    const navigate = useNavigate()
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'renter',
        agreedToTerms: false,
    })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState({})

    const update = (key, value) => {
        setForm((f) => ({ ...f, [key]: value }))
        if (errors[key]) setErrors((e) => ({ ...e, [key]: null }))
    }

    const validate = () => {
        const e = {}
        if (!form.firstName.trim()) e.firstName = 'Required'
        if (!form.lastName.trim()) e.lastName = 'Required'
        if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required'
        if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters'
        if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
        if (!form.agreedToTerms) e.agreedToTerms = 'You must agree to the terms'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return

        setLoading(true)
        await new Promise((resolve) => setTimeout(resolve, 1500))
        setLoading(false)
        navigate('/')
    }

    const inputCls = (key) =>
        `w-full px-4 py-3 rounded-xl border bg-white text-rl-dark text-sm focus:outline-none focus:ring-2 focus:ring-rl-blue-300 focus:border-rl-blue transition-all ${errors[key] ? 'border-red-400' : 'border-rl-gray-3'
        }`

    return (
        <div className="min-h-screen bg-rl-off-white py-12 px-4">
            <div className="max-w-md mx-auto">
                {/* Logo */}
                <Link to="/" className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-10 h-10 bg-rl-blue rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold text-xl">R</span>
                    </div>
                    <span className="font-bold text-rl-dark text-2xl">Rental<span className="text-rl-blue">eze</span></span>
                </Link>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-card p-8">
                    <h1 className="text-2xl font-extrabold text-rl-dark text-center mb-2">Create your account</h1>
                    <p className="text-rl-gray text-sm text-center mb-6">Start renting or earning today</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div className="grid grid-cols-2 gap-3">
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

                        {/* Email */}
                        <div>
                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Email</label>
                            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputCls('email')} placeholder="you@example.com" />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={(e) => update('password', e.target.value)}
                                    className={`input-field pr-10 ${inputCls('password').replace('w-full ', '')}`}
                                    placeholder="Min 8 characters"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-gray hover:text-rl-dark">
                                    <EyeIcon visible={showPassword} />
                                </button>
                            </div>
                            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Confirm Password</label>
                            <input
                                type="password"
                                value={form.confirmPassword}
                                onChange={(e) => update('confirmPassword', e.target.value)}
                                className={inputCls('confirmPassword')}
                                placeholder="••••••••"
                            />
                            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                        </div>

                        {/* Role */}
                        <div>
                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-3">I want to...</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {ROLES.map((role) => (
                                    <button
                                        key={role.value}
                                        type="button"
                                        onClick={() => update('role', role.value)}
                                        className={`p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1.5 ${form.role === role.value
                                                ? 'border-rl-blue bg-rl-blue-50 text-rl-blue'
                                                : 'border-rl-gray-3 text-rl-dark-3 hover:border-rl-blue'
                                            }`}
                                    >
                                        <span className="text-xl">{role.icon}</span>
                                        <span className="text-center leading-tight">{role.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Terms */}
                        <label className={`flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border transition-all ${form.agreedToTerms ? 'border-emerald-400 bg-emerald-50' : errors.agreedToTerms ? 'border-red-400' : 'border-rl-gray-3'}`}>
                            <input type="checkbox" checked={form.agreedToTerms} onChange={(e) => update('agreedToTerms', e.target.checked)} className="mt-0.5 w-4 h-4 accent-rl-blue shrink-0" />
                            <span className="text-sm text-rl-dark">
                                I agree to the{' '}
                                <Link to="/terms" className="text-rl-blue font-semibold hover:underline">Terms of Service</Link>
                                {' '}and{' '}
                                <Link to="/privacy" className="text-rl-blue font-semibold hover:underline">Privacy Policy</Link>
                            </span>
                        </label>
                        {errors.agreedToTerms && <p className="text-red-500 text-xs -mt-2">{errors.agreedToTerms}</p>}

                        <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-3 disabled:opacity-70">
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-rl-gray">
                            Already have an account?{' '}
                            <Link to="/login" className="text-rl-blue-600 font-semibold hover:underline">Sign in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}