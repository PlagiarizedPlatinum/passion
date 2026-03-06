import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const PUBLIC_BASE = `https://pub-d4b4f094e6fc4a0fb671a4816dabda7e.r2.dev`

// POST /api/updates/presign — get a presigned PUT URL for direct browser → R2 upload
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename, contentType } = await req.json().catch(() => ({}))
  if (!filename)
    return NextResponse.json({ error: 'filename required' }, { status: 400 })

  // Only allow safe file types
  const allowed = ['.py', '.exe', '.zip']
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (!allowed.includes(ext))
    return NextResponse.json({ error: 'Only .py, .exe, .zip files allowed' }, { status: 400 })

  const key = filename  // store at root of bucket

  const cmd = new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME!,
    Key:         key,
    ContentType: contentType || 'application/octet-stream',
  })

  // Presigned URL valid for 10 minutes
  const uploadUrl = await getSignedUrl(r2, cmd, { expiresIn: 600 })

  return NextResponse.json({
    uploadUrl,
    publicUrl: `${PUBLIC_BASE}/${key}`,
    key,
  })
}