import { createFileRoute, redirect } from '@tanstack/react-router'
import { createClient } from '../lib/supabase'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') throw redirect({ to: '/login' })
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      throw redirect({ to: '/dashboard' })
    } else {
      throw redirect({ to: '/login' })
    }
  },
  component: () => null,
})
