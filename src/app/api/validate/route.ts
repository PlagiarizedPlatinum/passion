import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/validate — called by the program at runtime
// This IS the endpoint that writes to key_logs.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? 'unknown'

  try {
    const { key, hwid } = await req.json()
    if (!key) return NextResponse.json({ error: 'No key provided' }, { status: 400 })

    const rows = await sql`
      SELECT id, key_hash, status, hwid, uses, max_uses, expires_at
      FROM license_keys
      WHERE key_value = ${key.trim()}
      LIMIT 1
    ` as { id: number; key_hash: string; status: string; hwid: string | null; uses: number; max_uses: number | null; expires_at: string | null }[]

    const k = rows[0]

    async function log(success: boolean, reason: string) {
      await sql`
        INSERT INTO key_logs (key_id, key_value, hwid, ip, success, reason)
        VALUES (${k?.id ?? null}, ${key.trim()}, ${hwid ?? null}, ${ip}, ${success}, ${reason})
      `
    }

    if (!k) { await log(false, 'Key not found'); return NextResponse.json({ valid: false, reason: 'Invalid key' }, { status: 403 }) }

    const valid = await bcrypt.compare(key.trim(), k.key_hash)
    if (!valid) { await log(false, 'Hash mismatch'); return NextResponse.json({ valid: false, reason: 'Invalid key' }, { status: 403 }) }

    if (k.status !== 'active') { await log(false, `Key ${k.status}`); return NextResponse.json({ valid: false, reason: `Key is ${k.status}` }, { status: 403 }) }
    if (k.expires_at && new Date(k.expires_at) < new Date()) { await log(false, 'Expired'); return NextResponse.json({ valid: false, reason: 'Key expired' }, { status: 403 }) }
    if (k.max_uses !== null && k.uses >= k.max_uses) { await log(false, 'Use limit reached'); return NextResponse.json({ valid: false, reason: 'Use limit reached' }, { status: 403 }) }

    // HWID binding
    if (hwid) {
      if (!k.hwid) {
        await sql`UPDATE license_keys SET hwid = ${hwid}, uses = uses + 1, last_used = NOW() WHERE id = ${k.id}`
      } else if (k.hwid !== hwid) {
        await log(false, 'HWID mismatch')
        return NextResponse.json({ valid: false, reason: 'Key is bound to another device' }, { status: 403 })
      } else {
        await sql`UPDATE license_keys SET uses = uses + 1, last_used = NOW() WHERE id = ${k.id}`
      }
    }

    await log(true, 'OK')
    return NextResponse.json({ valid: true })
  } catch (err) {
    console.error('Validate error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
