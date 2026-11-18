import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

function StepCard({ number, title, done, children }) {
    return (
        <div className={`border rounded-2xl p-5 sm:p-6 ${done ? 'border-emerald-200 bg-emerald-50/40' : 'border-rl-gray-3 bg-white'}`}>
            <div className="flex items-start gap-4">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-rl-blue-50 text-rl-blue-600'}`}>
                    {done ? '✓' : number}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-rl-dark mb-1">{title}</h2>
                    {children}
                </div>
            </div>
        </div>
    )
}

export default function VerificationPage() {
    const { refreshUser } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const [status, setStatus] = useState(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState('')
    const [phone, setPhone] = useState('')
    const [codeSent, setCodeSent] = useState(false)
    const [code, setCode] = useState('')

    const load = useCallback(async () => {
        try {
            const s = await api.getVerificationStatus()
            setStatus(s)
            if (s.phone && !phone) setPhone(s.phone)
            return s
        } catch (err) {
            setError(err.message)
        }
    }, [phone])

    useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Back from Stripe: the result is usually ready right away, but can take a minute
    useEffect(() => {
        if (searchParams.get('returned') !== '1') return
        let tries = 0
        const timer = setInterval(async () => {
            tries++
            const s = await load()
            if (!s || s.idStatus !== 'pending' || tries >= 10) {
                clearInterval(timer)
                setSearchParams({}, { replace: true })
                refreshUser()
            }
        }, 3000)
        return () => clearInterval(timer)
    }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

    const run = async (key, fn) => {
        setBusy(key)
        setError('')
        try { await fn() } catch (err) { setError(err.message) } finally { setBusy('') }
    }

    const startId = () => run('id', async () => {
        const r = await api.startIdentityCheck()
        if (r.url) { window.location.href = r.url; return }
        if (r.dev) {
            setStatus(await api.devCompleteIdentity())
            refreshUser()
        }
    })

    const sendCode = (e) => {
        e?.preventDefault()
        run('send', async () => {
            const r = await api.sendPhoneCode(phone)
            setPhone(r.phone)
            setCodeSent(true)
        })
    }

    const checkCode = (e) => {
        e.preventDefault()
        run('check', async () => {
            setStatus(await api.checkPhoneCode(code))
            setCodeSent(false)
            setCode('')
            refreshUser()
        })
    }

    if (!status) {
        return (
            <div className="py-16 flex justify-center">
                {error ? <p className="text-red-600 text-sm">{error}</p>
                    : <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />}
            </div>
        )
    }

    if (status.fullyVerified) {
        return (
            <div className="text-center py-16 max-w-lg mx-auto">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">✓</div>
                <h1 className="text-2xl font-extrabold text-rl-dark mb-2">You're verified</h1>
                <p className="text-rl-gray">Your ID and phone number are confirmed. A “Verified” badge now shows on your profile and listings.</p>
            </div>
        )
    }

    const idDone = status.idStatus === 'verified'

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-extrabold text-rl-dark mb-2">Get verified</h1>
            <p className="text-sm text-rl-gray mb-6">
                Everyone who rents or lists on Rentaleze confirms who they are. It takes about 3 minutes and keeps the community safe.
            </p>

            {error && <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl mb-6 text-sm">{error}</div>}

            <div className="space-y-4">
                <StepCard number={1} title="Verify your ID" done={idDone}>
                    {idDone ? (
                        <p className="text-sm text-emerald-700">Your ID is verified.</p>
                    ) : status.idStatus === 'pending' ? (
                        <>
                            <p className="text-sm text-rl-gray mb-3">We're checking your ID. This usually takes under a minute.</p>
                            <button onClick={load} className="btn-outline text-sm py-2">Refresh status</button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-rl-gray mb-3">
                                You'll take a photo of your driver's license, state ID or passport, then a quick selfie.
                                Our verification partner, Stripe, checks it securely. Rentaleze never stores pictures of your ID.
                            </p>
                            {status.idStatus === 'failed' && status.idError && (
                                <p className="text-sm text-red-600 mb-3">{status.idError}</p>
                            )}
                            {status.identityAvailable ? (
                                <button onClick={startId} disabled={busy === 'id'} className="btn-primary text-sm disabled:opacity-60">
                                    {busy === 'id' ? 'Opening…' : status.idStatus === 'failed' ? 'Try again' : 'Verify my ID'}
                                </button>
                            ) : (
                                <p className="text-sm text-amber-700">ID verification is being switched on. Please check back soon.</p>
                            )}
                            {status.devMode?.identity && (
                                <p className="text-xs text-rl-gray-2 mt-2">Development mode: no Stripe key is set, so this will mark you verified.</p>
                            )}
                        </>
                    )}
                </StepCard>

                <StepCard number={2} title="Confirm your mobile number" done={status.phoneVerified}>
                    {status.phoneVerified ? (
                        <p className="text-sm text-emerald-700">{status.phone} is confirmed.</p>
                    ) : !codeSent ? (
                        <form onSubmit={sendCode}>
                            <p className="text-sm text-rl-gray mb-3">We'll text you a 6-digit code. We use your number for rental updates only.</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input type="tel" className="input-field" placeholder="(404) 555-1234" value={phone}
                                    onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
                                <button type="submit" disabled={busy === 'send' || !status.phoneAvailable} className="btn-primary shrink-0 justify-center disabled:opacity-60">
                                    {busy === 'send' ? 'Sending…' : 'Text me a code'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={checkCode}>
                            <p className="text-sm text-rl-gray mb-3">
                                Enter the code we sent to {phone}.{' '}
                                <button type="button" onClick={() => setCodeSent(false)} className="text-rl-blue-600 font-semibold">Change number</button>
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                                    className="input-field tracking-widest font-mono text-center text-lg" placeholder="000000"
                                    value={code} onChange={(e) => setCode(e.target.value)} required />
                                <button type="submit" disabled={busy === 'check'} className="btn-primary shrink-0 justify-center disabled:opacity-60">
                                    {busy === 'check' ? 'Checking…' : 'Confirm'}
                                </button>
                            </div>
                            <button type="button" onClick={sendCode} disabled={!!busy} className="text-xs text-rl-gray hover:text-rl-dark mt-3">
                                Didn't get it? Send again
                            </button>
                            {status.devMode?.sms && <p className="text-xs text-rl-gray-2 mt-2">Development mode: the code is {status.devMode.code}.</p>}
                        </form>
                    )}
                </StepCard>
            </div>
        </div>
    )
}
