import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function LogsPage() {
  const logs = await sql`
    SELECT l.id, l.key_value, l.hwid, l.ip, l.success, l.reason, l.created_at,
           k.label
    FROM key_logs l
    LEFT JOIN license_keys k ON k.id = l.key_id
    ORDER BY l.created_at DESC
    LIMIT 200`

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold" style={{ color: '#e5e3e4' }}>Validation Logs</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#5d585c' }}>Last 200 entries</p>
      </div>

      <div className="rounded-[12px] overflow-hidden border" style={{ borderColor: '#352f31' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: '#1a1218', borderBottom: '1px solid #352f31' }}>
              {['Time','Key','Label','HWID','IP','Result','Reason'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-widest text-[11px]"
                    style={{ color: '#5d585c' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#5d585c' }}>No logs yet</td></tr>
            )}
            {logs.map((l, i) => (
              <tr key={l.id} style={{ background: i % 2 === 0 ? '#1c1318' : '#1a1216', borderBottom: '1px solid #2a2226' }}>
                <td className="px-4 py-2.5 text-[12px]" style={{ color: '#5d585c' }}>
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <code className="text-[11px] font-mono" style={{ color: '#868283' }}>
                    {l.key_value?.slice(0, 14)}…
                  </code>
                </td>
                <td className="px-4 py-2.5" style={{ color: '#868283' }}>{l.label || '—'}</td>
                <td className="px-4 py-2.5">
                  <code className="text-[11px] font-mono" style={{ color: '#868283' }}>
                    {l.hwid?.slice(0, 12) || '—'}
                  </code>
                </td>
                <td className="px-4 py-2.5">
                  <code className="text-[11px] font-mono" style={{ color: '#868283' }}>{l.ip}</code>
                </td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold"
                        style={{
                          background: l.success ? '#16a34a18' : '#dc262518',
                          color:      l.success ? '#16a34a'   : '#dc2625',
                          border:     `1px solid ${l.success ? '#16a34a44' : '#dc262544'}`,
                        }}>
                    {l.success ? 'OK' : 'FAIL'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[12px]" style={{ color: '#5d585c' }}>{l.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
