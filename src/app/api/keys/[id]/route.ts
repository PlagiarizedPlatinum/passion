import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id   = Number(params.id)
  const body = await req.json().catch(() => ({}))

  if (body.reset_hwid) {
    await sql`UPDATE license_keys SET hwid = NULL WHERE id = ${id}`
  } else if (body.status) {
    await sql`UPDATE license_keys SET status = ${body.status} WHERE id = ${id}`
  }

  const rows = await sql`SELECT * FROM license_keys WHERE id = ${id}` as Record<string, unknown>[]
  return NextResponse.json(rows[0])
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  await sql`DELETE FROM license_keys WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
