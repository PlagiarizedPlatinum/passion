import { NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function GET() {
  try {
    // Read version.json straight from your R2 bucket
    const cmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key:    'version.json',
    })
    const obj  = await r2.send(cmd)
    const body = await obj.Body!.transformToString()
    const data = JSON.parse(body) as { version: string; url: string }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Could not fetch version' }, { status: 500 })
  }
}