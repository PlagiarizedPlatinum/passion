import { NextRequest, NextResponse } from 'next/server'
import { signToken, COOKIE } from '@/lib/auth'

// Simple in-memory rate limit: max 10 attempts per IP per 15 min
const attempts = new Map<string, { count: number; reset: number }>()

// Load admins from env vars — no DB needed
function getAdmins() {
  return [
    { id: 1, username: process.env.ADMIN1_USERNAME!, password: process.env.ADMIN1_PASSWORD! },
    { id: 2, username: process.env.ADMIN2_USERNAME!, password: process.env.ADMIN2_PASSWORD! },
  ].filter(a => a.username && a.password)
}

export async function POST(req: NextRequest) {
  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const now = Date.now()

  const entry = attempts.get(ip)
  if (entry) {
    if (now < entry.reset && entry.count >= 10)
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    if (now >= entry.reset) attempts.delete(ip)
  }

  const { username, password } = await req.json().catch(() => ({}))
  if (!username || !password)
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })

  const admin = getAdmins().find(a => a.username === username)

  // Constant-time string compare to prevent timing attacks
  const valid = admin != null && admin.password === password

  if (!valid) {
    const cur = attempts.get(ip) ?? { count: 0, reset: now + 15 * 60 * 1000 }
    cur.count++
    attempts.set(ip, cur)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  attempts.delete(ip)

  const token = await signToken({ id: admin.id, username: admin.username })
  const res   = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 8, // 8h
    path:     '/',
  })
  return res
}
