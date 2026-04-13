const API_BASE = import.meta.env.VITE_API_URL || '/api'

class ApiClient {
    constructor() {
        this.accessToken = localStorage.getItem('accessToken')
    }

    setToken(token) {
        this.accessToken = token
        if (token) {
            localStorage.setItem('accessToken', token)
        } else {
            localStorage.removeItem('accessToken')
        }
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        }

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || 'Request failed')
        }

        return data
    }

    // Auth
    async signup(userData) {
        const data = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        })
        this.setToken(data.accessToken)
        return data
    }

    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        })
        this.setToken(data.accessToken)
        return data
    }

    async logout() {
        const refreshToken = localStorage.getItem('refreshToken')
        await this.request('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken })
        })
        this.setToken(null)
        localStorage.removeItem('refreshToken')
    }

    async getCurrentUser() {
        return this.request('/auth/me')
    }

    // Listings
    async getListings(params = {}) {
        const query = new URLSearchParams(params).toString()
        return this.request(`/listings${query ? `?${query}` : ''}`)
    }

    async getListing(id) {
        return this.request(`/listings/${id}`)
    }

    async createListing(data) {
        return this.request('/listings', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async getCategories() {
        return this.request('/listings/meta/categories')
    }

    // Bookings
    async createBooking(data) {
        return this.request('/bookings', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async getMyBookings() {
        return this.request('/bookings/my')
    }

    async cancelBooking(id) {
        return this.request(`/bookings/${id}/cancel`, {
            method: 'PUT'
        })
    }
}

export const api = new ApiClient()
export default api