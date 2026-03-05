'use client'
import { useState, useEffect, useCallback } from 'react'

type Log = {
  id: number
  key_value: string
  hwid: string | null
  ip: string
  success: boolean
  reason: string
  created_at: string
  label: string | null
}

export default function LogsPage() {
  const [logs, setLogs]         = useState<Log[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | 'ok' | 'fail'>('all')
  const [search, setSearch]     = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [lastRefresh, setLast]  = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/logs')
      if (r.ok) { setLogs(await r.json()); setLast(new Date()) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  async function deleteLog(id: number) {
    setDeleting(id)
    await fetch(`/api/logs/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
    setDeleting(null)
  }

  async function clearAll() {
    if (!confirm('Delete all logs permanently?')) return
    setClearing(true)
    await fetch('/api/logs/0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_all' }),
    })
    setLogs([])
    setClearing(false)
  }

  const visible = logs.filter(l => {
    if (filter === 'ok'   && !l.success) return false
    if (filter === 'fail' &&  l.success) return false
    if (search) {
      const q = search.toLowerCase()
      return [l.key_value, l.ip, l.reason, l.label, l.hwid]
        .some(v => v?.toLowerCase().includes(q))
    }
    return true
  })

  const inputSt = { background: '#2a2024', border: '1px solid #352c2f', color: '#c5c0c2' }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: '#e5e3e4' }}>Validation Logs</h1>
          <p className="text-[12px] mt-0.5" style={{ color: '#5d585c' }}>
            {visible.length} entries
            {lastRefresh && <span className="ml-2" style={{ color: '#3a3537' }}>· {lastRefresh.toLocaleTimeString()}</span>}
            <span className="ml-2 text-[11px]" style={{ color: '#3a3537' }}>auto-refreshing every 5s</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="h-[34px] px-3 rounded-[7px] text-[12px]"
            style={{ background: '#2a2024', color: '#868283', border: '1px solid #352c2f' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e5e3e4')}
            onMouseLeave={e => (e.currentTarget.style.color = '#868283')}>
            ↺ Refresh
          </button>
          <button onClick={clearAll} disabled={clearing}
            className="h-[34px] px-3 rounded-[7px] text-[12px] disabled:opacity-50"
            style={{ background: '#dc262514', color: '#dc2625', border: '1px solid #dc262530' }}>
            {clearing ? 'Clearing…' : 'Clear All'}
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input placeholder="Search key, IP, reason, HWID…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-[36px] rounded-[7px] px-3 text-[12px] outline-none flex-1 max-w-xs"
          style={inputSt} />
        {(['all','ok','fail'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="h-[36px] px-4 rounded-[7px] text-[12px] font-medium"
            style={{
              background: filter === f ? (f==='ok' ? '#16a34a22' : f==='fail' ? '#dc262522' : '#2a2426') : '#1a1216',
              color:      filter === f ? (f==='ok' ? '#16a34a'   : f==='fail' ? '#dc2625'   : '#e5e3e4') : '#5d585c',
              border:     `1px solid ${filter === f ? (f==='ok' ? '#16a34a44' : f==='fail' ? '#dc262544' : '#3a3537') : '#252022'}`,
            }}>
            {f === 'all' ? 'All' : f === 'ok' ? '✓ Success' : '✕ Failed'}
          </button>
        ))}
      </div>

      <div className="rounded-[12px] overflow-hidden border" style={{ borderColor: '#352f31' }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: '#1a1218', borderBottom: '1px solid #352f31' }}>
              {['Time','Key','Label','HWID','IP','Result','Reason',''].map((h,i) => (
                <th key={i} className="px-3 py-3 text-left font-semibold uppercase tracking-widest text-[10px]"
                  style={{ color: '#5d585c' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="py-10 text-center" style={{ color: '#5d585c' }}>Loading…</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={8} className="py-10 text-center" style={{ color: '#5d585c' }}>No logs</td></tr>}
            {visible.map((l, i) => (
              <tr key={l.id} style={{
                background: i % 2 === 0 ? '#1c1318' : '#1a1216',
                borderBottom: '1px solid #221a1c',
                opacity: deleting === l.id ? 0.3 : 1,
                transition: 'opacity 0.15s',
              }}>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: '#4a4648' }}>
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2.5">
                  <code className="text-[11px] font-mono" style={{ color: '#7a7578' }}>{l.key_value?.slice(0,13)}…</code>
                </td>
                <td className="px-3 py-2.5" style={{ color: '#7a7578' }}>{l.label || '—'}</td>
                <td className="px-3 py-2.5">
                  <code className="text-[11px] font-mono" style={{ color: '#7a7578' }}>{l.hwid ? l.hwid.slice(0,10)+'…' : '—'}</code>
                </td>
                <td className="px-3 py-2.5">
                  <code className="text-[11px] font-mono" style={{ color: '#7a7578' }}>{l.ip}</code>
                </td>
                <td className="px-3 py-2.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      background: l.success ? '#16a34a18' : '#dc262518',
                      color:      l.success ? '#16a34a'   : '#dc2625',
                      border:     `1px solid ${l.success ? '#16a34a33' : '#dc262533'}`,
                    }}>
                    {l.success ? 'OK' : 'FAIL'}
                  </span>
                </td>
                <td className="px-3 py-2.5" style={{ color: '#4a4648' }}>{l.reason}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => deleteLog(l.id)} disabled={deleting === l.id}
                    className="w-6 h-6 rounded text-[12px] flex items-center justify-center transition-all"
                    style={{ color: '#3a3537', background: 'transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.color='#dc2625'; e.currentTarget.style.background='#dc262518' }}
                    onMouseLeave={e => { e.currentTarget.style.color='#3a3537'; e.currentTarget.style.background='transparent' }}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
