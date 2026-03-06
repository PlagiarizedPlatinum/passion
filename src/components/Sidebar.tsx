'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/dashboard',      label: 'Overview', icon: HomeIcon  },
  { href: '/dashboard/keys', label: 'Keys',     icon: KeyIcon   },
  { href: '/dashboard/logs', label: 'Logs',     icon: LogIcon   },
]

export default function Sidebar({ username }: { username: string }) {
  const path   = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const NavLinks = () => (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href))
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13px] transition-colors"
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
    </>
  )

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 border-b"
           style={{ background: '#0f0b0c', borderColor: '#352f31' }}>
        <span className="text-[16px] font-bold" style={{ color: '#e5e3e4' }}>Passion</span>
        <button onClick={() => setOpen(o => !o)}
                className="w-9 h-9 flex flex-col justify-center items-center gap-1.5 rounded-[7px]"
                style={{ background: '#1c1318', border: '1px solid #352f31' }}>
          <span className="block w-4 h-0.5 rounded" style={{ background: open ? '#dc2625' : '#868283' }} />
          <span className="block w-4 h-0.5 rounded" style={{ background: open ? '#dc2625' : '#868283' }} />
          <span className="block w-4 h-0.5 rounded" style={{ background: open ? '#dc2625' : '#868283' }} />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
          <div className="relative w-[220px] flex flex-col py-6 px-3 border-r"
               style={{ background: '#0f0b0c', borderColor: '#352f31' }}
               onClick={e => e.stopPropagation()}>
            <p className="text-[10px] uppercase tracking-widest mb-3 px-3" style={{ color: '#3a3537' }}>Menu</p>
            <NavLinks />
            <div className="mt-auto pt-4 border-t" style={{ borderColor: '#352f31' }}>
              <p className="text-[11px] px-3 mb-2 truncate" style={{ color: '#3a3537' }}>{username}</p>
              <button onClick={logout}
                      className="w-full text-left text-[12px] px-3 py-1.5 rounded-[6px] transition-colors"
                      style={{ color: '#5d585c' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2625')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#5d585c')}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-[130px] flex-col border-r shrink-0"
             style={{ background: '#0f0b0c', borderColor: '#352f31' }}>
        <div className="px-4 py-5 border-b" style={{ borderColor: '#352f31' }}>
          <span className="text-[17px] font-bold" style={{ color: '#e5e3e4' }}>Passion</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2 flex-1 pt-3">
          <NavLinks />
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
    </>
  )
}

function HomeIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function KeyIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
}
function LogIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
