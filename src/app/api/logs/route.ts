import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  const rows = await sql`
    SELECT l.*, k.label
    FROM key_logs l
    LEFT JOIN license_keys k ON k.id = l.key_id
    ORDER BY l.created_at DESC
    LIMIT 500
  `
  return NextResponse.json(rows)
}
