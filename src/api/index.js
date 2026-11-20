const API_BASE = import.meta.env.VITE_API_URL || '/api'

class ApiClient {
    constructor() {
        this.accessToken = localStorage.getItem('accessToken')
        this.refreshing = null // shared promise so parallel requests refresh only once
    }

    setToken(token) {
        this.accessToken = token
        if (token) {
            localStorage.setItem('accessToken', token)
        } else {
            localStorage.removeItem('accessToken')
        }
    }

    setSession({ accessToken, refreshToken }) {
        this.setToken(accessToken)
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    }

    clearSession() {
        this.setToken(null)
        localStorage.removeItem('refreshToken')
    }

    // Swap the refresh token for a fresh pair. Returns true on success.
    async refreshSession() {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) return false
        if (!this.refreshing) {
            this.refreshing = fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            })
                .then(async (r) => {
                    if (!r.ok) return false
                    this.setSession(await r.json())
                    return true
                })
                .catch(() => false)
                .finally(() => { this.refreshing = null })
        }
        return this.refreshing
    }

    async request(endpoint, options = {}, retried = false) {
        const headers = {
            ...options.headers
        }

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json'
        }

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        })

        // Access tokens last 15 minutes: refresh quietly and try once more
        if (response.status === 401 && !retried && !endpoint.startsWith('/auth/') && localStorage.getItem('refreshToken')) {
            if (await this.refreshSession()) return this.request(endpoint, options, true)
            this.clearSession()
            window.dispatchEvent(new Event('auth:expired'))
        }

        let data
        try {
            data = await response.json()
        } catch {
            throw new Error(response.ok ? 'Unexpected server response' : `Request failed (${response.status})`)
        }

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
        this.setSession(data)
        return data
    }

    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        })
        this.setSession(data)
        return data
    }

    async logout() {
        const refreshToken = localStorage.getItem('refreshToken')
        try {
            await this.request('/auth/logout', {
                method: 'POST',
                body: JSON.stringify({ refreshToken })
            })
        } finally {
            this.clearSession()
        }
    }

    async getCurrentUser() {
        try {
            return await this.request('/auth/me')
        } catch (err) {
            // /auth/me is not auto-retried above (it's an /auth route), so refresh here
            if (await this.refreshSession()) return this.request('/auth/me')
            throw err
        }
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

    async getMyListings() {
        return this.request('/listings/mine')
    }

    async updateListing(id, data) {
        return this.request(`/listings/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteListing(id) {
        return this.request(`/listings/${id}`, { method: 'DELETE' })
    }

    async uploadListingPhotos(files) {
        const form = new FormData()
        for (const f of files) form.append('photos', f)
        return this.request('/listings/photos', { method: 'POST', body: form })
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

    async getOwnerBookings() {
        return this.request('/bookings/rentals')
    }

    // action: accept | decline | cancel | pickup | return
    async bookingAction(id, action, note) {
        return this.request(`/bookings/${id}/${action}`, {
            method: 'PUT',
            body: JSON.stringify(note ? { note } : {})
        })
    }

    async cancelBooking(id) {
        return this.bookingAction(id, 'cancel')
    }

    // Shipping (ShipStation)
    async getShippingQuote(listingId, { zip, city, state } = {}) {
        const query = new URLSearchParams({ listingId, zip: zip || '', city: city || '', state: state || '' }).toString()
        return this.request(`/shipping/quote?${query}`)
    }

    async getBookingShipments(bookingId) {
        return this.request(`/shipping/bookings/${bookingId}`)
    }

    // Owner: create (or retry) the send + return labels
    async createShippingLabels(bookingId) {
        return this.request(`/shipping/bookings/${bookingId}/labels`, { method: 'POST' })
    }

    // Verification (Stripe Identity + text message code)
    getVerificationStatus() { return this.request('/verification/status') }
    startIdentityCheck() { return this.request('/verification/identity/start', { method: 'POST' }) }
    devCompleteIdentity() { return this.request('/verification/identity/dev-complete', { method: 'POST' }) }
    sendPhoneCode(phone) { return this.request('/verification/phone/send', { method: 'POST', body: JSON.stringify({ phone }) }) }
    checkPhoneCode(code) { return this.request('/verification/phone/check', { method: 'POST', body: JSON.stringify({ code }) }) }

    // Booking trust: photos, reviews, claims
    getBookingTrust(id) { return this.request(`/bookings/${id}/trust`) }
    uploadBookingPhotos(id, stage, files) {
        const form = new FormData()
        for (const f of files) form.append('photos', f)
        return this.request(`/bookings/${id}/photos?stage=${stage}`, { method: 'POST', body: form })
    }
    deleteBookingPhoto(id, photoId) { return this.request(`/bookings/${id}/photos/${photoId}`, { method: 'DELETE' }) }
    reviewBooking(id, rating, text) { return this.request(`/bookings/${id}/review`, { method: 'POST', body: JSON.stringify({ rating, text }) }) }
    fileClaim(id, data) { return this.request(`/bookings/${id}/claims`, { method: 'POST', body: JSON.stringify(data) }) }
    commentOnClaim(id, claimId, body) { return this.request(`/bookings/${id}/claims/${claimId}/comment`, { method: 'POST', body: JSON.stringify({ body }) }) }
    withdrawClaim(id, claimId) { return this.request(`/bookings/${id}/claims/${claimId}/withdraw`, { method: 'POST' }) }

    // Public profiles
    getPublicProfile(userId) { return this.request(`/users/${userId}/public`) }

    // Admin
    admin(path, options = {}) {
        const { method = 'GET', body } = options
        return this.request(`/admin${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
    }
}

export const api = new ApiClient()
export default api
