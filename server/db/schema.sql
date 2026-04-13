-- Users table
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

-- Listings table
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
  badges TEXT, -- JSON array
  verified INTEGER DEFAULT 0,
  shipping INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Listing details (extended info)
CREATE TABLE IF NOT EXISTS listing_details (
  id TEXT PRIMARY KEY,
  listing_id TEXT UNIQUE NOT NULL,
  images TEXT, -- JSON array
  includes TEXT, -- JSON array
  specs TEXT, -- JSON object
  rules TEXT, -- JSON array
  owner_since INTEGER,
  owner_response_rate INTEGER,
  owner_response_time TEXT,
  owner_total_reviews INTEGER DEFAULT 0,
  owner_bio TEXT,
  FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- Reviews table
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

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  qty INTEGER DEFAULT 1,
  base_total REAL NOT NULL,
  insurance REAL,
  service_fee REAL,
  shipping_fee REAL,
  total REAL NOT NULL,
  fulfillment TEXT DEFAULT 'pickup',
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

-- Sessions table (for refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);