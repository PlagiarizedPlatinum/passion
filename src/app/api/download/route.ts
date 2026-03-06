import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/download — validates key and redirects to download URL
// Does NOT write to key_logs. Logging only happens via /api/validate (program runtime).
export async function POST(req: NextRequest) {
  let key: string
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    key = body.key
  } else {
    const form = await req.formData().catch(() => null)
    key = form?.get('key') as string
  }

  if (!key) return NextResponse.json({ error: 'No key provided' }, { status: 400 })

  const rows = await sql`
    SELECT id, key_hash, status, hwid, uses, max_uses, expires_at
    FROM license_keys
    WHERE key_value = ${key.trim()}
    LIMIT 1
  ` as { id: number; key_hash: string; status: string; hwid: string | null; uses: number; max_uses: number | null; expires_at: string | null }[]

  const k = rows[0]
  if (!k) return NextResponse.json({ error: 'Invalid key' }, { status: 403 })

  const valid = await bcrypt.compare(key.trim(), k.key_hash)
  if (!valid) return NextResponse.json({ error: 'Invalid key' }, { status: 403 })

  if (k.status !== 'active') return NextResponse.json({ error: `Key is ${k.status}` }, { status: 403 })
  if (k.expires_at && new Date(k.expires_at) < new Date()) return NextResponse.json({ error: 'Key expired' }, { status: 403 })
  if (k.max_uses !== null && k.uses >= k.max_uses) return NextResponse.json({ error: 'Use limit reached' }, { status: 403 })

  const setting = await sql`SELECT value FROM app_settings WHERE key = 'download_url' LIMIT 1` as { value: string }[]
  const url = setting[0]?.value
  if (!url) return NextResponse.json({ error: 'No download configured' }, { status: 500 })

  // Update use count — no log entry written
  await sql`UPDATE license_keys SET uses = uses + 1, last_used = NOW() WHERE id = ${k.id}`

  return NextResponse.redirect(url, 302)
}
