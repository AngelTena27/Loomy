import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { createClient } from '../lib/supabase'
import { AppShell } from '../components/layout/AppShell'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    // Only check session client-side to avoid SSR cookie issues
    if (typeof window === 'undefined') return {}
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
