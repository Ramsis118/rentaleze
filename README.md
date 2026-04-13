# Rentaleze

> **Rent Anything. Earn From Everything.**

A peer-to-peer rental marketplace built with React and Node.js. Rentaleze enables anyone to rent items they need or earn passive income by listing items they own.

![Rentaleze Screenshot](https://via.placeholder.com/800x400?text=Rentaleze+Marketplace)

## ✨ Features

### For Renters
- 🔍 **Browse & Search** — Search by category, location, price, and features
- 📅 **Instant Booking** — Book instantly or request approval
- 🛡️ **Built-in Insurance** — Every rental covered
- 🚚 **Shipping Available** — Many items ship directly to you
- ⭐ **Verified Owners** — Reviews and ratings for trust

### For Owners
- 💰 **Earn Passive Income** — Turn idle items into revenue
- 📸 **Easy Listing** — Add photos, set price, go live
- 🛡️ **Insurance Included** — No extra cost to you
- ⚡ **Instant Payouts** — Get paid automatically after rental
- 📊 **Dashboard** — Track earnings and performance

### Platform
- 🔒 **Secure Payments** — Escrow protection
- ✅ **ID Verification** — All users verified
- 💬 **In-App Messaging** — No need to share contact info
- ⚖️ **Dispute Resolution** — Fair mediation

## 🛠️ Tech Stack

### Frontend
- **React 18** — UI framework
- **React Router v6** — Client-side routing
- **Tailwind CSS** — Utility-first styling
- **Vite** — Build tool

### Backend
- **Node.js + Express** — API server
- **SQLite (better-sqlite3)** — Database
- **JWT** — Authentication
- **bcryptjs** — Password hashing

### Infrastructure
- **Vercel** — Hosting (frontend + backend)
- **SQLite** — Embedded database (easy deployment)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/rentaleze.git
cd rentaleze

# Install all dependencies
npm run setup

# Or manually:
npm install
cd rentaleze-app && npm install
```

### Development

```bash
# Run both frontend and backend
npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

### Production Build

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
rentaleze/
├── rentaleze-app/           # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React Context providers
│   │   ├── data/           # Static data & constants
│   │   ├── api/            # API client
│   │   ├── App.jsx         # Main app with routing
│   │   └── main.jsx        # Entry point
│   ├── public/             # Static assets
│   └── package.json
│
├── server/                   # Express backend
│   ├── index.js             # Server entry point
│   ├── routes/              # API route handlers
│   ├── middleware/          # Auth middleware
│   ├── db/                  # Database setup & schema
│   └── utils/               # JWT utilities
│
├── .env.example             # Environment variables template
├── vercel.json             # Vercel configuration
└── package.json            # Root package.json
```

## 🌐 API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create new account |
| `/api/auth/login` | POST | Sign in |
| `/api/auth/logout` | POST | Sign out |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/refresh` | POST | Refresh access token |

### Listings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/listings` | GET | Get all listings (with filters) |
| `/api/listings/:id` | GET | Get single listing |
| `/api/listings` | POST | Create listing (auth) |
| `/api/listings/:id` | PUT | Update listing (auth) |
| `/api/listings/:id` | DELETE | Delete listing (auth) |
| `/api/listings/meta/categories` | GET | Get categories |

### Bookings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bookings` | POST | Create booking (auth) |
| `/api/bookings/my` | GET | Get user's bookings (auth) |
| `/api/bookings/:id` | GET | Get booking details (auth) |
| `/api/bookings/:id/cancel` | PUT | Cancel booking (auth) |

### Query Parameters

```
GET /api/listings?category=tools&minPrice=10&maxPrice=100&instantBook=true&shipping=true&verified=true&q=drill&sort=price_asc&limit=20
```

See full API docs in [API.md](API.md)

## 🔐 Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:5173

# JWT Secrets (generate unique values!)
ACCESS_TOKEN_SECRET=your-super-secret-access-key-here
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key-here
```

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables
4. Deploy!

```bash
# Environment variables for Vercel
ACCESS_TOKEN_SECRET=<generate-secure-key>
REFRESH_TOKEN_SECRET=<generate-secure-key>
FRONTEND_URL=https://your-app.vercel.app
```

### Railway

1. Connect GitHub repo
2. Railway auto-detects Node.js
3. Add environment variables
4. Deploy!

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables

## 📊 Database Schema

```
users ─────────┐
              │
listings ─────┼── listing_details
              │
reviews ──────┘
              │
bookings ─────┴── sessions
```

See full schema in [SCHEMA.md](SCHEMA.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Unsplash](https://unsplash.com) for sample images
- [Tailwind CSS](https://tailwindcss.com) for styling
- [React](https://react.dev) for the UI framework

---

Built with ❤️ by the Rentaleze team
