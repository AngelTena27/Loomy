import { createServerFn } from '@tanstack/react-start'
import { createServerClient } from '../lib/supabase.server'
import { triggerFlowsForEvent } from './flows'

export const listContactsFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as unknown as { workspaceId: string }
  const supabase = createServerClient()
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return contacts ?? []
})

export const createContactFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as {
    workspace_id: string
    first_name: string
    last_name?: string
    email?: string
    phone?: string
    company?: string
    source?: string
    tags?: string[]
    notes?: string
    created_by_email?: string
    created_by_name?: string
  }
  const supabase = createServerClient()
  const { data: contact, error } = await supabase
    .from('contacts')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)

  // Disparar flujos con trigger "contact_created" en background
  triggerFlowsForEvent('contact_created', contact, data.workspace_id).catch(err =>
    console.error('Error disparando flujos contact_created:', err)
  )

  return contact
})

export const updateContactFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  // skipTrigger=true cuando la llamada viene de un flujo (evita loops infinitos)
  const { id, updates, skipTrigger } = ctx.data as unknown as {
    id: string
    updates: Record<string, unknown>
    skipTrigger?: boolean
  }
  const supabase = createServerClient()
  const { data: contact, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)

  // Disparar flujos contact_updated solo si no viene de un flujo
  if (!skipTrigger && contact.workspace_id) {
    triggerFlowsForEvent('contact_updated', contact, contact.workspace_id as string).catch(err =>
      console.error('Error disparando flujos contact_updated:', err)
    )
  }

  return contact
})

export const deleteContactFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { id } = ctx.data as unknown as { id: string }
  const supabase = createServerClient()
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
})

export const getContactFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { id } = ctx.data as unknown as { id: string }
  const supabase = createServerClient()
  const { data, error } = await supabase.from('contacts').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data
})

export const listContactNotesFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { contactId } = ctx.data as unknown as { contactId: string }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('contact_notes')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
})

export const createContactNoteFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as {
    contact_id: string
    workspace_id: string
    user_id: string
    user_email: string
    content: string
    type: string
  }
  const supabase = createServerClient()
  const { data: note, error } = await supabase
    .from('contact_notes')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return note
})

export const listFieldGroupsFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as unknown as { workspaceId: string }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('contact_field_groups')
    .select('*, contact_fields(*)')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
})

export const createFieldGroupFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as { workspace_id: string; name: string }
  const supabase = createServerClient()
  const { data: group, error } = await supabase
    .from('contact_field_groups')
    .insert(data)
    .select('*, contact_fields(*)')
    .single()
  if (error) throw new Error(error.message)
  return group
})

export const deleteFieldGroupFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { id } = ctx.data as unknown as { id: string }
  const supabase = createServerClient()
  const { error } = await supabase.from('contact_field_groups').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
})

export const createFieldFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as {
    group_id: string
    workspace_id: string
    name: string
    field_type: string
    options?: string[]
  }
  const supabase = createServerClient()
  const { data: field, error } = await supabase
    .from('contact_fields')
    .insert({ ...data, options: data.options ?? [] })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return field
})

export const deleteFieldFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { id } = ctx.data as unknown as { id: string }
  const supabase = createServerClient()
  const { error } = await supabase.from('contact_fields').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
})

export const listFieldValuesFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { contactId } = ctx.data as unknown as { contactId: string }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('contact_field_values')
    .select('*')
    .eq('contact_id', contactId)
  if (error) throw new Error(error.message)
  return data ?? []
})

export const upsertFieldValueFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as {
    contact_id: string
    field_id: string
    workspace_id: string
    value: string
  }
  const supabase = createServerClient()
  const { data: val, error } = await supabase
    .from('contact_field_values')
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'contact_id,field_id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return val
})
