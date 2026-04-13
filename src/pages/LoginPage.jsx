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

export default function LoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [formErrors, setFormErrors] = useState({})

    const validate = () => {
        const e = {}
        if (!email.trim()) e.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email format'
        if (!password) e.password = 'Password is required'
        setFormErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!validate()) return

        setLoading(true)
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))
        setLoading(false)

        // For demo: accept any credentials
        navigate('/')
    }

    return (
        <div className="min-h-screen bg-rl-off-white flex items-center justify-center py-12 px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <Link to="/" className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-10 h-10 bg-rl-blue rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold text-xl">R</span>
                    </div>
                    <span className="font-bold text-rl-dark text-2xl">Rental<span className="text-rl-blue">eze</span></span>
                </Link>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-card p-8">
                    <h1 className="text-2xl font-extrabold text-rl-dark text-center mb-2">Welcome back</h1>
                    <p className="text-rl-gray text-sm text-center mb-6">Sign in to your account</p>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`input-field ${formErrors.email ? 'border-red-400' : ''}`}
                                placeholder="you@example.com"
                            />
                            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`input-field pr-10 ${formErrors.password ? 'border-red-400' : ''}`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-gray hover:text-rl-dark"
                                >
                                    <EyeIcon visible={showPassword} />
                                </button>
                            </div>
                            {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-rl-blue rounded" />
                                <span className="text-sm text-rl-dark-3">Remember me</span>
                            </label>
                            <button type="button" className="text-xs text-rl-blue-600 hover:underline font-medium">
                                Forgot password?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary justify-center py-3 disabled:opacity-70"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-rl-gray">
                            Don't have an account?{' '}
                            <Link to="/signup" className="text-rl-blue-600 font-semibold hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Demo note */}
                <p className="text-xs text-center text-rl-gray mt-4">
                    Demo: Enter any email/password to sign in
                </p>
            </div>
        </div>
    )
}