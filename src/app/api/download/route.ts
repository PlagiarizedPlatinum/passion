import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Rate limit: 5 attempts per IP per 10 min
const attempts = new Map<string, { count: number; reset: number }>()

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const now = Date.now()

  const entry = attempts.get(ip)
  if (entry) {
    if (now < entry.reset && entry.count >= 5)
      return NextResponse.json({ error: 'Too many attempts. Try again in 10 minutes.' }, { status: 429 })
    if (now >= entry.reset) attempts.delete(ip)
  }

  let body: { key?: string }
  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      body = await req.json()
    } else {
      const form = await req.formData()
      body = { key: form.get('key')?.toString() }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { key } = body
  if (!key?.trim())
    return NextResponse.json({ error: 'Please enter your license key.' }, { status: 400 })

  // Fetch active keys and bcrypt compare
  const rows = await sql`
    SELECT id, key_hash, status, expires_at, max_uses, uses
    FROM license_keys WHERE status = 'active'`

  let match: typeof rows[0] | null = null
  for (const row of rows) {
    if (await bcrypt.compare(key.trim(), row.key_hash)) { match = row; break }
  }

  if (!match) {
    const cur = attempts.get(ip) ?? { count: 0, reset: now + 10 * 60 * 1000 }
    cur.count++
    attempts.set(ip, cur)
    return NextResponse.json({ error: 'Invalid license key.' }, { status: 401 })
  }

  // Expiry check
  if (match.expires_at && new Date(match.expires_at) < new Date())
    return NextResponse.json({ error: 'This key has expired.' }, { status: 403 })

  attempts.delete(ip)

  // Log the download
  await sql`
    INSERT INTO key_logs (key_id, key_value, hwid, ip, success, reason)
    VALUES (${match.id}, ${key.trim()}, NULL, ${ip}, true, 'download')`

  // Generate a presigned URL — expires in 60 seconds
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key:    process.env.R2_FILE_KEY!,
  })

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 60 })

  return NextResponse.redirect(presignedUrl, { status: 302 })
}