import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const PUBLIC_BASE = `https://pub-d4b4f094e6fc4a0fb671a4816dabda7e.r2.dev`

// GET /api/updates/version — read current version.json from R2
export async function GET() {
  try {
    const cmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key:    'version.json',
    })
    const obj  = await r2.send(cmd)
    const body = await obj.Body!.transformToString()
    return NextResponse.json(JSON.parse(body), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    // version.json doesn't exist yet
    return NextResponse.json(null)
  }
}

// POST /api/updates/version — write new version.json to R2
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { version, key } = await req.json().catch(() => ({}))
  if (!version || !key)
    return NextResponse.json({ error: 'version and key required' }, { status: 400 })

  const payload = JSON.stringify({
    version,
    url: `${PUBLIC_BASE}/${key}`,
  })

  await r2.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         'version.json',
    Body:        payload,
    ContentType: 'application/json',
  }))

  return NextResponse.json({ ok: true })
}