# Passion — Setup Guide

## Architecture

```
passion_client.exe   ← PyQt5 app (distribute to users)
passion-web/        ← Next.js dashboard (deploy to Vercel)
schema.sql          ← Run once in Neon SQL editor
```

---

## 1. Neon Database Setup

1. Create a free project at **neon.tech**
2. Open the **SQL Editor** in the Neon dashboard
3. Paste and run the contents of `schema.sql`
4. Copy your connection string (looks like `postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

### Create your 2 admin users

Run this in the Neon SQL editor — replace the hashes with real bcrypt hashes:

```sql
-- Generate hashes with Node.js:
-- node -e "const b=require('bcryptjs'); console.log(b.hashSync('YourPassword123', 12))"

INSERT INTO admins (username, password) VALUES
  ('admin1', '$2a$12$YOUR_HASH_HERE'),
  ('admin2', '$2a$12$YOUR_HASH_HERE');
```

Or use the online tool at https://bcrypt-generator.com (set rounds to 12).

---

## 2. Deploy to Vercel

1. Push the `passion-web/` folder to a GitHub repo
2. Import the repo at **vercel.com/new**
3. Add these environment variables in Vercel project settings:

| Variable       | Value                                          |
|----------------|------------------------------------------------|
| `DATABASE_URL` | Your Neon connection string (with `?sslmode=require`) |
| `JWT_SECRET`   | A random 32+ character string (generate at random.org) |

4. Deploy — Vercel will give you a URL like `https://passion-xyz.vercel.app`

---

## 3. Configure the PyQt Client

Open `passion_client.py` and change line 22:

```python
API_BASE = "https://your-passion-app.vercel.app"  # ← paste your Vercel URL
```

### Dependencies for the client:
```bash
pip install PyQt5 requests
```

### Run:
```bash
python passion_client.py
```

---

## 4. How it works

### For users (key auth):
1. User opens `passion_client.py`
2. Enters their license key (format: `PASS-XXXX-XXXX-XXXX-XXXX`)
3. App calls `POST /api/keys/validate` with the key + machine HWID
4. On success → your main app launches

### For admins (dashboard):
1. Go to `https://your-passion-app.vercel.app`
2. Login with one of your 2 admin credentials
3. Manage keys: create, delete, disable, reset HWID, search, filter
4. View validation logs with IP, HWID, success/failure

### For admins (PyQt):
- Click "Login" at the bottom of the key auth screen
- Enter admin username + password (same credentials as the website)
- Calls `/api/auth/login` and confirms credentials

---

## 5. Key Features

- **HWID locking** — key binds to the first device that uses it
- **Max uses** — optionally limit how many times a key can be used
- **Expiry dates** — keys auto-expire on a set date
- **Rate limiting** — login brute force protection (10 attempts / 15 min)
- **BCrypt** — passwords and keys hashed with bcrypt (rounds=12/10)
- **JWT sessions** — 8-hour httpOnly cookie sessions, HS256 signed
- **Validation logs** — every key check logged with IP, HWID, result

---

## Security Notes

- Never commit `.env.local` to git (it's in `.gitignore`)
- Use a strong, random `JWT_SECRET` (32+ chars)
- The Neon connection string contains your DB password — keep it secret
- Admin passwords should be strong — they're bcrypt hashed in the DB
- The `/api/keys/validate` endpoint is public (needed by the client app)
  — it's protected by bcrypt comparison and rate limiting
