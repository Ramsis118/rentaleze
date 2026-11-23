import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api'
import { timeAgo } from '../../components/NotificationBell'

function Toggle({ checked, onChange, disabled, label, hint }) {
    return (
        <label className={`flex items-start justify-between gap-4 py-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
            <span>
                <span className="block text-sm font-bold text-rl-dark">{label}</span>
                <span className="block text-xs text-rl-gray mt-0.5">{hint}</span>
            </span>
            <input type="checkbox" className="sr-only peer" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
            <span className="relative shrink-0 w-11 h-6 rounded-full bg-rl-gray-3 peer-checked:bg-rl-blue transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow after:transition-transform peer-checked:after:translate-x-5" />
        </label>
    )
}

export default function NotificationsPage() {
    const [data, setData] = useState(null)
    const [prefs, setPrefs] = useState(null)
    const [error, setError] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        Promise.all([api.getNotifications(100), api.getNotificationPrefs()])
            .then(([n, p]) => { setData(n); setPrefs(p) })
            .catch(err => setError(err.message))
    }, [])

    const save = async (change) => {
        setError('')
        const prev = prefs
        setPrefs({ ...prefs, ...change })
        try { setPrefs(await api.setNotificationPrefs(change)) } catch (err) { setPrefs(prev); setError(err.message) }
    }

    const open = (n) => {
        if (!n.read) api.markNotificationRead(n.id).catch(() => {})
        if (n.link) navigate(n.link)
    }

    const readAll = async () => {
        await api.markAllNotificationsRead()
        setData(d => ({ ...d, unread: 0, notifications: d.notifications.map(n => ({ ...n, read: true })) }))
    }

    if (!data || !prefs) {
        return error
            ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            : <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" /></div>
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-extrabold text-rl-dark mb-1">Notifications</h1>
                <p className="text-sm text-rl-gray">Updates about your rentals, shipping, account and support tickets.</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

            <section className="border border-rl-gray-3 rounded-xl p-4 sm:p-5 bg-white">
                <h2 className="font-bold text-rl-dark mb-1">How we reach you</h2>
                <div className="divide-y divide-rl-gray-3">
                    <Toggle label="Email" checked={prefs.email} onChange={v => save({ email: v })}
                        hint="Booking requests, confirmations, shipping labels and reminders. Security, account and support emails are always sent." />
                    <Toggle label="Text messages" checked={prefs.sms && prefs.smsAvailable} disabled={!prefs.smsAvailable} onChange={v => save({ sms: v })}
                        hint={prefs.smsAvailable
                            ? 'Only time-sensitive updates: new requests, confirmations, deliveries, return reminders. Reply STOP to any text to opt out.'
                            : 'Verify your phone number first to get texts.'} />
                </div>
                {!prefs.smsAvailable && <Link to="/dashboard/verification" className="inline-block mt-2 text-xs font-semibold text-rl-blue-600 hover:underline">Verify my phone →</Link>}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-rl-dark">Recent</h2>
                    {data.unread > 0 && <button onClick={readAll} className="text-sm font-semibold text-rl-blue-600 hover:underline">Mark all read</button>}
                </div>
                {data.notifications.length === 0 ? (
                    <div className="text-center py-10 bg-rl-gray-4 rounded-xl border border-dashed border-rl-gray-3 text-sm text-rl-gray">Nothing yet.</div>
                ) : (
                    <div className="border border-rl-gray-3 rounded-xl overflow-hidden bg-white divide-y divide-rl-gray-3">
                        {data.notifications.map(n => (
                            <button key={n.id} onClick={() => open(n)} className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-rl-gray-4 ${n.read ? '' : 'bg-rl-blue-50'}`}>
                                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-rl-blue'}`} />
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-semibold text-rl-dark">{n.title}</span>
                                    {n.body && <span className="block text-sm text-rl-gray">{n.body}</span>}
                                </span>
                                <span className="text-xs text-rl-gray-2 shrink-0">{timeAgo(n.createdAt)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
