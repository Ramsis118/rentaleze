import React, { useState, useEffect } from 'react'
import api from '../../api'

export default function PaymentsPage() {
    const [methods, setMethods] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)

    useEffect(() => {
        fetchMethods()
    }, [])

    const fetchMethods = async () => {
        setLoading(true)
        try {
            const data = await api.request('/payments')
            setMethods(data)
        } catch (error) {
            console.error('Failed to fetch methods', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddMockCard = async () => {
        setAdding(true)
        try {
            await api.request('/payments', {
                method: 'POST',
                body: JSON.stringify({
                    last4: Math.floor(1000 + Math.random() * 9000).toString(),
                    brand: Math.random() > 0.5 ? 'Visa' : 'Mastercard',
                    expMonth: '12',
                    expYear: '2028'
                })
            })
            await fetchMethods()
        } catch (error) {
            alert('Failed to add card')
        } finally {
            setAdding(false)
        }
    }

    const setAsDefault = async (id) => {
        try {
            await api.request(`/payments/${id}/default`, { method: 'PUT' })
            await fetchMethods()
        } catch (error) {
            alert('Failed to update default method')
        }
    }

    const removeCard = async (id) => {
        if (!window.confirm('Remove this payment method?')) return
        try {
            await api.request(`/payments/${id}`, { method: 'DELETE' })
            setMethods(methods.filter(m => m.id !== id))
        } catch (error) {
            alert('Failed to remove card')
        }
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-extrabold text-rl-dark">Payment Methods</h1>
                <button 
                    onClick={handleAddMockCard} 
                    disabled={adding}
                    className="bg-rl-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-rl-blue-500 transition-colors disabled:opacity-70"
                >
                    {adding ? 'Adding...' : '+ Add New Card'}
                </button>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" />
                </div>
            ) : methods.length === 0 ? (
                <div className="text-center py-12 bg-rl-gray-4 rounded-xl border border-dashed border-rl-gray-3">
                    <div className="text-4xl mb-3">💳</div>
                    <h3 className="font-bold text-rl-dark mb-1">No payment methods</h3>
                    <p className="text-sm text-rl-gray mb-4">Add a card to start renting items.</p>
                    <button onClick={handleAddMockCard} className="btn-primary text-sm">Add Card</button>
                </div>
            ) : (
                <div className="space-y-4 max-w-2xl">
                    {methods.map(card => (
                        <div key={card.id} className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-colors ${card.is_default ? 'border-rl-blue bg-rl-blue-50/30' : 'border-rl-gray-3 bg-white'}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-8 bg-rl-gray-4 rounded border border-rl-gray-3 flex items-center justify-center text-xs font-bold text-rl-dark uppercase">
                                    {card.brand}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-bold text-rl-dark text-sm">•••• •••• •••• {card.last_4}</p>
                                        {card.is_default === 1 && (
                                            <span className="bg-rl-blue/10 text-rl-blue text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Default</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-rl-gray">Expires {card.exp_month}/{card.exp_year}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {card.is_default !== 1 && (
                                    <button onClick={() => setAsDefault(card.id)} className="text-xs font-semibold text-rl-gray hover:text-rl-blue">Make Default</button>
                                )}
                                <button onClick={() => removeCard(card.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-rl-gray hover:text-red-500 flex items-center justify-center transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
