import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

const stars = (n) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n))

export default function PublicProfilePage() {
    const { id } = useParams()
    const [p, setP] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => { api.getPublicProfile(id).then(setP).catch(e => setError(e.message)) }, [id])

    if (error) return <div className="min-h-[60vh] flex items-center justify-center text-sm text-rl-gray">{error}</div>
    if (!p) return <div className="min-h-[60vh] flex items-center justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" /></div>

    return (
        <div className="bg-rl-off-white min-h-screen py-10 px-4">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white rounded-2xl shadow-card p-6 flex items-center gap-5">
                    {p.avatar
                        ? <img src={p.avatar} alt={p.name} className="w-20 h-20 rounded-2xl object-cover" />
                        : <div className="w-20 h-20 rounded-2xl bg-rl-blue-50 text-rl-blue text-3xl font-bold flex items-center justify-center">{p.name[0]}</div>}
                    <div>
                        <h1 className="text-2xl font-extrabold text-rl-dark">{p.name}</h1>
                        {p.memberSince && <p className="text-sm text-rl-gray">Member since {p.memberSince}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {p.idVerified && <span className="text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-1">✓ ID verified</span>}
                            {p.phoneVerified && <span className="text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-1">✓ Phone verified</span>}
                        </div>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    {[['As an owner', p.asOwner], ['As a renter', p.asRenter]].map(([label, s]) => (
                        <div key={label} className="bg-white rounded-2xl shadow-card p-5">
                            <p className="text-xs font-bold text-rl-gray uppercase tracking-wide">{label}</p>
                            {s.count ? (
                                <p className="mt-1"><span className="text-2xl font-extrabold text-rl-dark">{s.rating}</span>
                                    <span className="text-amber-400 ml-2">{stars(s.rating)}</span>
                                    <span className="text-sm text-rl-gray ml-2">{s.count} review{s.count === 1 ? '' : 's'}</span></p>
                            ) : <p className="text-sm text-rl-gray mt-1">No reviews yet</p>}
                        </div>
                    ))}
                </div>

                {p.bio && <div className="bg-white rounded-2xl shadow-card p-6"><p className="text-sm text-rl-dark whitespace-pre-line">{p.bio}</p></div>}

                <div className="bg-white rounded-2xl shadow-card p-6">
                    <h2 className="text-lg font-bold text-rl-dark mb-4">Reviews</h2>
                    {p.reviews.length === 0 ? <p className="text-sm text-rl-gray">No reviews yet.</p> : (
                        <div className="space-y-4">
                            {p.reviews.map((r, i) => (
                                <div key={i} className="border-b border-rl-gray-3 last:border-0 pb-4 last:pb-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-rl-dark">{r.reviewerName} <span className="font-normal text-rl-gray">reviewed them as {r.about === 'owner' ? 'an owner' : 'a renter'}</span></p>
                                        <span className="text-amber-400 text-sm">{stars(r.rating)}</span>
                                    </div>
                                    {r.listingTitle && <p className="text-xs text-rl-gray">{r.listingTitle}</p>}
                                    <p className="text-sm text-rl-dark mt-1">{r.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <Link to="/browse" className="text-sm text-rl-blue-600 font-semibold">← Browse items</Link>
            </div>
        </div>
    )
}
