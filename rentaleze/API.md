# Rentaleze API Documentation

## Base URL

```
Development: http://localhost:3001/api
Production:  https://your-domain.com/api
```

## Authentication

Most endpoints require authentication. Include the JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Auth Endpoints

#### POST /auth/signup

Create a new user account.

**Request:**
```json
{
  "email": "jane@example.com",
  "password": "securepassword123",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "renter"
}
```

**Response (201):**
```json
{
  "message": "Account created successfully",
  "user": {
    "id": "uuid-here",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "renter"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

#### POST /auth/login

Sign in to existing account.

**Request:**
```json
{
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-here",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "avatar": "https://...",
    "role": "renter"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

#### GET /auth/me

Get current authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "uuid-here",
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "avatar": "https://...",
  "role": "renter",
  "isVerified": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

#### POST /auth/refresh

Get new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

#### POST /auth/logout

Sign out (invalidate refresh token).

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### Listing Endpoints

#### GET /listings

Get all listings with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category (e.g., `tools`, `outdoor`) |
| `minPrice` | number | Minimum price per day |
| `maxPrice` | number | Maximum price per day |
| `instantBook` | boolean | Show only instant book listings |
| `shipping` | boolean | Show only shippable listings |
| `verified` | boolean | Show only verified owners |
| `q` | string | Search in title, description, location |
| `sort` | string | `price_asc`, `price_desc`, `rating`, `relevance` |
| `limit` | number | Max results (default: 50) |

**Example:**
```
GET /api/listings?category=tools&minPrice=10&maxPrice=100&sort=price_asc
```

**Response (200):**
```json
[
  {
    "id": "uuid-here",
    "title": "DeWalt 20V Cordless Drill Set",
    "category": "tools",
    "pricePerDay": 18,
    "rating": 4.9,
    "reviewCount": 142,
    "location": "Austin, TX",
    "distance": "1.2 mi",
    "image": "https://...",
    "ownerName": "Marcus T.",
    "ownerAvatar": "https://...",
    "badges": ["Insured", "Instant Book"],
    "verified": true,
    "shipping": true
  }
]
```

---

#### GET /listings/:id

Get single listing with full details.

**Response (200):**
```json
{
  "id": "uuid-here",
  "title": "DeWalt 20V Cordless Drill Set",
  "category": "tools",
  "pricePerDay": 18,
  "rating": 4.9,
  "reviewCount": 142,
  "location": "Austin, TX",
  "distance": "1.2 mi",
  "image": "https://...",
  "badges": ["Insured", "Instant Book"],
  "verified": true,
  "shipping": true,
  "details": {
    "description": "Professional-grade drill...",
    "images": ["https://...", "https://..."],
    "includes": ["Drill body", "2 batteries", "Charger"],
    "specs": {
      "Voltage": "20V MAX",
      "Chuck Size": "1/2\""
    },
    "rules": ["Clean before return", "No outdoor wet use"]
  },
  "reviews": [
    {
      "id": "uuid",
      "name": "Jordan M.",
      "avatar": "https://...",
      "rating": 5,
      "date": "March 2026",
      "text": "Drill was perfect..."
    }
  ],
  "owner": {
    "id": "uuid",
    "name": "Marcus T.",
    "avatar": "https://...",
    "isVerified": true,
    "memberSince": "2021"
  }
}
```

---

#### POST /listings

Create a new listing. **Requires authentication.**

**Request:**
```json
{
  "title": "My Drill Set",
  "description": "Great for home projects",
  "category": "tools",
  "pricePerDay": 20,
  "location": "Austin, TX",
  "image": "https://...",
  "badges": ["Insured"],
  "shipping": true
}
```

**Response (201):**
```json
{
  "id": "new-uuid-here",
  "message": "Listing created successfully"
}
```

---

#### PUT /listings/:id

Update a listing. **Requires authentication.**

**Request:**
```json
{
  "pricePerDay": 25,
  "title": "Updated title"
}
```

**Response (200):**
```json
{
  "message": "Listing updated successfully"
}
```

---

#### DELETE /listings/:id

Delete a listing. **Requires authentication.**

**Response (200):**
```json
{
  "message": "Listing deleted successfully"
}
```

---

#### GET /listings/meta/categories

Get all available categories.

**Response (200):**
```json
[
  { "id": "all", "label": "All Items", "icon": "✦" },
  { "id": "tools", "label": "Tools & Equipment", "icon": "🔧" },
  { "id": "outdoor", "label": "Outdoor & Camping", "icon": "🏕️" }
]
```

---

### Booking Endpoints

#### POST /bookings

Create a new booking. **Requires authentication.**

**Request:**
```json
{
  "listingId": "uuid-here",
  "startDate": "2026-04-01",
  "endDate": "2026-04-03",
  "days": 3,
  "qty": 1,
  "fulfillment": "pickup",
  "intendedUse": "Building a deck for my backyard"
}
```

**Response (201):**
```json
{
  "id": "booking-uuid-here",
  "message": "Booking created successfully",
  "total": 74.88
}
```

---

#### GET /bookings/my

Get current user's bookings. **Requires authentication.**

**Response (200):**
```json
[
  {
    "id": "booking-uuid",
    "listing_id": "listing-uuid",
    "start_date": "2026-04-01",
    "end_date": "2026-04-03",
    "days": 3,
    "total": 74.88,
    "status": "pending",
    "title": "DeWalt Drill",
    "image": "https://..."
  }
]
```

---

#### GET /bookings/:id

Get booking details. **Requires authentication.**

**Response (200):**
```json
{
  "id": "booking-uuid",
  "listing_id": "listing-uuid",
  "start_date": "2026-04-01",
  "end_date": "2026-04-03",
  "days": 3,
  "qty": 1,
  "base_total": 54,
  "insurance": 4.32,
  "service_fee": 6.48,
  "shipping_fee": 0,
  "total": 74.88,
  "fulfillment": "pickup",
  "status": "pending",
  "title": "DeWalt Drill",
  "image": "https://...",
  "location": "Austin, TX",
  "owner_name": "Marcus T."
}
```

---

#### PUT /bookings/:id/cancel

Cancel a booking. **Requires authentication.**

**Response (200):**
```json
{
  "message": "Booking cancelled successfully"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Not allowed |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

API endpoints are rate-limited to 100 requests per 15 minutes per IP.

When rate limited, you'll receive:

```json
{
  "error": "Too many requests, please try again later."
}