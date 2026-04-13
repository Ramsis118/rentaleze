import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'
import ListingCard from '../../components/ListingCard'

export default function SavedListingsPage() {
    const [saved, setSaved] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchSaved = async () => {
            try {
                const data = await api.request('/users/saved')
                setSaved(data)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchSaved()
    }, [])

    if (loading) {
        return (
            <div className="py-12 flex justify-center">
                <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />
            </div>
        )
    }

    return (
        <div>
            <h1 className="text-2xl font-extrabold text-rl-dark mb-6">Saved Items</h1>
            
            {saved.length === 0 ? (
                <div className="text-center py-12 bg-rl-gray-4 rounded-xl border border-dashed border-rl-gray-3">
                    <div className="text-4xl mb-3">❤️</div>
                    <h3 className="font-bold text-rl-dark mb-1">No saved items yet</h3>
                    <p className="text-sm text-rl-gray mb-4">Items you save will appear here.</p>
                    <Link to="/browse" className="btn-primary text-sm">Browse Items</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 max-w-2xl gap-6">
                    {saved.map(item => (
                        <div key={item.id} className="relative">
                            <ListingCard {...item} />
                            {/* Unsave overlay button */}
                            <button 
                                onClick={async (e) => {
                                    e.preventDefault()
                                    try {
                                        await api.request(`/users/saved/${item.id}`, { method: 'DELETE' })
                                        setSaved(saved.filter(s => s.id !== item.id))
                                    } catch (err) {}
                                }}
                                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white text-red-500 shadow-sm flex items-center justify-center hover:scale-110 transition-transform"
                                aria-label="Remove saved item"
                            >
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
