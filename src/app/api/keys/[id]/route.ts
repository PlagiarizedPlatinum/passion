import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import sql from '@/lib/db'

function authGuard() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// PATCH /api/keys/[id] — update status, label, reset hwid
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return authGuard()

  const id   = Number(params.id)
  const body = await req.json().catch(() => ({}))

  const rows = await sql`
    UPDATE license_keys SET
      status     = COALESCE(${body.status ?? null}, status),
      label      = COALESCE(${body.label  ?? null}, label),
      hwid       = CASE WHEN ${body.reset_hwid ?? false} THEN NULL ELSE hwid END,
      expires_at = COALESCE(${body.expires_at ? new Date(body.expires_at) : null}, expires_at)
    WHERE id = ${id}
    RETURNING id, key_value, label, status, hwid, uses, max_uses, expires_at, created_at, last_used`

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

// DELETE /api/keys/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return authGuard()

  const id = Number(params.id)
  await sql`DELETE FROM license_keys WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
