import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q      = searchParams.get('q')
  const status = searchParams.get('status')

  let rows
  if (q && status) {
    rows = await sql`SELECT * FROM license_keys WHERE status=${status} AND (key_value ILIKE ${'%'+q+'%'} OR label ILIKE ${'%'+q+'%'}) ORDER BY created_at DESC`
  } else if (q) {
    rows = await sql`SELECT * FROM license_keys WHERE key_value ILIKE ${'%'+q+'%'} OR label ILIKE ${'%'+q+'%'} ORDER BY created_at DESC`
  } else if (status) {
    rows = await sql`SELECT * FROM license_keys WHERE status=${status} ORDER BY created_at DESC`
  } else {
    rows = await sql`SELECT * FROM license_keys ORDER BY created_at DESC`
  }

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { label, max_uses, expires_at } = body

  // Generate a key in format PASS-XXXX-XXXX-XXXX-XXXX
  const segments = Array.from({ length: 4 }, () =>
    crypto.randomBytes(2).toString('hex').toUpperCase()
  )
  const key_value = 'PASS-' + segments.join('-')
  const key_hash  = await bcrypt.hash(key_value, 10)

  const rows = await sql`
    INSERT INTO license_keys (key_value, key_hash, label, max_uses, expires_at)
    VALUES (${key_value}, ${key_hash}, ${label ?? null}, ${max_uses ?? null}, ${expires_at ?? null})
    RETURNING *
  ` as Record<string, unknown>[]

  return NextResponse.json(rows[0], { status: 201 })
}
