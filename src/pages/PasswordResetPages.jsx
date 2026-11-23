import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

function Shell({ title, sub, children }) {
    return (
        <div className="min-h-screen bg-rl-off-white flex items-center justify-center py-12 px-4">
            <div className="w-full max-w-md">
                <Link to="/" className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-9 h-9 bg-rl-blue rounded-xl flex items-center justify-center shadow-sm"><span className="text-white font-bold">R</span></div>
                    <span className="font-bold text-rl-dark text-xl tracking-tight">Rental<span className="text-rl-blue">eze</span></span>
                </Link>
                <div className="bg-white rounded-2xl shadow-card p-8">
                    <h1 className="text-2xl font-extrabold text-rl-dark mb-1">{title}</h1>
                    <p className="text-sm text-rl-gray mb-6">{sub}</p>
                    {children}
                </div>
                <p className="text-center text-sm text-rl-gray mt-6"><Link to="/login" className="text-rl-blue-600 font-semibold hover:underline">Back to sign in</Link></p>
            </div>
        </div>
    )
}

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [sent, setSent] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const submit = async (e) => {
        e.preventDefault()
        setError('')
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter the email you signed up with.')
        setBusy(true)
        try { await api.forgotPassword(email); setSent(true) } catch (err) { setError(err.message) } finally { setBusy(false) }
    }
    if (sent) {
        return (
            <Shell title="Check your email" sub={`If ${email} has a Rentaleze account, we sent a link to reset the password. It works for 1 hour.`}>
                <p className="text-sm text-rl-gray">Didn’t get it? Check spam, or <button onClick={() => setSent(false)} className="text-rl-blue-600 font-semibold hover:underline">try again</button>.</p>
            </Shell>
        )
    }
    return (
        <Shell title="Forgot your password?" sub="Enter your email and we’ll send you a link to choose a new one.">
            <form onSubmit={submit} className="space-y-4">
                <label className="block">
                    <span className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Email</span>
                    <input className="input-field" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={busy} className="btn-primary w-full justify-center py-3 disabled:opacity-60">{busy ? 'Sending…' : 'Send reset link'}</button>
            </form>
        </Shell>
    )
}

export function ResetPasswordPage() {
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const token = params.get('token') || ''
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        setError('')
        if (password.length < 8) return setError('Use at least 8 characters.')
        if (password !== confirm) return setError('The passwords don’t match.')
        setBusy(true)
        try { await api.resetPassword(token, password); setDone(true) } catch (err) { setError(err.message) } finally { setBusy(false) }
    }

    if (!token) return <Shell title="Link missing" sub="Open the reset link from your email, or request a new one."><Link to="/forgot-password" className="btn-primary w-full justify-center">Request a new link</Link></Shell>
    if (done) return <Shell title="Password updated" sub="You’ve been signed out on other devices. Sign in with your new password."><button onClick={() => navigate('/login')} className="btn-primary w-full justify-center py-3">Sign in</button></Shell>

    return (
        <Shell title="Choose a new password" sub="At least 8 characters.">
            <form onSubmit={submit} className="space-y-4">
                <label className="block">
                    <span className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">New password</span>
                    <input className="input-field" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
                </label>
                <label className="block">
                    <span className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Confirm password</span>
                    <input className="input-field" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                </label>
                {error && <p className="text-sm text-red-600">{error} {/expired|used/.test(error) && <Link to="/forgot-password" className="font-semibold underline">Get a new link</Link>}</p>}
                <button disabled={busy} className="btn-primary w-full justify-center py-3 disabled:opacity-60">{busy ? 'Saving…' : 'Update password'}</button>
            </form>
        </Shell>
    )
}
