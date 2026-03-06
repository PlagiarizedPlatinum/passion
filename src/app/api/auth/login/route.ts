import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })

    const ok = await login(String(username), String(password))
    if (!ok) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
