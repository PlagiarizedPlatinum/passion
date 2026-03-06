import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// GET /api/updates/files — list all files in bucket
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cmd = new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME! })
  const res = await r2.send(cmd)

  const files = (res.Contents ?? [])
    .filter(f => f.Key !== 'version.json') // hide version.json from the list
    .map(f => ({
      key:          f.Key,
      size:         f.Size ?? 0,
      lastModified: f.LastModified?.toISOString() ?? '',
    }))

  return NextResponse.json(files)
}

// DELETE /api/updates/files — delete a file from bucket
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key } = await req.json().catch(() => ({}))
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  // Prevent deleting version.json
  if (key === 'version.json')
    return NextResponse.json({ error: 'Cannot delete version.json directly' }, { status: 400 })

  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key:    key,
  }))

  return NextResponse.json({ ok: true })
}