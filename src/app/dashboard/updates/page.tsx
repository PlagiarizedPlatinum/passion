'use client'
import { useState, useEffect, useRef } from 'react'

type R2File = {
  key: string
  size: number
  lastModified: string
}

type VersionInfo = {
  version: string
  url: string
}

function fmt(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString()
}

export default function UpdatesPage() {
  const [files, setFiles]         = useState<R2File[]>([])
  const [live, setLive]           = useState<VersionInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [pushing, setPushing]     = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  // Upload form
  const [newVersion, setNewVersion] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const [filesRes, versionRes] = await Promise.all([
        fetch('/api/updates/files'),
        fetch('/api/updates/version'),
      ])
      if (filesRes.ok)   setFiles(await filesRes.json())
      if (versionRes.ok) setLive(await versionRes.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000) }
    else         { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  }

  async function handleUpload() {
    if (!selectedFile) return flash('Select a file first.', true)
    if (!newVersion.trim()) return flash('Enter a version number.', true)

    setUploading(true)
    setUploadPct(0)
    setError('')

    try {
      // 1. Get a presigned PUT URL from our API
      const presignRes = await fetch('/api/updates/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedFile.name, contentType: selectedFile.type || 'application/octet-stream' }),
      })
      if (!presignRes.ok) return flash((await presignRes.json()).error || 'Failed to get upload URL.', true)
      const { uploadUrl, publicUrl, key } = await presignRes.json()

      // 2. Upload directly to R2 via presigned URL (with progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', selectedFile.type || 'application/octet-stream')
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadPct(Math.round(e.loaded * 100 / e.total)) }
        xhr.onload  = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(selectedFile)
      })

      flash(`Uploaded ${selectedFile.name} successfully.`)
      setSelectedFile(null)
      setNewVersion('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Upload failed.', true)
    } finally {
      setUploading(false)
      setUploadPct(0)
    }
  }

  async function pushVersion(file: R2File, version?: string) {
    const ver = version || newVersion.trim()
    if (!ver) return flash('Enter a version number before pushing.', true)

    setPushing(file.key)
    try {
      const res = await fetch('/api/updates/version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: ver, key: file.key }),
      })
      if (!res.ok) return flash((await res.json()).error || 'Failed to push version.', true)
      flash(`v${ver} is now live → ${file.key}`)
      load()
    } catch {
      flash('Network error.', true)
    } finally {
      setPushing(null)
    }
  }

  async function deleteFile(key: string) {
    if (!confirm(`Delete "${key}" from R2? This cannot be undone.`)) return
    setDeleting(key)
    try {
      const res = await fetch('/api/updates/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) return flash((await res.json()).error || 'Delete failed.', true)
      flash(`Deleted ${key}`)
      load()
    } catch {
      flash('Network error.', true)
    } finally {
      setDeleting(null)
    }
  }

  const inputSt  = { background: '#2a2024', border: '1px solid #352c2f', color: '#c5c0c2' }
  const inputCls = 'h-[38px] rounded-[7px] px-3 text-[13px] outline-none transition-colors'

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold" style={{ color: '#e5e3e4' }}>Updates</h1>
        <p className="text-[13px] mt-1" style={{ color: '#5d585c' }}>
          Manage client versions hosted on Cloudflare R2
        </p>
      </div>

      {/* Toast */}
      {(error || success) && (
        <div className="mb-5 px-4 py-3 rounded-[9px] text-[13px]"
             style={{
               background: error ? '#dc262518' : '#16a34a18',
               border: `1px solid ${error ? '#dc262544' : '#16a34a44'}`,
               color: error ? '#dc2625' : '#16a34a',
             }}>
          {error || success}
        </div>
      )}

      {/* Live version banner */}
      <div className="mb-6 p-4 rounded-[12px] border flex items-center justify-between"
           style={{ background: '#1a1218', borderColor: '#352f31' }}>
        <div>
          <p className="text-[11px] uppercase tracking-widest mb-1" style={{ color: '#5d585c' }}>Currently Live</p>
          {live ? (
            <div>
              <span className="text-[20px] font-bold mr-3" style={{ color: '#e5e3e4' }}>v{live.version}</span>
              <code className="text-[12px]" style={{ color: '#5d585c' }}>{live.url}</code>
            </div>
          ) : (
            <p className="text-[14px]" style={{ color: '#5d585c' }}>No version set yet</p>
          )}
        </div>
      </div>

      {/* Upload new file */}
      <div className="mb-8 p-6 rounded-[14px] border" style={{ background: '#191216', borderColor: '#352f31' }}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: '#e5e3e4' }}>Upload New Release</h2>

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: '#5d585c' }}>Version Number</label>
            <input
              value={newVersion}
              onChange={e => setNewVersion(e.target.value)}
              placeholder="e.g. 1.0.1"
              className={inputCls + ' w-full'}
              style={inputSt}
              onFocus={e => { e.target.style.borderColor = '#5a4f52' }}
              onBlur={e  => { e.target.style.borderColor = '#352c2f' }}
            />
          </div>
          <div className="flex-[2]">
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: '#5d585c' }}>File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".py,.exe,.zip"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              className="h-[38px] w-full rounded-[7px] px-3 text-[13px] outline-none cursor-pointer"
              style={{ ...inputSt, paddingTop: '7px' }}
            />
          </div>
        </div>

        {selectedFile && (
          <p className="text-[12px] mb-3" style={{ color: '#868283' }}>
            {selectedFile.name} · {fmt(selectedFile.size)}
          </p>
        )}

        {uploading && (
          <div className="mb-3">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2024' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: '#dc2625' }} />
            </div>
            <p className="text-[11px] mt-1" style={{ color: '#5d585c' }}>{uploadPct}% uploaded</p>
          </div>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="h-[38px] px-5 rounded-[8px] text-[13px] font-semibold text-white disabled:opacity-40 transition-colors"
            style={{ background: '#dc2625', boxShadow: '0 0 14px rgba(220,38,37,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e42d2c')}
            onMouseLeave={e => (e.currentTarget.style.background = '#dc2625')}
          >
            {uploading ? `Uploading… ${uploadPct}%` : 'Upload to R2'}
          </button>
          <p className="text-[12px] self-center" style={{ color: '#3a3537' }}>
            Upload first, then push live below
          </p>
        </div>
      </div>

      {/* Files on R2 */}
      <h2 className="text-[12px] uppercase tracking-widest mb-3" style={{ color: '#5d585c' }}>Files on R2</h2>
      <div className="rounded-[12px] overflow-hidden border" style={{ borderColor: '#352f31' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: '#1a1218', borderBottom: '1px solid #352f31' }}>
              {['Filename', 'Size', 'Uploaded', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-widest text-[11px]"
                    style={{ color: '#5d585c' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: '#5d585c' }}>Loading…</td></tr>
            )}
            {!loading && files.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: '#5d585c' }}>No files in bucket</td></tr>
            )}
            {files.map((f, i) => {
              const isLive = live?.url.endsWith(f.key)
              return (
                <tr key={f.key} style={{ background: i % 2 === 0 ? '#1c1318' : '#1a1216', borderBottom: '1px solid #2a2226' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-[12px]" style={{ color: '#c5c0c2' }}>{f.key}</code>
                      {isLive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                              style={{ background: '#16a34a18', color: '#16a34a', border: '1px solid #16a34a33' }}>
                          LIVE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#868283' }}>{fmt(f.size)}</td>
                  <td className="px-4 py-3" style={{ color: '#868283' }}>{fmtDate(f.lastModified)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      {/* Push live — only for .py and .exe */}
                      {(f.key.endsWith('.py') || f.key.endsWith('.exe')) && (
                        <div className="flex items-center gap-1.5">
                          <input
                            placeholder="version"
                            className="h-[28px] w-[80px] rounded-[5px] px-2 text-[11px] outline-none"
                            style={inputSt}
                            defaultValue={newVersion}
                            id={`ver-${f.key}`}
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`ver-${f.key}`) as HTMLInputElement
                              pushVersion(f, input?.value)
                            }}
                            disabled={pushing === f.key}
                            className="h-[28px] px-3 rounded-[5px] text-[11px] font-semibold disabled:opacity-40"
                            style={{ background: '#dc262520', color: '#dc2625', border: '1px solid #dc262540' }}
                          >
                            {pushing === f.key ? '…' : 'Push Live'}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => deleteFile(f.key)}
                        disabled={deleting === f.key}
                        className="h-[28px] px-2.5 rounded-[5px] text-[11px] disabled:opacity-40"
                        style={{ color: '#5d585c', background: '#2a2024' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#dc2625'; e.currentTarget.style.background = '#dc262518' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#5d585c'; e.currentTarget.style.background = '#2a2024' }}
                      >
                        {deleting === f.key ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}