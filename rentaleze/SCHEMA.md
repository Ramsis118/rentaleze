# Rentaleze Database Schema

## Overview

Rentaleze uses **SQLite** with **better-sqlite3** for an embedded, zero-configuration database. This makes deployment simple - the database is a single file that travels with the application.

## Schema Diagram

```
┌─────────────┐
│   users    │◄──────────────┐
└─────────────┘               │
      │                       │
      ├───────────────────────┼───────────────────────┐
      │                       │                       │
      ▼                       ▼                       ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  listings   │       │  bookings   │       │  sessions   │
└─────────────┘       └─────────────┘       └─────────────┘
      │
      ├───────────────────────┐
      │                       │
      ▼                       ▼
┌─────────────┐       ┌─────────────┐
│listing_det │       │  reviews    │
└─────────────┘       └─────────────┘
```

## Tables

### users

Stores all user accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| email | TEXT | UNIQUE, NOT NULL | User email |
| password_hash | TEXT | NOT NULL | bcrypt hashed password |
| first_name | TEXT | NOT NULL | First name |
| last_name | TEXT | NOT NULL | Last name |
| avatar | TEXT | | Profile image URL |
| role | TEXT | DEFAULT 'renter' | `renter`, `owner`, or `both` |
| is_verified | INTEGER | DEFAULT 0 | Email verification status |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Account creation date |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Last update date |

**Indexes:**
- `idx_users_email` on `email`

---

### listings

Core rental listings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| owner_id | TEXT | FOREIGN KEY → users(id) | Owner user ID |
| title | TEXT | NOT NULL | Listing title |
| description | TEXT | | Full description |
| category | TEXT | NOT NULL | Category ID |
| price_per_day | REAL | NOT NULL | Daily rental price |
| rating | REAL | DEFAULT 0 | Average rating (0-5) |
| review_count | INTEGER | DEFAULT 0 | Number of reviews |
| location | TEXT | | City, State |
| distance | TEXT | | Distance from user |
| image | TEXT | | Main image URL |
| owner_name | TEXT | | Cached owner display name |
| owner_avatar | TEXT | | Cached owner avatar |
| badges | TEXT | | JSON array of badges |
| verified | INTEGER | DEFAULT 0 | Owner verification |
| shipping | INTEGER | DEFAULT 0 | Ships to renter |
| status | TEXT | DEFAULT 'active' | `active` or `inactive` |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |

**Indexes:**
- `idx_listings_category` on `category`
- `idx_listings_owner` on `owner_id`
- `idx_listings_status` on `status`

---

### listing_details

Extended info for each listing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| listing_id | TEXT | UNIQUE, FOREIGN KEY → listings(id) | |
| images | TEXT | | JSON array of image URLs |
| includes | TEXT | | JSON array of included items |
| specs | TEXT | | JSON object of specifications |
| rules | TEXT | | JSON array of rental rules |
| owner_since | INTEGER | | Year owner joined |
| owner_response_rate | INTEGER | | Response rate % |
| owner_response_time | TEXT | | Response time description |
| owner_total_reviews | INTEGER | DEFAULT 0 | Total reviews as owner |
| owner_bio | TEXT | | Owner bio text |

---

### reviews

User reviews for listings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| listing_id | TEXT | FOREIGN KEY → listings(id) | |
| user_id | TEXT | FOREIGN KEY → users(id) | |
| user_name | TEXT | | Reviewer display name |
| user_avatar | TEXT | | Reviewer avatar |
| rating | INTEGER | NOT NULL | 1-5 stars |
| text | TEXT | | Review text |
| date | TEXT | | Date of stay/rental |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |

**Indexes:**
- `idx_reviews_listing` on `listing_id`

---

### bookings

Rental orders/bookings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| listing_id | TEXT | FOREIGN KEY → listings(id) | |
| user_id | TEXT | FOREIGN KEY → users(id) | Renter |
| start_date | TEXT | NOT NULL | Rental start |
| end_date | TEXT | NOT NULL | Rental end |
| days | INTEGER | NOT NULL | Total days |
| qty | INTEGER | DEFAULT 1 | Quantity rented |
| fulfillment | TEXT | DEFAULT 'pickup' | `pickup` or `shipping` |
| base_total | REAL | NOT NULL | Base rental cost |
| insurance | REAL | | Insurance fee (8%) |
| service_fee | REAL | | Service fee (12%) |
| shipping_fee | REAL | DEFAULT 0 | Shipping cost |
| total | REAL | NOT NULL | Total charged |
| status | TEXT | DEFAULT 'pending' | `pending`, `confirmed`, `completed`, `cancelled` |
| intended_use | TEXT | | Renter's intended use |
| shipping_address | TEXT | | Full shipping address |
| shipping_city | TEXT | | |
| shipping_state | TEXT | | |
| shipping_zip | TEXT | | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |

**Indexes:**
- `idx_bookings_user` on `user_id`
- `idx_bookings_listing` on `listing_id`
- `idx_bookings_status` on `status`

---

### sessions

Refresh token sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| user_id | TEXT | FOREIGN KEY → users(id) | |
| refresh_token | TEXT | NOT NULL | Refresh token |
| expires_at | TEXT | NOT NULL | Token expiration |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |

---

## Relationships

```
users (1) ────── (∞) listings
  │                  │
  │                  ├── (1) listing_details
  │                  │
  │                  └── (∞) reviews
  │
  └──── (1) ───── (∞) bookings
                      │
                      └── (1) listings
```

## Data Flow

1. **User signs up** → `users` table
2. **User creates listing** → `listings` + `listing_details`
3. **Other user books** → `bookings` created
4. **After rental** → `reviews` created → `listings.rating` updated
5. **User logs in** → `sessions` created for refresh token

## SQL Schema (Raw)

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'renter',
  is_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price_per_day REAL NOT NULL,
  rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  location TEXT,
  distance TEXT,
  image TEXT,
  owner_name TEXT,
  owner_avatar TEXT,
  badges TEXT,
  verified INTEGER DEFAULT 0,
  shipping INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS listing_details (
  id TEXT PRIMARY KEY,
  listing_id TEXT UNIQUE NOT NULL,
  images TEXT,
  includes TEXT,
  specs TEXT,
  rules TEXT,
  owner_since INTEGER,
  owner_response_rate INTEGER,
  owner_response_time TEXT,
  owner_total_reviews INTEGER DEFAULT 0,
  owner_bio TEXT,
  FOREIGN KEY (listing_id) REFERENCES listings(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  rating INTEGER NOT NULL,
  text TEXT,
  date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  qty INTEGER DEFAULT 1,
  fulfillment TEXT DEFAULT 'pickup',
  base_total REAL NOT NULL,
  insurance REAL,
  service_fee REAL,
  shipping_fee REAL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  intended_use TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);