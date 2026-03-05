import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'

// Rate limit: 5 attempts per IP per 10 min
const attempts = new Map<string, { count: number; reset: number }>()

export async function POST(req: NextRequest) {
  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const now = Date.now()

  const entry = attempts.get(ip)
  if (entry) {
    if (now < entry.reset && entry.count >= 5)
      return NextResponse.json({ error: 'Too many attempts. Try again in 10 minutes.' }, { status: 429 })
    if (now >= entry.reset) attempts.delete(ip)
  }

  let body: { key?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { key } = body
  if (!key?.trim())
    return NextResponse.json({ error: 'Please enter your license key.' }, { status: 400 })

  // Fetch active keys and bcrypt compare
  const rows = await sql`
    SELECT id, key_hash, status, expires_at, max_uses, uses
    FROM license_keys WHERE status = 'active'`

  let match: typeof rows[0] | null = null
  for (const row of rows) {
    if (await bcrypt.compare(key.trim(), row.key_hash)) { match = row; break }
  }

  if (!match) {
    const cur = attempts.get(ip) ?? { count: 0, reset: now + 10 * 60 * 1000 }
    cur.count++
    attempts.set(ip, cur)
    return NextResponse.json({ error: 'Invalid license key.' }, { status: 401 })
  }

  // Expiry check
  if (match.expires_at && new Date(match.expires_at) < new Date())
    return NextResponse.json({ error: 'This key has expired.' }, { status: 403 })

  // Max uses check (don't count downloads against uses — just validate)
  attempts.delete(ip)

  // Fetch the download URL from DB — never sent to client directly, we redirect server-side
  const setting = await sql`SELECT value FROM app_settings WHERE key = 'download_url' LIMIT 1`
  const downloadUrl = setting[0]?.value

  if (!downloadUrl || downloadUrl.includes('YOUR_USERNAME'))
    return NextResponse.json({ error: 'Download not configured yet. Contact admin.' }, { status: 503 })

  // Log the download
  await sql`
    INSERT INTO key_logs (key_id, key_value, hwid, ip, success, reason)
    VALUES (${match.id}, ${key.trim()}, NULL, ${ip}, true, 'download')`

  // Return a server-side redirect — the real URL is never in the JS bundle or response body
  return NextResponse.redirect(downloadUrl, { status: 302 })
}
