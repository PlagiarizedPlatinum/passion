import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [keys, logs] = await Promise.all([
    sql`SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE status='active')          AS active,
          COUNT(*) FILTER (WHERE status='disabled')        AS disabled,
          COUNT(*) FILTER (WHERE status='expired')         AS expired,
          COUNT(*) FILTER (WHERE hwid IS NOT NULL)         AS hwid_bound,
          COUNT(*) FILTER (WHERE created_at > NOW()-'24h'::interval) AS new_today
        FROM license_keys`,
    sql`SELECT
          COUNT(*)                                       AS total,
          COUNT(*) FILTER (WHERE success=true)           AS success,
          COUNT(*) FILTER (WHERE success=false)          AS failed,
          COUNT(*) FILTER (WHERE created_at > NOW()-'24h'::interval) AS today
        FROM key_logs`,
  ])

  return NextResponse.json({ keys: keys[0], logs: logs[0] })
}
