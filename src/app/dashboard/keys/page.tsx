'use client'
import { useState, useEffect, useCallback } from 'react'

type Key = {
  id: number; key_value: string; label: string | null; status: string
  hwid: string | null; uses: number; max_uses: number | null
  expires_at: string | null; created_at: string; last_used: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active:   '#16a34a',
  disabled: '#dc2625',
  expired:  '#5d585c',
}

function Badge({ status }: { status: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide"
          style={{ background: STATUS_COLORS[status] + '22', color: STATUS_COLORS[status], border: `1px solid ${STATUS_COLORS[status]}55` }}>
      {status}
    </span>
  )
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

export default function KeysPage() {
  const [keys, setKeys]         = useState<Key[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('')
  const [showCreate, setCreate] = useState(false)
  const [copied, setCopied]     = useState<number | null>(null)
  const [newKey, setNewKey]     = useState<Key | null>(null)

  const [label, setLabel]       = useState('')
  const [maxUses, setMaxUses]   = useState('')
  const [expiresAt, setExpires] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('q', search)
    if (filter) p.set('status', filter)
    const r = await fetch('/api/keys?' + p)
    setKeys(await r.json())
    setLoading(false)
  }, [search, filter])

  useEffect(() => { load() }, [load])

  async function createKey() {
    setCreating(true)
    const body: Record<string, unknown> = {}
    if (label)    body.label     = label
    if (maxUses)  body.max_uses  = Number(maxUses)
    if (expiresAt) body.expires_at = expiresAt
    const r = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const k = await r.json()
    setCreating(false)
    setNewKey(k)
    setCreate(false)
    setLabel(''); setMaxUses(''); setExpires('')
    load()
  }

  async function deleteKey(id: number) {
    if (!confirm('Delete this key permanently?')) return
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    load()
  }

  async function toggleStatus(k: Key) {
    const next = k.status === 'active' ? 'disabled' : 'active'
    await fetch(`/api/keys/${k.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
    load()
  }

  async function resetHwid(id: number) {
    await fetch(`/api/keys/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset_hwid: true }) })
    load()
  }

  function copy(id: number, val: string) {
    navigator.clipboard.writeText(val)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const inputCls = "h-[38px] rounded-[7px] px-3 text-[13px] outline-none transition-colors"
  const inputStyle = { background: '#2a2024', border: '1px solid #352c2f', color: '#c5c0c2' }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-5 sm:mb-6">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold" style={{ color: '#e5e3e4' }}>License Keys</h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#5d585c' }}>{keys.length} keys</p>
        </div>
        <button onClick={() => setCreate(true)}
                className="h-[38px] px-3 sm:px-4 rounded-[8px] text-[13px] font-semibold text-white transition-colors whitespace-nowrap"
                style={{ background: '#dc2625', boxShadow: '0 0 14px rgba(220,38,37,0.35)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e42d2c')}
                onMouseLeave={e => (e.currentTarget.style.background = '#dc2625')}>
          + Create Key
        </button>
      </div>

      {newKey && (
        <div className="mb-4 p-3 sm:p-4 rounded-[10px] flex items-start sm:items-center justify-between gap-3"
             style={{ background: '#16a34a18', border: '1px solid #16a34a44' }}>
          <div className="min-w-0">
            <p className="text-[12px] mb-1" style={{ color: '#16a34a' }}>Key created successfully</p>
            <code className="text-[12px] sm:text-[13px] font-mono break-all" style={{ color: '#e5e3e4' }}>{newKey.key_value}</code>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => copy(-1, newKey.key_value)}
                    className="px-3 py-1.5 rounded-[6px] text-[12px] whitespace-nowrap"
                    style={{ background: '#16a34a33', color: '#16a34a' }}>
              {copied === -1 ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={() => setNewKey(null)} style={{ color: '#5d585c' }}>✕</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-5">
        <input placeholder="Search keys or labels…" value={search} onChange={e => setSearch(e.target.value)}
               className={inputCls + " flex-1 min-w-0"} style={{ ...inputStyle, minWidth: '140px', maxWidth: '300px' }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
                className={inputCls} style={{ ...inputStyle, paddingRight: '8px' }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="rounded-[12px] overflow-hidden border" style={{ borderColor: '#352f31' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[700px]">
            <thead>
              <tr style={{ background: '#1a1218', borderBottom: '1px solid #352f31' }}>
                {['ID','Key','Label','Status','HWID','Uses','Expires','Created','Actions'].map(h => (
                  <th key={h} className="px-3 sm:px-4 py-3 text-left font-semibold uppercase tracking-widest text-[10px] sm:text-[11px] whitespace-nowrap"
                      style={{ color: '#5d585c' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: '#5d585c' }}>Loading…</td></tr>}
              {!loading && keys.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: '#5d585c' }}>No keys found</td></tr>}
              {keys.map((k, i) => (
                <tr key={k.id} style={{ background: i % 2 === 0 ? '#1c1318' : '#1a1216', borderBottom: '1px solid #2a2226' }}>
                  <td className="px-3 sm:px-4 py-3" style={{ color: '#5d585c' }}>{k.id}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-[11px] sm:text-[12px]" style={{ color: '#c5c0c2' }}>{k.key_value.slice(0, 14)}…</code>
                      <button onClick={() => copy(k.id, k.key_value)}
                              className="text-[11px] px-2 py-0.5 rounded transition-colors whitespace-nowrap"
                              style={{ color: copied === k.id ? '#16a34a' : '#5d585c', background: '#2a2024' }}>
                        {copied === k.id ? '✓' : 'copy'}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3" style={{ color: '#868283' }}>{k.label || '—'}</td>
                  <td className="px-3 sm:px-4 py-3"><Badge status={k.status} /></td>
                  <td className="px-3 sm:px-4 py-3">
                    {k.hwid
                      ? <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono" style={{ color: '#868283' }}>{k.hwid.slice(0,8)}…</code>
                          <button onClick={() => resetHwid(k.id)} title="Reset HWID"
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ color: '#dc2625', background: '#dc262522' }}>↺</button>
                        </div>
                      : <span style={{ color: '#5d585c' }}>—</span>}
                  </td>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap" style={{ color: '#868283' }}>
                    {k.uses}{k.max_uses ? `/${k.max_uses}` : ''}
                  </td>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap" style={{ color: '#868283' }}>{fmt(k.expires_at)}</td>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap" style={{ color: '#868283' }}>{fmt(k.created_at)}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex gap-1.5 sm:gap-2">
                      <button onClick={() => toggleStatus(k)}
                              className="text-[11px] px-2 py-1 rounded transition-colors whitespace-nowrap"
                              style={{ color: k.status === 'active' ? '#dc2625' : '#16a34a', background: k.status === 'active' ? '#dc262518' : '#16a34a18' }}>
                        {k.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteKey(k.id)}
                              className="text-[11px] px-2 py-1 rounded transition-colors"
                              style={{ color: '#dc2625', background: '#dc262518' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
             style={{ background: 'rgba(0,0,0,0.7)' }}
             onClick={e => e.target === e.currentTarget && setCreate(false)}>
          <div className="w-full max-w-[400px] rounded-[17px] p-6 sm:p-8"
               style={{ background: 'linear-gradient(180deg,#21161a 0%,#161014 100%)', border: '1px solid #352f31', boxShadow: '0 12px 55px rgba(0,0,0,0.8)' }}>
            <h2 className="text-[18px] font-bold mb-1" style={{ color: '#e5e3e4' }}>Create Key</h2>
            <p className="text-[12px] mb-6" style={{ color: '#5d585c' }}>Leave fields blank for unlimited/no expiry</p>

            <label className="text-[12px] mb-1.5 block" style={{ color: '#888485' }}>Label (optional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Customer name"
                   className={inputCls + " w-full mb-4"} style={inputStyle} />

            <label className="text-[12px] mb-1.5 block" style={{ color: '#888485' }}>Max Uses (optional)</label>
            <input value={maxUses} onChange={e => setMaxUses(e.target.value)} type="number" min="1" placeholder="Unlimited"
                   className={inputCls + " w-full mb-4"} style={inputStyle} />

            <label className="text-[12px] mb-1.5 block" style={{ color: '#888485' }}>Expires At (optional)</label>
            <input value={expiresAt} onChange={e => setExpires(e.target.value)} type="datetime-local"
                   className={inputCls + " w-full mb-6"} style={{ ...inputStyle, colorScheme: 'dark' }} />

            <div className="flex gap-3">
              <button onClick={() => setCreate(false)}
                      className="flex-1 h-[40px] rounded-[8px] text-[13px]"
                      style={{ background: '#2a2024', color: '#868283', border: '1px solid #352c2f' }}>
                Cancel
              </button>
              <button onClick={createKey} disabled={creating}
                      className="flex-1 h-[40px] rounded-[8px] text-[13px] font-semibold text-white"
                      style={{ background: '#dc2625', boxShadow: '0 0 14px rgba(220,38,37,0.35)' }}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
