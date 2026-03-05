import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT key, value FROM app_settings`
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { key, value } = body

  if (!key || typeof value !== 'string')
    return NextResponse.json({ error: 'key and value required' }, { status: 400 })

  // Whitelist of allowed setting keys
  const allowed = ['download_url']
  if (!allowed.includes(key))
    return NextResponse.json({ error: 'Unknown setting key' }, { status: 400 })

  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()`

  return NextResponse.json({ ok: true })
}
