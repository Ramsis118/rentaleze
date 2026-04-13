import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

export default function ProfilePage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        avatar: ''
    })

    useEffect(() => {
        if (user) {
            setForm({
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                avatar: user.avatar || ''
            })
        }
    }, [user])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        
        try {
            await api.request('/users/profile', {
                method: 'PUT',
                body: JSON.stringify(form)
            })
            // A real app would update the AuthContext here
            setMessage('Profile updated successfully!')
        } catch (error) {
            setMessage('Failed to update profile.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-extrabold text-rl-dark mb-6">Profile Settings</h1>
            
            {message && (
                <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.includes('success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
                <div className="flex items-center gap-6">
                    {/* Avatar Preview */}
                    <div className="shrink-0">
                        {form.avatar ? (
                            <img src={form.avatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover shadow-sm" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-rl-blue-50 text-rl-blue font-bold flex items-center justify-center text-3xl">
                                {form.firstName?.[0] || 'U'}
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Avatar URL</label>
                        <input 
                            type="text" 
                            className="input-field" 
                            placeholder="https://example.com/avatar.jpg"
                            value={form.avatar}
                            onChange={e => setForm({...form, avatar: e.target.value})}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">First Name</label>
                        <input 
                            type="text" 
                            className="input-field" 
                            value={form.firstName}
                            onChange={e => setForm({...form, firstName: e.target.value})}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Last Name</label>
                        <input 
                            type="text" 
                            className="input-field" 
                            value={form.lastName}
                            onChange={e => setForm({...form, lastName: e.target.value})}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Email Address</label>
                    <input 
                        type="email" 
                        className="input-field bg-rl-gray-4 text-rl-gray cursor-not-allowed" 
                        value={user?.email || ''}
                        disabled
                    />
                    <p className="text-xs text-rl-gray mt-1.5">Email cannot be changed directly.</p>
                </div>

                <div className="pt-4 border-t border-rl-gray-3">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary w-full sm:w-auto px-8"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    )
}
