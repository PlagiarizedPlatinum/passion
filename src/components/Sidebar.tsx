'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const nav = [
  { href: '/dashboard',           label: 'Overview',  icon: HomeIcon   },
  { href: '/dashboard/keys',      label: 'Keys',       icon: KeyIcon    },
  { href: '/dashboard/logs',      label: 'Logs',       icon: LogIcon    },
  { href: '/dashboard/settings',  label: 'Settings',   icon: SettingsIcon },
]

export default function Sidebar({ username }: { username: string }) {
  const path   = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/download')
  }

  return (
    <aside className="w-[130px] flex flex-col border-r shrink-0"
           style={{ background: '#0f0b0c', borderColor: '#352f31' }}>
      <div className="px-4 py-5 border-b" style={{ borderColor: '#352f31' }}>
        <span className="text-[17px] font-bold" style={{ color: '#e5e3e4' }}>Passion</span>
      </div>

      <nav className="flex flex-col gap-0.5 p-2 flex-1 pt-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href))
          return (
            <Link key={href} href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-[7px] text-[12px] transition-colors"
                  style={{
                    color:      active ? '#dc2625' : '#868283',
                    background: active ? 'rgba(220,38,37,0.08)' : 'transparent',
                    borderLeft: active ? '2px solid #dc2625' : '2px solid transparent',
                  }}>
              <Icon size={13} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: '#352f31' }}>
        <p className="text-[11px] mb-2 truncate" style={{ color: '#3a3537' }}>{username}</p>
        <button onClick={logout}
                className="w-full text-left text-[12px] px-3 py-1.5 rounded-[6px] transition-colors"
                style={{ color: '#5d585c' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#dc2625')}
                onMouseLeave={e => (e.currentTarget.style.color = '#5d585c')}>
          Sign out
        </button>
      </div>
    </aside>
  )
}

function HomeIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function KeyIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
}
function LogIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function SettingsIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
