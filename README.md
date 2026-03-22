# HemoSync — Backend Setup & Deployment Guide
## Tech Stack: Node.js · Express · PostgreSQL · JWT

---

## PART 1 — PROJECT STRUCTURE

```
hemosync-backend/
├── package.json
├── .env.example              ← copy to .env, fill your values
├── .gitignore
│
├── sql/
│   └── schema.sql            ← full DB schema + seed data
│
└── src/
    ├── server.js             ← entry point  (node src/server.js)
    ├── app.js                ← Express app, middleware, routes
    │
    ├── config/
    │   ├── db.js             ← PostgreSQL connection pool
    │   └── initDb.js         ← one-time DB creation + schema runner
    │
    ├── controllers/
    │   ├── authController.js       ← register, login, refresh, logout, me
    │   ├── inventoryController.js  ← blood stock CRUD
    │   ├── requestController.js    ← blood request lifecycle
    │   ├── donationController.js   ← donor appointments
    │   └── userController.js       ← profile + emergency contacts
    │
    ├── middleware/
    │   ├── auth.js           ← JWT authenticate + authorize(role)
    │   ├── validate.js       ← express-validator result checker
    │   └── errorHandler.js   ← global error catcher
    │
    ├── routes/
    │   ├── auth.js           ← /api/auth/*
    │   ├── inventory.js      ← /api/inventory/*
    │   ├── requests.js       ← /api/requests/*
    │   ├── donations.js      ← /api/donations/*
    │   └── users.js          ← /api/users/*
    │
    └── utils/
        ├── jwt.js            ← sign / verify tokens
        ├── response.js       ← success / error / paginated helpers
        └── generateNumber.js ← REQ-XXXX / DON-XXXX generators

frontend-updated/
    ├── api-client.js         ← shared API wrapper (include in every page)
    └── hemosync.js           ← updated landing page JS
```

---

## PART 2 — COMPLETE API REFERENCE

| Method | Endpoint                            | Auth | Role          | Description                    |
|--------|-------------------------------------|------|---------------|--------------------------------|
| GET    | /health                             | —    | public        | Server health check            |
| POST   | /api/auth/register                  | —    | public        | Create account                 |
| POST   | /api/auth/login                     | —    | public        | Login, get tokens              |
| POST   | /api/auth/refresh                   | —    | public        | Rotate access token            |
| POST   | /api/auth/logout                    | —    | public        | Revoke refresh token           |
| GET    | /api/auth/me                        | JWT  | all           | Current user + profile         |
| GET    | /api/inventory                      | —    | public        | All blood type stock           |
| GET    | /api/inventory/:bloodType           | —    | public        | Single blood type stock        |
| PATCH  | /api/inventory/:bloodType           | JWT  | hospital      | Update stock levels            |
| POST   | /api/requests                       | JWT  | hospital/ind  | Submit blood request           |
| GET    | /api/requests                       | JWT  | all           | List requests (role-scoped)    |
| GET    | /api/requests/:id                   | JWT  | all           | Single request detail          |
| PATCH  | /api/requests/:id/status            | JWT  | hospital/all  | Change request status          |
| POST   | /api/donations                      | JWT  | donor         | Schedule donation appointment  |
| GET    | /api/donations                      | JWT  | donor         | List own donations             |
| DELETE | /api/donations/:id                  | JWT  | donor         | Cancel appointment             |
| PATCH  | /api/donations/:id/complete         | JWT  | hospital      | Mark donation complete         |
| PATCH  | /api/users/me                       | JWT  | all           | Update basic profile           |
| PATCH  | /api/users/me/password              | JWT  | all           | Change password                |
| PATCH  | /api/users/me/hospital-profile      | JWT  | hospital      | Update hospital info           |
| PATCH  | /api/users/me/donor-profile         | JWT  | donor         | Update donor health info       |
| PATCH  | /api/users/me/individual-profile    | JWT  | individual    | Update medical card            |
| GET    | /api/users/me/contacts              | JWT  | all           | List emergency contacts        |
| POST   | /api/users/me/contacts              | JWT  | all           | Add emergency contact          |
| DELETE | /api/users/me/contacts/:id          | JWT  | all           | Remove emergency contact       |

