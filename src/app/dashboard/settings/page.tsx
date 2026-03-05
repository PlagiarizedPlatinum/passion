'use client'
import { useState, useEffect } from 'react'

export default function DashboardSettingsPage() {
  const [downloadUrl, setDownloadUrl] = useState('')
  const [saved, setSaved]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        setDownloadUrl(d.download_url ?? '')
      })
      .catch(err => {
        console.error('Failed to load settings:', err)
      })
      .finally(() => {
        setLoad(false)
      })
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'download_url', value: downloadUrl }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const inputSt = {
    background: '#2a2024',
    border: '1px solid #352c2f',
    color: '#c5c0c2',
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[22px] font-bold mb-1" style={{ color: '#e5e3e4' }}>Site Settings</h1>
      <p className="text-[13px] mb-8" style={{ color: '#5d585c' }}>Configure download URL and other options</p>

      {/* Download URL */}
      <div className="rounded-[12px] p-6 border mb-4" style={{ background: '#1c1318', borderColor: '#352f31' }}>
        <h2 className="text-[14px] font-semibold mb-1" style={{ color: '#e5e3e4' }}>Download URL</h2>
        <p className="text-[12px] mb-4" style={{ color: '#5d585c' }}>
          The GitHub release URL users are redirected to when they validate a key on the download page.
          This URL is stored in the database and never exposed to the client — users cannot bypass it.
        </p>

        <label className="text-[12px] font-medium mb-1.5 block" style={{ color: '#888485' }}>
          GitHub Release URL
        </label>
        <input
          type="url"
          value={loading ? 'Loading…' : downloadUrl}
          onChange={e => setDownloadUrl(e.target.value)}
          disabled={loading}
          placeholder="https://github.com/user/repo/releases/download/v1.0/passion.exe"
          className="w-full h-[42px] rounded-[8px] px-3 text-[13px] outline-none mb-4 font-mono"
          style={inputSt}
          onFocus={e => { e.target.style.borderColor = '#5a4f52' }}
          onBlur={e  => { e.target.style.borderColor = '#352c2f' }}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || loading}
            className="h-[38px] px-5 rounded-[8px] text-[13px] font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: '#dc2625', boxShadow: '0 0 14px rgba(220,38,37,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e83433')}
            onMouseLeave={e => (e.currentTarget.style.background = '#dc2625')}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-[12px]" style={{ color: '#16a34a' }}>✓ Saved</span>}
        </div>
      </div>

      <div className="rounded-[12px] p-4 border" style={{ background: '#161014', borderColor: '#2a2226' }}>
        <p className="text-[11px]" style={{ color: '#3a3537' }}>
          💡 How it works: When a user enters their key on <code className="text-[11px]" style={{ color: '#5d585c' }}>/download</code>,
          the server validates the key against the database, then issues a server-side redirect to this URL.
          The URL is never sent to the browser — only the final file download triggers.
        </p>
      </div>
    </div>
  )
}