import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await sql`
    SELECT l.id, l.key_value, l.hwid, l.ip, l.success, l.reason, l.created_at,
           k.label
    FROM key_logs l
    LEFT JOIN license_keys k ON k.id = l.key_id
    ORDER BY l.created_at DESC
    LIMIT 500`

  return NextResponse.json(logs)
}
