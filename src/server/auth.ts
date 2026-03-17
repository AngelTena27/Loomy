import { createServerFn } from '@tanstack/react-start'
import { createRequestClient } from '../lib/supabase.server-request'
import { createServerClient } from '../lib/supabase.server'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = createRequestClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
})

export const signUpFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { email, password } = ctx.data as unknown as { email: string; password: string }
  const admin = createServerClient()
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) return { error: error.message }
  return { userId: created.user.id }
})

export const getWorkspaceFn = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = createRequestClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createServerClient()
  const { data } = await admin
    .from('workspace_members')
    .select('workspace_id, role, workspaces(*)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  return data?.workspaces ?? null
})
