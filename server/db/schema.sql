-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar TEXT,
  bio TEXT,
  phone TEXT,
  address TEXT,
  id_front TEXT,
  id_back TEXT,
  role TEXT DEFAULT 'renter',
  is_verified INTEGER DEFAULT 0,
  phone_verified INTEGER DEFAULT 0,
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

-- Saved Listings
CREATE TABLE IF NOT EXISTS saved_listings (
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  last_4 TEXT NOT NULL,
  brand TEXT NOT NULL,
  exp_month TEXT NOT NULL,
  exp_year TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Conversations (Chat)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user1_id TEXT NOT NULL,
  user2_id TEXT NOT NULL,
  last_message TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id),
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
-- Pre-launch waitlist (rentaleze.com coming-soon page)
CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT,            -- 'rent' | 'list' | 'both'
  zip TEXT,
  interest TEXT,        -- what they want to rent or list
  source TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Shipping labels bought through ShipStation (one outbound + one return per shipped rental)
CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  direction TEXT NOT NULL,          -- 'outbound' (owner → renter) | 'return' (renter → owner)
  status TEXT NOT NULL,             -- 'created' | 'error' | 'voided'
  provider TEXT DEFAULT 'shipstation',
  mode TEXT,                        -- 'live' | 'mock'
  label_id TEXT,
  shipment_id TEXT,
  carrier_code TEXT,
  service_code TEXT,
  tracking_number TEXT,
  tracking_status TEXT,             -- ShipStation status code: AC, IT, DE, EX, UN …
  tracking_description TEXT,
  label_url TEXT,
  cost REAL,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- ─── Notifications ─────────────────────────────────────────────────────────
-- One row per in-app notification. dedupe_key stops scheduled reminders repeating.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  dedupe_key TEXT,
  read_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Every email / text we try to send, so support can see what reached a customer
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  channel TEXT NOT NULL,            -- email | sms
  destination TEXT,                 -- masked address / number
  status TEXT NOT NULL,             -- sent | dev | failed | skipped
  provider_id TEXT,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deliveries_user ON notification_deliveries(user_id, created_at);

-- Password reset links (token stored hashed, single use, 1 hour)
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);

-- ─── Help desk ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,   -- friendly ticket number (#1001)
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,           -- booking | shipping | payment | account | listing | damage | other
  status TEXT NOT NULL DEFAULT 'open',        -- open | pending (waiting on customer) | solved | closed
  priority TEXT NOT NULL DEFAULT 'normal',    -- low | normal | high | urgent
  assignee_id TEXT,
  booking_id TEXT,
  first_response_at TEXT,
  last_customer_at TEXT,
  last_staff_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status, priority, updated_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_role TEXT NOT NULL,        -- customer | staff | system
  body TEXT NOT NULL,
  internal INTEGER DEFAULT 0,       -- staff-only note
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);
