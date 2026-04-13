import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

export default function VerificationPage() {
    const { user } = useAuth()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Step 1: Address
    const [address, setAddress] = useState(user?.address || '')
    
    // Step 2: IDs
    const [idFront, setIdFront] = useState(null)
    const [idBack, setIdBack] = useState(null)
    
    // Step 3: Phone & OTP
    const [phone, setPhone] = useState(user?.phone || '')
    const [otpSent, setOtpSent] = useState(false)
    const [otpCode, setOtpCode] = useState('')

    // Completion Status
    const isVerified = user?.isVerified === 1 && user?.phoneVerified === 1

    const handleAddressSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await api.request('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({ 
                    firstName: user.firstName, 
                    lastName: user.lastName, 
                    address,
                    phone: user.phone || phone,
                    bio: user.bio || ''
                })
            })
            setStep(2)
        } catch (err) {
            setError('Failed to save address')
        } finally {
            setLoading(false)
        }
    }

    const handleIdSubmit = async (e) => {
        e.preventDefault()
        if (!idFront || !idBack) {
            setError('Please upload both front and back of your ID')
            return
        }
        setError('')
        setLoading(true)
        try {
            const formData = new FormData()
            formData.append('id_front', idFront)
            formData.append('id_back', idBack)
            
            await api.request('/users/profile/verification', {
                method: 'POST',
                body: formData // Fetch will auto-set multipart headers
            }, true) // Passing true to tell our API client not to stringify it
            
            setStep(3)
        } catch (err) {
            setError('Failed to upload ID documents')
        } finally {
            setLoading(false)
        }
    }

    const handleSendOTP = async () => {
        if (!phone) {
            setError('Please enter a phone number')
            return
        }
        setError('')
        setLoading(true)
        try {
            await api.request('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({ 
                    firstName: user.firstName, 
                    lastName: user.lastName, 
                    phone,
                    address: user.address || address,
                    bio: user.bio || ''
                })
            })
            setOtpSent(true)
        } catch (err) {
            setError('Failed to save phone number')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await api.request('/users/profile/verify-phone', {
                method: 'POST',
                body: JSON.stringify({ code: otpCode })
            })
            
            // Force a hard reload so AuthContext picks up the new roles from JWT immediately
            window.location.reload()
            
        } catch (err) {
            setError('Verification failed. Use 123456 as the demo code.')
        } finally {
            setLoading(false)
        }
    }

    if (isVerified) {
        return (
            <div className="text-center py-16 max-w-lg mx-auto">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                    ✓
                </div>
                <h1 className="text-2xl font-extrabold text-rl-dark mb-2">You're Verified!</h1>
                <p className="text-rl-gray">Your identity and phone number have been successfully verified. You now have full access to rent and list items on Rentaleze.</p>
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-extrabold text-rl-dark mb-6">Identity Verification</h1>
            
            {/* Progress indicators */}
            <div className="flex items-center gap-2 mb-8">
                <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-rl-blue' : 'bg-rl-gray-4'}`} />
                <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-rl-blue' : 'bg-rl-gray-4'}`} />
                <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-rl-blue' : 'bg-rl-gray-4'}`} />
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl mb-6 text-sm">{error}</div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
                <form onSubmit={handleAddressSubmit} className="space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-rl-dark mb-1">Step 1: Residential Address</h2>
                        <p className="text-sm text-rl-gray mb-6">Please enter your primary residential address exactly as it appears on your ID.</p>
                        
                        <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Full Address</label>
                        <input 
                            type="text" 
                            className="input-field" 
                            placeholder="123 Main St, Apt 4B, City, State 12345"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto px-8">
                        {loading ? 'Saving...' : 'Continue to Step 2'}
                    </button>
                </form>
            )}

            {/* STEP 2 */}
            {step === 2 && (
                <form onSubmit={handleIdSubmit} className="space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-rl-dark mb-1">Step 2: Upload ID Documents</h2>
                        <p className="text-sm text-rl-gray mb-6">Upload a clear photo of the front and back of your Driver's License or State ID.</p>
                        
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="border border-dashed border-rl-gray-3 rounded-xl p-4 bg-rl-gray-4 hover:border-rl-blue transition-colors">
                                <label className="cursor-pointer flex flex-col items-center text-center">
                                    <span className="mb-2 text-2xl">📸</span>
                                    <span className="text-sm font-bold text-rl-dark mb-1">Upload Front</span>
                                    <span className="text-xs text-rl-gray truncate max-w-full">{idFront ? idFront.name : 'Select file'}</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => setIdFront(e.target.files[0])} />
                                </label>
                            </div>
                            
                            <div className="border border-dashed border-rl-gray-3 rounded-xl p-4 bg-rl-gray-4 hover:border-rl-blue transition-colors">
                                <label className="cursor-pointer flex flex-col items-center text-center">
                                    <span className="mb-2 text-2xl">📸</span>
                                    <span className="text-sm font-bold text-rl-dark mb-1">Upload Back</span>
                                    <span className="text-xs text-rl-gray truncate max-w-full">{idBack ? idBack.name : 'Select file'}</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => setIdBack(e.target.files[0])} />
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setStep(1)} className="btn-outline px-8 disabled:opacity-50" disabled={loading}>Back</button>
                        <button type="submit" disabled={loading} className="btn-primary flex-1 px-8">
                            {loading ? 'Uploading...' : 'Continue to Step 3'}
                        </button>
                    </div>
                </form>
            )}

            {/* STEP 3 */}
            {step === 3 && (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-rl-dark mb-1">Step 3: Phone Verification</h2>
                        <p className="text-sm text-rl-gray mb-6">We'll send you a 6-digit verification code to confirm your phone number.</p>
                        
                        {!otpSent ? (
                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Phone Number</label>
                                    <input 
                                        type="tel" 
                                        className="input-field" 
                                        placeholder="(555) 123-4567"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        required
                                    />
                                </div>
                                <button type="button" onClick={handleSendOTP} disabled={loading} className="btn-primary shrink-0 py-3 px-6 h-[46px] mb-[-1px]">
                                    {loading ? '...' : 'Send Code'}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleVerifyOTP}>
                                <label className="text-xs font-bold text-rl-dark uppercase tracking-wide block mb-1.5">Enter 6-Digit Code (Demo: 123456)</label>
                                <input 
                                    type="text" 
                                    className="input-field mb-4 tracking-widest font-mono text-center text-lg" 
                                    maxLength={6}
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    placeholder="000000"
                                    required
                                />
                                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                                    {loading ? 'Verifying...' : 'Verify & Finish'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
