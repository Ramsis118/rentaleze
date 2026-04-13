# Rentaleze Deployment Guide

## Deployment Options

| Platform | Free Tier | Difficulty | Recommended For |
|----------|----------|------------|----------------|
| **Vercel** | ✅ Yes | Easy | Most users |
| **Railway** | ✅ Yes | Easy | Node.js apps |
| **Render** | ✅ Yes | Medium | Full-stack apps |
| **Fly.io** | ✅ Yes | Medium | Global deployment |
| **DigitalOcean App Platform** | ✅ Yes | Medium | Production apps |

---

## Vercel (Recommended)

### Step 1: Push to GitHub

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/rentaleze.git
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel auto-detects the configuration

### Step 3: Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```env
NODE_ENV=production
ACCESS_TOKEN_SECRET=<generate-32-char-random-string>
REFRESH_TOKEN_SECRET=<generate-32-char-random-string>
FRONTEND_URL=https://your-app.vercel.app
```

**Generate secrets:**
```bash
# macOS/Linux
openssl rand -base64 32

# Or use online generator: https://randomkeygen.com
```

### Step 4: Deploy

Click "Deploy" - Vercel will:
1. Install dependencies
2. Build the frontend
3. Deploy to global CDN

Your app will be live at: `https://your-app.vercel.app`

---

## Railway

### Step 1: Prepare Repository

Push your code to GitHub (same as Vercel step 1).

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select your repository

### Step 3: Configure

Railway will auto-detect Node.js. If not:

1. Go to Project Settings → Start Command
2. Set: `npm start`

### Step 4: Add Environment Variables

```env
NODE_ENV=production
ACCESS_TOKEN_SECRET=<your-secret>
REFRESH_TOKEN_SECRET=<your-secret>
```

### Step 5: Deploy

Railway will auto-deploy on every push to main.

---

## Render

### Step 1: Create Web Service

1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect GitHub repo

### Step 2: Configure

| Setting | Value |
|---------|-------|
| **Name** | rentaleze |
| **Region** | Choose closest |
| **Branch** | main |
| **Root Directory** | (leave empty) |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

### Step 3: Environment Variables

Add same variables as Vercel.

### Step 4: Deploy

Click "Create Web Service" - deployment takes ~2-3 minutes.

---

## Fly.io

### Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -outfile install.ps1; .\install.ps1
```

### Step 2: Login

```bash
fly auth login
```

### Step 3: Launch

```bash
cd rentaleze
fly launch
```

Follow prompts - choose:
- App name: `rentaleze`
- Region: closest to you

### Step 4: Set Secrets

```bash
fly secrets set ACCESS_TOKEN_SECRET=your-secret
fly secrets set REFRESH_TOKEN_SECRET=your-secret
fly secrets set FRONTEND_URL=https://rentaleze.fly.dev
```

### Step 5: Deploy

```bash
fly deploy
```

Your app will be live at: `https://rentaleze.fly.dev`

---

## Database Notes

### SQLite on Vercel

**Important:** Vercel serverless functions have ephemeral filesystem (files are deleted between invocations). To persist SQLite:

**Option 1: Use Turso (SQLite on edge)**

```bash
# Install Turso CLI
curl -sSfL https://turso.tech/install.sh | bash

# Create database
turso db create rentaleze
turso db show rentaleze --url
```

Then update `server/db/database.js` to connect to Turso.

**Option 2: Use Planetscale/Supabase**

Switch to MySQL/Postgres for production:

```bash
# Install Prisma
npm install prisma @prisma/client

# Initialize
npx prisma init
```

---

## Custom Domain

### Vercel

1. Go to Settings → Domains
2. Add your domain (e.g., `rentaleze.com`)
3. Add DNS records as instructed
4. Wait for SSL certificate

### Railway

1. Project → Settings → Networking
2. Add custom domain

### Render

1. Web Service → Settings → Custom Domains
2. Add domain and configure DNS

---

## Monitoring

### Vercel Analytics

Built-in analytics at `vercel.com/dashboard`

### Application Monitoring

Add to your app:

```bash
# Install Sentry
npm install @sentry/node

# In server/index.js
import * as Sentry from '@sentry/node'
Sentry.init({ dsn: process.env.SENTRY_DSN })
```

---

## Troubleshooting

### "Module not found"

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Connection refused"

Check your server is running:
```bash
npm run dev:server
# Should show: Server running on http://localhost:3001
```

### "Database locked"

SQLite issue - only one write at a time. For production, switch to PostgreSQL.

### CORS errors

Ensure `FRONTEND_URL` matches exactly:
- Include protocol: `https://`
- No trailing slash

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate new JWT secrets (not dev defaults)
- [ ] Enable HTTPS (all platforms provide this)
- [ ] Set up custom domain (optional)
- [ ] Configure rate limiting (already enabled)
- [ ] Add monitoring (Sentry/LogRocket)
- [ ] Set up error tracking
- [ ] Test checkout flow
- [ ] Enable email (SendGrid/SES) for confirmations