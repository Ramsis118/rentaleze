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
        avatar: '',
        bio: '',
        phone: '',
        address: ''
    })

    useEffect(() => {
        if (user) {
            setForm({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                avatar: user.avatar || '',
                bio: user.bio || '',
                phone: user.phone || '',
                address: user.address || ''
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
            setMessage('Profile updated successfully! Refresh to see changes.')
        } catch (error) {
            setMessage('Failed to update profile.')
        } finally {
            setLoading(false)
        }
    }

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            const formData = new FormData()
            formData.append('avatar', file)
            
            const res = await api.request('/users/profile/avatar', {
                method: 'POST',
                body: formData
            }, true)

            setForm({...form, avatar: res.avatar})
            setMessage('Avatar uploaded! Save profile to finalize.')
        } catch (err) {
            setMessage('Failed to upload avatar.')
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
                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Avatar Image</label>
                        <div className="flex items-center gap-3">
                            <label className="btn-outline px-4 py-2 cursor-pointer text-xs">
                                Upload New Image
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                            </label>
                            {form.avatar && <button type="button" onClick={() => setForm({...form, avatar: ''})} className="text-xs text-red-500 hover:underline">Remove</button>}
                        </div>
                        <p className="text-xs text-rl-gray mt-2">JPG, GIF or PNG. Max size of 5MB.</p>
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

                <div>
                    <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Bio</label>
                    <textarea 
                        className="input-field min-h-[100px] resize-y" 
                        placeholder="Tell others a bit about yourself..."
                        value={form.bio}
                        onChange={e => setForm({...form, bio: e.target.value})}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Phone Number</label>
                        <input 
                            type="tel" 
                            className="input-field" 
                            value={form.phone}
                            placeholder="(555) 000-0000"
                            onChange={e => setForm({...form, phone: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Address</label>
                        <input 
                            type="text" 
                            className="input-field" 
                            value={form.address}
                            placeholder="123 Example St"
                            onChange={e => setForm({...form, address: e.target.value})}
                        />
                    </div>
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
