import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('accessToken')
            if (token) {
                try {
                    const userData = await api.getCurrentUser()
                    setUser(userData)
                } catch {
                    localStorage.removeItem('accessToken')
                    localStorage.removeItem('refreshToken')
                }
            }
            setLoading(false)
        }
        initAuth()
    }, [])

    const login = async (email, password) => {
        const data = await api.login(email, password)
        localStorage.setItem('refreshToken', data.refreshToken)
        setUser(data.user)
        return data.user
    }

    const signup = async (userData) => {
        const data = await api.signup(userData)
        localStorage.setItem('refreshToken', data.refreshToken)
        setUser(data.user)
        return data.user
    }

    const logout = async () => {
        await api.logout()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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