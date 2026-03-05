import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0f0b0c' }}>
      <Sidebar username={session.username} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
