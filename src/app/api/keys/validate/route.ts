import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'

// POST /api/keys/validate — called by PyQt app
// Body: { key: string, hwid: string }
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'

  let body: { key?: string; hwid?: string }
  try { body = await req.json() } catch { return NextResponse.json({ valid: false, reason: 'bad_request' }, { status: 400 }) }

  const { key, hwid } = body
  if (!key || !hwid) return NextResponse.json({ valid: false, reason: 'missing_fields' }, { status: 400 })

  // Fetch all active keys and find match (bcrypt compare)
  // For production with many keys, store prefix index — fine for small-medium scale
  const rows = await sql`
    SELECT id, key_value, key_hash, status, hwid as bound_hwid, uses, max_uses, expires_at
    FROM license_keys WHERE status = 'active'`

  let match: typeof rows[0] | null = null
  for (const row of rows) {
    if (await bcrypt.compare(key, row.key_hash)) { match = row; break }
  }

  async function log(keyId: number | null, success: boolean, reason: string) {
    await sql`INSERT INTO key_logs (key_id, key_value, hwid, ip, success, reason)
              VALUES (${keyId}, ${key!}, ${hwid!}, ${ip}, ${success}, ${reason})`
  }

  if (!match) { await log(null, false, 'invalid_key'); return NextResponse.json({ valid: false, reason: 'invalid_key' }) }

  // Expiry check
  if (match.expires_at && new Date(match.expires_at) < new Date()) {
    await sql`UPDATE license_keys SET status='expired' WHERE id=${match.id}`
    await log(match.id, false, 'expired')
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  // Max uses check
  if (match.max_uses !== null && match.uses >= match.max_uses) {
    await log(match.id, false, 'max_uses_reached')
    return NextResponse.json({ valid: false, reason: 'max_uses_reached' })
  }

  // HWID lock: if already bound to a different HWID
  if (match.bound_hwid && match.bound_hwid !== hwid) {
    await log(match.id, false, 'hwid_mismatch')
    return NextResponse.json({ valid: false, reason: 'hwid_mismatch' })
  }

  // All good — bind HWID on first use, increment uses
  await sql`
    UPDATE license_keys SET
      hwid      = ${hwid},
      uses      = uses + 1,
      last_used = NOW()
    WHERE id = ${match.id}`

  await log(match.id, true, 'ok')
  return NextResponse.json({ valid: true })
}