---

## PART 3 — LOCAL DEVELOPMENT SETUP (Step by Step)

### Step 1 — Prerequisites

Make sure these are installed on your machine:

```bash
node --version     # must be >= 18
npm --version      # comes with Node
psql --version     # PostgreSQL 14+ recommended
```

Download links:
- Node.js  → https://nodejs.org
- PostgreSQL → https://www.postgresql.org/download/

---

### Step 2 — Clone / unzip the project

```bash
# If using git
git clone <your-repo-url>
cd hemosync-backend

# Or just unzip and cd into the folder
cd hemosync-backend
```

---

### Step 3 — Install Node dependencies

```bash
npm install
```

This installs: express, pg, bcryptjs, jsonwebtoken, cors, helmet,
express-validator, express-rate-limit, morgan, uuid, dotenv, nodemon.

---

### Step 4 — Configure environment variables

```bash
cp .env.example .env
```

Now open `.env` in any text editor and fill in:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=hemosync
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

# Generate secrets with:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=paste_64_char_hex_here
JWT_REFRESH_SECRET=paste_another_64_char_hex_here

JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:5500,http://127.0.0.1:5501

BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

Generate your JWT secrets (run this in terminal):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Run twice — use one for ACCESS_SECRET, one for REFRESH_SECRET
```

---

### Step 5 — Create the PostgreSQL database and apply schema

```bash
# Method A: Automated (recommended)
npm run db:init
# This creates the 'hemosync' database and runs the full schema + seed data

# Method B: Manual
psql -U postgres -c "CREATE DATABASE hemosync;"
psql -U postgres -d hemosync -f sql/schema.sql
```

After running, you'll see:
```
✅ Database "hemosync" created.
✅ Schema applied successfully.
✅ Seed data inserted.

Demo accounts:
  Hospital  → admin@hospital.com  / password123
  Donor     → donor@gmail.com     / password123
  Individual→ user@gmail.com      / password123
```

---

### Step 6 — Start the backend server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

You should see:
```
✅ PostgreSQL connected successfully

🚀 HemoSync API running on port 5000
   Environment : development
   Health check: http://localhost:5000/health
   API base URL: http://localhost:5000/api
```

Test the health endpoint:
```bash
curl http://localhost:5000/health
# {"status":"ok","service":"HemoSync API",...}
```

---

### Step 7 — Connect the Frontend

**Option A — VS Code Live Server (quickest)**
1. Install the "Live Server" extension in VS Code
2. Open your frontend folder (the one with index.html)
3. Right-click `index.html` → "Open with Live Server"
4. It opens on http://127.0.0.1:5500

Make sure `CORS_ORIGINS` in your `.env` includes `http://127.0.0.1:5500`.

**Option B — serve via Node**
```bash
npm install -g serve
serve /path/to/your/frontend -p 3000
```
Add `http://localhost:3000` to `CORS_ORIGINS`.

**Frontend files to update:**

Replace `hemosync.js` with `frontend-updated/hemosync.js` from this package.

Add `api-client.js` to your frontend folder.

In `hospital-dashboard.html`, add before `</body>`:
```html
<script src="api-client.js"></script>
```
Do the same for `individual-dashboard.html` and `donor-dashboard.html`.

In each dashboard JS file, replace the `handleLogout()` function:
```javascript
function handleLogout() {
  apiLogout();  // from api-client.js — clears tokens and redirects
}
```

---

### Step 8 — Test the API

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test1234","role":"individual"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@gmail.com","password":"password123"}'

# Get inventory (public)
curl http://localhost:5000/api/inventory

# Get my profile (replace TOKEN with your access token)
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

---

## PART 4 — DEPLOY TO THE INTERNET

### Option A — Railway (Easiest, Recommended for Beginners)

Railway gives you free PostgreSQL + Node hosting in one platform.

**Step 1 — Push code to GitHub**
```bash
git init
git add .
git commit -m "Initial HemoSync backend"
git branch -M main
git remote add origin https://github.com/your-username/hemosync-backend.git
git push -u origin main
```

