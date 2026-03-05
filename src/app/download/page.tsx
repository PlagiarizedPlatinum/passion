'use client'
import { useState, FormEvent } from 'react'

export default function DownloadPage() {
  const [key, setKey]       = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoad]  = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoad(true)
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
        redirect: 'manual', // we handle redirect manually
      })

      if (res.type === 'opaqueredirect' || res.status === 302 || res.ok) {
        // Trigger the download by following the redirect in a new tab
        setSuccess(true)
        // Re-submit as a form to trigger browser download
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = '/api/download'
        const input = document.createElement('input')
        input.type  = 'hidden'
        input.name  = 'key'
        input.value = key.trim()
        form.appendChild(input)
        document.body.appendChild(form)
        form.submit()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Validation failed.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoad(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: '#0f0b0c' }}
    >
      {/* Faint glow behind card */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(220,38,37,0.06) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Card */}
      <div
        className="relative w-[380px] rounded-[17px] px-9 py-10"
        style={{
          background: 'linear-gradient(180deg, #21161a 0%, #161014 100%)',
          border: '1px solid #352f31',
          boxShadow: '0 0 0 1px rgba(180,28,28,0.12), 0 20px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute inset-0 rounded-[17px] pointer-events-none"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
        />

        {/* Logo / title */}
        <div className="text-center mb-8">
          <h1
            className="text-[28px] font-bold tracking-tight"
            style={{
              color: '#e5e3e4',
              textShadow: '0 0 20px rgba(220,38,37,0.4)',
            }}
          >
            Passion
          </h1>
          <p className="text-[13px] mt-1.5" style={{ color: '#5d585c' }}>
            Enter your license key to download
          </p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <p className="text-[14px] font-semibold mb-1" style={{ color: '#16a34a' }}>
              ✓ Key validated
            </p>
            <p className="text-[12px]" style={{ color: '#5d585c' }}>
              Your download is starting…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-0">
            <label className="text-[12px] font-medium mb-1.5" style={{ color: '#888485' }}>
              License Key
            </label>
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="PASS-XXXX-XXXX-XXXX-XXXX"
              spellCheck={false}
              autoComplete="off"
              required
              className="h-[43px] rounded-[8px] px-3 text-[13px] font-mono outline-none mb-4 w-full transition-colors"
              style={{
                background: '#2a2024',
                border: '1px solid #352c2f',
                color: '#c5c0c2',
                letterSpacing: '0.5px',
              }}
              onFocus={e => { e.target.style.borderColor = '#5a4f52'; e.target.style.background = '#2e2428' }}
              onBlur={e  => { e.target.style.borderColor = '#352c2f'; e.target.style.background = '#2a2024' }}
            />

            {error && (
              <p className="text-[12px] text-center mb-3" style={{ color: '#dc2625' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-[43px] rounded-[8px] font-bold text-[14px] text-white w-full transition-all disabled:opacity-50"
              style={{
                background: '#dc2625',
                boxShadow: '0 0 20px rgba(220,38,37,0.4), 0 0 6px rgba(220,38,37,0.2)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e83433')}
              onMouseLeave={e => (e.currentTarget.style.background = '#dc2625')}
            >
              {loading ? 'Validating…' : 'Download'}
            </button>
          </form>
        )}

        {/* Admin link — subtle, at the bottom */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-[11px] transition-colors"
            style={{ color: '#3a3537' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#5d585c')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3537')}
          >
            Admin
          </a>
        </div>
      </div>
    </div>
  )
}
