import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initAuth = async () => {
            if (localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')) {
                try {
                    setUser(await api.getCurrentUser())
                } catch {
                    api.clearSession()
                }
            }
            setLoading(false)
        }
        initAuth()

        // The API client fires this when a session can no longer be refreshed
        const onExpired = () => setUser(null)
        window.addEventListener('auth:expired', onExpired)
        return () => window.removeEventListener('auth:expired', onExpired)
    }, [])

    const login = async (email, password) => {
        const data = await api.login(email, password)
        setUser(data.user)
        return data.user
    }

    const signup = async (userData) => {
        const data = await api.signup(userData)
        setUser(data.user)
        return data.user
    }

    const logout = async () => {
        try {
            await api.logout()
        } finally {
            setUser(null)
        }
    }

    // Re-read the account after profile or verification changes
    const refreshUser = useCallback(async () => {
        try {
            setUser(await api.getCurrentUser())
        } catch { /* keep current state */ }
    }, [])

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
