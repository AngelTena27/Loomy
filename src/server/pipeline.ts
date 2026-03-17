import { createServerFn } from '@tanstack/react-start'
import { createServerClient } from '../lib/supabase.server'

export const listPipelinesFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as unknown as { workspaceId: string }
  const supabase = createServerClient()
  const { data: pipelines, error } = await supabase
    .from('pipelines')
    .select('*, pipeline_stages(*)')
    .eq('workspace_id', workspaceId)
    .order('position')
  if (error) throw new Error(error.message)
  return pipelines ?? []
})

export const createPipelineFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as { workspace_id: string; name: string }
  const supabase = createServerClient()
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)

  await supabase.from('pipeline_stages').insert([
    { pipeline_id: pipeline.id, name: 'New', color: '#6366f1', position: 0 },
    { pipeline_id: pipeline.id, name: 'Contacted', color: '#06b6d4', position: 1 },
    { pipeline_id: pipeline.id, name: 'Qualified', color: '#f59e0b', position: 2 },
    { pipeline_id: pipeline.id, name: 'Won', color: '#10b981', position: 3 },
    { pipeline_id: pipeline.id, name: 'Lost', color: '#ef4444', position: 4 },
  ])

  return pipeline
})

export const getPipelineWithDealsFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { pipelineId } = ctx.data as unknown as { pipelineId: string }
  const supabase = createServerClient()
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .select('*, pipeline_stages(*, deals(*, contacts(*)))')
    .eq('id', pipelineId)
    .order('position', { referencedTable: 'pipeline_stages' })
    .single()
  if (error) throw new Error(error.message)
  return pipeline
})

export const createDealFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as {
    stage_id: string
    workspace_id: string
    contact_id?: string
    title: string
    value?: number
    currency?: string
  }
  const supabase = createServerClient()
  const { data: deal, error } = await supabase
    .from('deals')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return deal
})

export const moveDealFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { dealId, stageId, position } = ctx.data as unknown as {
    dealId: string
    stageId: string
    position: number
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from('deals')
    .update({ stage_id: stageId, position, updated_at: new Date().toISOString() })
    .eq('id', dealId)
  if (error) throw new Error(error.message)
  return { success: true }
})

export const deleteDealFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { id } = ctx.data as unknown as { id: string }
  const supabase = createServerClient()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
})