**Step 2 — Create Railway account**
- Go to https://railway.app
- Sign up with GitHub

**Step 3 — Create a new project**
1. Click "New Project"
2. Choose "Deploy from GitHub repo"
3. Select your `hemosync-backend` repository
4. Railway auto-detects Node.js and deploys

**Step 4 — Add PostgreSQL**
1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway creates the DB and gives you a `DATABASE_URL`

**Step 5 — Set environment variables**
1. Click your Node.js service
2. Go to "Variables" tab
3. Add all variables from your `.env`:

```
NODE_ENV=production
PORT=5000
DB_HOST=<from Railway Postgres service Variables tab>
DB_PORT=<from Railway>
DB_NAME=<from Railway>
DB_USER=<from Railway>
DB_PASSWORD=<from Railway>
JWT_ACCESS_SECRET=<your 64-char hex>
JWT_REFRESH_SECRET=<your other 64-char hex>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGINS=https://your-frontend-domain.com
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**Step 6 — Run database schema**

In Railway, open your Node.js service → "Shell" tab → run:
```bash
npm run db:init
```

**Step 7 — Get your public URL**
- Go to your service → Settings → Networking → "Generate Domain"
- Your API is now live at `https://hemosync-backend-production.up.railway.app`

---

### Option B — Render (Free tier available)

**Step 1 — Create a Render account**
- Go to https://render.com → Sign up

**Step 2 — Create PostgreSQL database**
1. Dashboard → "New" → "PostgreSQL"
2. Name: `hemosync-db`, Region: choose closest
3. Click "Create Database"
4. Copy the "Internal Database URL"

**Step 3 — Create Web Service**
1. Dashboard → "New" → "Web Service"
2. Connect your GitHub repo
3. Configure:
   - **Name**: hemosync-api
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variables (same list as Railway above)
   - For DB variables, use the values from your Render PostgreSQL service

**Step 4 — Deploy**
Click "Create Web Service". Render builds and deploys automatically.

**Step 5 — Run schema**
In Render Shell (service → Shell tab):
```bash
npm run db:init
```

Your URL will be: `https://hemosync-api.onrender.com`

---

### Option C — VPS (DigitalOcean / Linode / AWS EC2)

For production-grade deployment on your own server.

**Step 1 — Create a $6/month Droplet on DigitalOcean**
- Choose Ubuntu 22.04, Basic plan $6/mo
- Add your SSH key

**Step 2 — SSH into the server**
```bash
ssh root@your-server-ip
```

**Step 3 — Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
node --version   # should show v20.x
```

**Step 4 — Install PostgreSQL**
```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Create DB user and database
sudo -u postgres psql -c "CREATE USER hemosync WITH PASSWORD 'StrongPassword123!';"
sudo -u postgres psql -c "CREATE DATABASE hemosync OWNER hemosync;"
```

**Step 5 — Clone and configure**
```bash
git clone https://github.com/your-username/hemosync-backend.git
cd hemosync-backend
npm install

cp .env.example .env
nano .env   # Fill in all values
# DB_USER=hemosync, DB_PASSWORD=StrongPassword123!, DB_HOST=localhost
```

**Step 6 — Apply schema**
```bash
npm run db:init
```

**Step 7 — Install PM2 (process manager)**
```bash
npm install -g pm2
pm2 start src/server.js --name hemosync-api
pm2 startup   # auto-restart on reboot
pm2 save
pm2 status
```

**Step 8 — Install Nginx as reverse proxy**
```bash
apt install -y nginx

cat > /etc/nginx/sites-available/hemosync << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/hemosync /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

**Step 9 — Add HTTPS with Let's Encrypt (free SSL)**
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.yourdomain.com
# Follow prompts — it auto-configures HTTPS
```

Your API is now live at `https://api.yourdomain.com`

---

## PART 5 — HOST THE FRONTEND

### Option A — Netlify (Recommended, Free)

1. Go to https://netlify.com → Sign up
2. Drag and drop your frontend folder onto the Netlify dashboard
3. Netlify gives you a URL like `https://hemosync-abc123.netlify.app`

