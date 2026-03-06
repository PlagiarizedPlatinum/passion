'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid credentials'); return }
      router.push('/dashboard')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, #2f262b22 0%, #0f0b0c 70%)' }}>
      <div className="w-full max-w-[358px] rounded-[17px] p-[34px] relative"
           style={{
             background: 'linear-gradient(180deg,#21161a 0%,#161014 100%)',
             border: '1px solid #352f31',
             boxShadow: '0 12px 55px rgba(0,0,0,0.82)',
           }}>
        <div className="absolute inset-0 rounded-[17px] pointer-events-none"
             style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }} />

        <h1 className="text-center text-[26px] font-bold tracking-tight mb-2" style={{ color: '#e5e3e4' }}>Passion</h1>
        <p className="text-center text-[13px] mb-6" style={{ color: '#868283' }}>Admin sign in</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-0">
          <label className="text-[13px] font-medium mb-[7px]" style={{ color: '#888485' }}>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            autoComplete="username" required
            className="h-[43px] rounded-[8px] px-[11px] text-[14px] outline-none mb-4 transition-colors w-full"
            style={{ background: '#2a2024', border: '1px solid #352c2f', color: '#c5c0c2' }}
            onFocus={e => { e.target.style.borderColor = '#4e4447'; e.target.style.background = '#2e2428' }}
            onBlur={e  => { e.target.style.borderColor = '#352c2f'; e.target.style.background = '#2a2024' }} />

          <label className="text-[13px] font-medium mb-[7px]" style={{ color: '#888485' }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" required
            className="h-[43px] rounded-[8px] px-[11px] text-[14px] outline-none mb-5 transition-colors w-full"
            style={{ background: '#2a2024', border: '1px solid #352c2f', color: '#c5c0c2' }}
            onFocus={e => { e.target.style.borderColor = '#4e4447'; e.target.style.background = '#2e2428' }}
            onBlur={e  => { e.target.style.borderColor = '#352c2f'; e.target.style.background = '#2a2024' }} />

          {error && <p className="text-[12px] text-center mb-3" style={{ color: '#dc2625' }}>{error}</p>}

          <button type="submit" disabled={loading}
            className="h-[43px] rounded-[8px] font-bold text-[14px] text-white transition-all disabled:opacity-60"
            style={{ background: '#dc2625', boxShadow: '0 0 18px rgba(220,38,37,0.45), 0 0 6px rgba(220,38,37,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e42d2c')}
            onMouseLeave={e => (e.currentTarget.style.background = '#dc2625')}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
