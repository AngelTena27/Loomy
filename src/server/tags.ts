import { createServerFn } from '@tanstack/react-start'
import { createServerClient } from '../lib/supabase.server'

export const listWorkspaceTagsFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as unknown as { workspaceId: string }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('workspace_tags')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
})

export const createWorkspaceTagFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as { workspace_id: string; name: string; color: string }
  const supabase = createServerClient()
  const { data: tag, error } = await supabase
    .from('workspace_tags')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return tag
})

export const deleteWorkspaceTagFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { id } = ctx.data as unknown as { id: string }
  const supabase = createServerClient()
  const { error } = await supabase.from('workspace_tags').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
})
