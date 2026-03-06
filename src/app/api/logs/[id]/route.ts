import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  await sql`DELETE FROM key_logs WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

// POST /api/logs/0 with { action: 'clear_all' }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.action === 'clear_all') {
    await sql`TRUNCATE key_logs`
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