**Update API URL in frontend:**

Before deploying, update the `API` constant in `hemosync.js` and `api-client.js`:
```javascript
const API = 'https://hemosync-api.onrender.com/api';
// Replace with your actual backend URL
```

Then in your backend `.env`, update CORS:
```env
CORS_ORIGINS=https://hemosync-abc123.netlify.app
```

### Option B — GitHub Pages (Static only, Free)

1. Push your frontend files to a GitHub repo
2. Settings → Pages → Source: "Deploy from branch" → main
3. Your site is at `https://your-username.github.io/hemosync`

### Option C — Vercel

```bash
npm install -g vercel
cd /path/to/frontend
vercel
# Follow prompts — auto-deploys to https://hemosync.vercel.app
```

---

## PART 6 — LINKING FRONTEND TO BACKEND (Summary)

### 1. Set the API URL

In `api-client.js` (add to all frontend pages):
```javascript
const API = 'https://your-backend-url.com/api';
```

### 2. Include api-client.js in every HTML page

In `hospital-dashboard.html`, `individual-dashboard.html`, `donor-dashboard.html`:
```html
<!-- Add BEFORE your dashboard JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="api-client.js"></script>
<script src="hospital-dashboard.js"></script>   <!-- or donor/individual -->
```

### 3. Replace handleLogout() in all dashboard JS files

In `hospital-dashboard.js`, `individual-dashboard.js`, `donor-dashboard.js`:
```javascript
// Replace the existing handleLogout function with:
function handleLogout() {
  apiLogout();
}
```

### 4. Protect dashboard pages (add to top of each dashboard JS)

```javascript
// At the very top of hospital-dashboard.js / individual-dashboard.js / donor-dashboard.js
if (!requireAuth()) {
  // requireAuth() automatically redirects to index.html if not logged in
}
const sessionUser = Tokens.getUser();
```

### 5. Update CORS in backend .env

```env
CORS_ORIGINS=https://your-frontend-domain.netlify.app,https://your-custom-domain.com
```

Restart the backend after any .env change:
```bash
# Local:  Ctrl+C then npm run dev
# Railway/Render: push a commit to trigger redeploy
# PM2:    pm2 restart hemosync-api
```

---

## PART 7 — ENVIRONMENT CHECKLIST BEFORE GOING LIVE

- [ ] `NODE_ENV=production` is set
- [ ] Both JWT secrets are long random strings (64+ chars)
- [ ] `BCRYPT_ROUNDS=12` (12 is standard for production)
- [ ] `CORS_ORIGINS` lists ONLY your actual frontend domain(s)
- [ ] `.env` is in `.gitignore` (never commit secrets)
- [ ] Database is backed up regularly (Railway/Render do this automatically)
- [ ] HTTPS is enabled on both frontend and backend URLs
- [ ] Rate limiting is enabled (already configured in app.js)
- [ ] Demo seed passwords changed or accounts deleted in production

---

## PART 8 — QUICK TROUBLESHOOTING

**"Cannot connect to PostgreSQL"**
- Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in .env
- Make sure PostgreSQL service is running: `systemctl status postgresql`

**"JWT secret is not defined"**
- Make sure .env is in the project root and has JWT_ACCESS_SECRET filled in
- Never leave it as the placeholder from .env.example

**"CORS error in browser"**
- Add your frontend's exact origin to CORS_ORIGINS in .env
- Include the protocol: `https://yourdomain.com` not `yourdomain.com`
- Restart the backend after changing .env

**"401 Unauthorized on protected routes"**
- Check the Authorization header: `Bearer <token>` (with space)
- Access tokens expire in 15 minutes — use the refresh endpoint to get a new one
- Make sure api-client.js is handling token refresh automatically

**"404 Not Found on all routes"**
- Make sure the server is running on the correct port
- Check the route prefix — all routes start with `/api/`

**Port 5000 in use**
```bash
lsof -i :5000          # find what's using it
kill -9 <PID>          # kill it
# Or change PORT in .env to 5001
```
