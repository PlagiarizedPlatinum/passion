import { getSession } from '@/lib/auth'
import sql from '@/lib/db'

async function getStats() {
  const [keys, logs] = await Promise.all([
    sql`SELECT
          COUNT(*)                                                      AS total,
          COUNT(*) FILTER (WHERE status='active')                       AS active,
          COUNT(*) FILTER (WHERE status='disabled')                     AS disabled,
          COUNT(*) FILTER (WHERE status='expired')                      AS expired,
          COUNT(*) FILTER (WHERE hwid IS NOT NULL)                      AS hwid_bound,
          COUNT(*) FILTER (WHERE created_at > NOW()-'24h'::interval)    AS new_today
        FROM license_keys`,
    sql`SELECT
          COUNT(*)                                                      AS total,
          COUNT(*) FILTER (WHERE success=true)                          AS success,
          COUNT(*) FILTER (WHERE success=false)                         AS failed,
          COUNT(*) FILTER (WHERE created_at > NOW()-'24h'::interval)    AS today
        FROM key_logs`,
  ])
  return { keys: keys[0], logs: logs[0] }
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-[12px] p-5 border"
         style={{ background: 'linear-gradient(180deg,#21161a 0%,#1a1218 100%)', borderColor: '#352f31' }}>
      <p className="text-[12px] uppercase tracking-widest mb-2" style={{ color: '#5d585c' }}>{label}</p>
      <p className="text-[28px] font-bold" style={{ color: accent ? '#dc2625' : '#e5e3e4' }}>{value}</p>
      {sub && <p className="text-[12px] mt-1" style={{ color: '#868283' }}>{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  const { keys, logs } = await getStats()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold" style={{ color: '#e5e3e4' }}>Overview</h1>
        <p className="text-[13px] mt-1" style={{ color: '#5d585c' }}>Welcome back, {session?.username}</p>
      </div>

      {/* Key stats */}
      <h2 className="text-[12px] uppercase tracking-widest mb-3" style={{ color: '#5d585c' }}>License Keys</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Keys"    value={Number(keys.total)}     />
        <StatCard label="Active"        value={Number(keys.active)}    accent />
        <StatCard label="Disabled"      value={Number(keys.disabled)}  />
        <StatCard label="Expired"       value={Number(keys.expired)}   />
        <StatCard label="HWID Bound"    value={Number(keys.hwid_bound)} sub="Locked to device" />
        <StatCard label="Created Today" value={Number(keys.new_today)}  sub="Last 24 hours" />
      </div>

      {/* Log stats */}
      <h2 className="text-[12px] uppercase tracking-widest mb-3" style={{ color: '#5d585c' }}>Validation Logs</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Checks"  value={Number(logs.total)}   />
        <StatCard label="Successful"    value={Number(logs.success)} accent />
        <StatCard label="Failed"        value={Number(logs.failed)}  />
        <StatCard label="Today"         value={Number(logs.today)}   sub="Last 24 hours" />
      </div>
    </div>
  )
}
