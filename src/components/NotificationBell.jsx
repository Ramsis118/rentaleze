import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

// "5 min ago" style times; server times are UTC "YYYY-MM-DD HH:MM:SS"
export function timeAgo(s) {
    if (!s) return ''
    const t = Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`)
    const mins = Math.round((Date.now() - t) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
    const days = Math.round(hrs / 24)
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const BellIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3C7.7 6.2 6 8.4 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
)

export default function NotificationBell() {
    const [open, setOpen] = useState(false)
    const [unread, setUnread] = useState(0)
    const [items, setItems] = useState(null)
    const ref = useRef(null)
    const navigate = useNavigate()

    const refreshCount = useCallback(() => {
        api.getUnreadCount().then(r => setUnread(r.unread)).catch(() => {})
    }, [])

    // Check for new notifications every minute while the tab is visible
    useEffect(() => {
        refreshCount()
        const t = setInterval(() => { if (document.visibilityState === 'visible') refreshCount() }, 60000)
        return () => clearInterval(t)
    }, [refreshCount])

    useEffect(() => {
        if (!open) return
        api.getNotifications(15).then(r => { setItems(r.notifications); setUnread(r.unread) }).catch(() => setItems([]))
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [open])

    const openItem = async (n) => {
        setOpen(false)
        if (!n.read) {
            setUnread(u => Math.max(0, u - 1))
            api.markNotificationRead(n.id).catch(() => {})
        }
        if (n.link) navigate(n.link)
    }

    const readAll = async () => {
        await api.markAllNotificationsRead().catch(() => {})
        setUnread(0)
        setItems(list => (list || []).map(n => ({ ...n, read: true })))
    }

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen(o => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                className="relative p-2 rounded-lg text-rl-dark-3 hover:text-rl-blue-600 hover:bg-rl-blue-50 transition-colors">
                <BellIcon />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-rl-blue text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-card border border-rl-gray-3 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-rl-gray-3">
                        <span className="font-bold text-rl-dark text-sm">Notifications</span>
                        {unread > 0 && <button onClick={readAll} className="text-xs font-semibold text-rl-blue-600 hover:underline">Mark all read</button>}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {items === null ? (
                            <p className="px-4 py-6 text-sm text-rl-gray text-center">Loading…</p>
                        ) : items.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-rl-gray text-center">You’re all caught up.</p>
                        ) : items.map(n => (
                            <button key={n.id} onClick={() => openItem(n)}
                                className={`w-full text-left px-4 py-3 border-b border-rl-gray-4 hover:bg-rl-gray-4 flex gap-3 ${n.read ? '' : 'bg-rl-blue-50'}`}>
                                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-rl-blue'}`} />
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-rl-dark">{n.title}</span>
                                    {n.body && <span className="block text-xs text-rl-gray mt-0.5 line-clamp-2">{n.body}</span>}
                                    <span className="block text-[11px] text-rl-gray-2 mt-1">{timeAgo(n.createdAt)}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <Link to="/dashboard/notifications" onClick={() => setOpen(false)} className="block text-center text-xs font-semibold text-rl-blue-600 py-2.5 hover:bg-rl-gray-4">
                        See all & notification settings
                    </Link>
                </div>
            )}
        </div>
    )
}
