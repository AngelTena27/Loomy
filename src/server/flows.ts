import { createServerFn } from '@tanstack/react-start'
import { createServerClient } from '../lib/supabase.server'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────

interface GraphNode {
  id: string
  type: string
  data: {
    subType: string
    label: string
    config?: Record<string, string>
  }
}

interface GraphEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

interface FlowGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface ContactRow {
  id: string
  first_name: string
  last_name?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  source?: string | null
  tags?: string[] | null
  [key: string]: unknown
}

interface NodeLog {
  nodeId: string
  label: string
  subType: string
  status: 'success' | 'error'
  log: string
}

// ─── Execution helpers (server-side) ─────────────────────

function resolveVars(template: string, contact: ContactRow): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = contact[key]
    if (val == null) return ''
    if (Array.isArray(val)) return val.join(', ')
    return String(val)
  })
}

function getContactField(field: string, contact: ContactRow): string {
  const val = contact[field]
  if (val == null) return ''
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

function evalCondition(fieldValue: string, operator: string, compareValue: string): boolean {
  const fv = fieldValue.toLowerCase()
  const cv = compareValue.toLowerCase()
  switch (operator) {
    case 'contains':    return fv.includes(cv)
    case 'equals':      return fv === cv
    case 'not_empty':   return fv.length > 0
    case 'is_empty':    return fv.length === 0
    case 'starts_with': return fv.startsWith(cv)
    default:            return false
  }
}

// Ejecuta la lógica de un solo nodo y retorna log + contacto actualizado + nextHandle
async function executeSingleNodeLogic(
  supabase: SupabaseClient,
  node: GraphNode,
  c: Record<string, string>,
  liveContact: ContactRow
): Promise<{ log: string; updatedContact?: ContactRow; nextHandle?: string }> {
  switch (node.data.subType) {
    case 'contact_created': case 'contact_updated': case 'manual': case 'form_submitted': case 'subflow_start': {
      return { log: [`Contacto: ${liveContact.first_name} ${liveContact.last_name ?? ''}`, `ID: ${liveContact.id}`, `Email: ${liveContact.email || '—'}`, `Teléfono: ${liveContact.phone || '—'}`, `Empresa: ${liveContact.company || '—'}`, `Etiquetas: ${(liveContact.tags ?? []).join(', ') || '—'}`].join('\n') }
    }
    case 'add_tag': {
      if (!c.tag) return { log: '⚠️ Sin etiquetas configuradas' }
      const tagNames = c.tag.split(',').map(s => s.trim()).filter(Boolean)
      const newTags = Array.from(new Set([...(liveContact.tags ?? []), ...tagNames]))
      const { data, error } = await supabase.from('contacts').update({ tags: newTags, updated_at: new Date().toISOString() }).eq('id', liveContact.id).select().single()
      if (error) throw new Error(error.message)
      return { log: `Etiquetas añadidas: ${tagNames.join(', ')}\nEtiquetas ahora: ${newTags.join(', ')}`, updatedContact: data as ContactRow }
    }
    case 'remove_tag': {
      if (!c.tag) return { log: '⚠️ Sin etiquetas configuradas' }
      const tagNames = c.tag.split(',').map(s => s.trim()).filter(Boolean)
      const newTags = (liveContact.tags ?? []).filter(t => !tagNames.includes(t))
      const { data, error } = await supabase.from('contacts').update({ tags: newTags, updated_at: new Date().toISOString() }).eq('id', liveContact.id).select().single()
      if (error) throw new Error(error.message)
      return { log: `Etiquetas quitadas: ${tagNames.join(', ')}\nEtiquetas ahora: ${newTags.join(', ') || '—'}`, updatedContact: data as ContactRow }
    }
    case 'update_contact': {
      if (!c.field) return { log: '⚠️ Campo no configurado' }
      const resolvedVal = resolveVars(c.value ?? '', liveContact)
      const { data, error } = await supabase.from('contacts').update({ [c.field]: resolvedVal, updated_at: new Date().toISOString() }).eq('id', liveContact.id).select().single()
      if (error) throw new Error(error.message)
      return { log: `Campo actualizado:\n"${c.field}" = "${resolvedVal}"`, updatedContact: data as ContactRow }
    }
    case 'send_email': {
      const subject = resolveVars(c.subject ?? '(sin asunto)', liveContact)
      const body = resolveVars(c.body ?? '', liveContact)
      const preview = body.length > 100 ? body.slice(0, 100) + '…' : body
      return { log: `Para: ${liveContact.email || '—'}\nAsunto: ${subject}${preview ? `\nCuerpo: ${preview}` : ''}` }
    }
    case 'condition': {
      const fieldVal = getContactField(c.field ?? '', liveContact)
      const compareVal = resolveVars(c.value ?? '', liveContact)
      const result = evalCondition(fieldVal, c.operator ?? 'contains', compareVal)
      return { log: `Campo: "${c.field}"\nValor: "${fieldVal}"\nOperador: ${c.operator}\nComparar: "${compareVal}"\nResultado: ${result ? '✅ TRUE' : '❌ FALSE'}`, nextHandle: result ? 'true' : 'false' }
    }
    case 'wait':
      return { log: `Espera simulada: ${c.amount ?? '1'} ${c.unit ?? 'days'}` }
    case 'create_deal':
      return { log: `Deal a crear: "${resolveVars(c.name ?? 'Deal', liveContact)}"\n(integración pendiente)` }
    case 'call_subflow': {
      if (!c.subflow_id) return { log: '⚠️ Sin subflujo seleccionado' }
      const { data: subflow } = await supabase.from('flows').select('id, name, graph').eq('id', c.subflow_id).single()
      if (!subflow) return { log: '⚠️ Subflujo no encontrado' }
      const subGraph = subflow.graph as FlowGraph | null
      if (!subGraph?.nodes?.length) return { log: `⚠️ Subflujo "${subflow.name}" sin nodos` }
      // Prefer subflow_start; fall back to any trigger node
      const subStart = subGraph.nodes.find(n => n.data.subType === 'subflow_start')
        ?? subGraph.nodes.find(n => n.type === 'trigger')
      if (!subStart) return { log: `⚠️ Subflujo "${subflow.name}" sin nodo de inicio` }
      const subLines = [`Subflujo: ${subflow.name}`]
      const subResult = await executeFlowNodes(supabase, subGraph, liveContact, subStart)
      for (const entry of subResult.logs) subLines.push(`  ↳ ${entry.label}: ${entry.log.split('\n')[0]}`)
      return { log: subLines.join('\n'), updatedContact: subResult.finalContact }
    }
    default:
      return { log: `Nodo "${node.data.subType}" ejecutado` }
  }
}

// Ejecuta los nodos de un grafo y devuelve logs + contacto final (sin guardar flow_run)
async function executeFlowNodes(
  supabase: SupabaseClient,
  graph: FlowGraph,
  contact: ContactRow,
  startNode?: GraphNode
): Promise<{ logs: NodeLog[]; finalContact: ContactRow }> {
  const trigger = startNode ?? graph.nodes.find(n => n.type === 'trigger')
  if (!trigger) return { logs: [], finalContact: contact }

  let liveContact = { ...contact }
  let current: GraphNode | undefined = trigger
  const visited = new Set<string>()
  const logs: NodeLog[] = []

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const node: GraphNode = current
    const c = node.data.config ?? {}
    let log = '', nextHandle: string | undefined
    let nodeStatus: 'success' | 'error' = 'success'
    try {
      const res = await executeSingleNodeLogic(supabase, node, c, liveContact)
      log = res.log
      nextHandle = res.nextHandle
      if (res.updatedContact) liveContact = res.updatedContact
    } catch (err) {
      nodeStatus = 'error'
      log = `Error: ${err instanceof Error ? err.message : 'fallo'}`
    }
    logs.push({ nodeId: node.id, label: node.data.label, subType: node.data.subType, status: nodeStatus, log })
    const nextEdge: GraphEdge | undefined = node.data.subType === 'condition'
      ? graph.edges.find(e => e.source === node.id && e.sourceHandle === nextHandle)
      : graph.edges.find(e => e.source === node.id)
    current = nextEdge ? graph.nodes.find(n => n.id === nextEdge.target) : undefined
  }

  return { logs, finalContact: liveContact }
}

async function executeFlowGraph(
  supabase: SupabaseClient,
  graph: FlowGraph,
  contact: ContactRow,
  flow: { id: string; name: string; workspace_id: string },
  triggerEvent?: string
): Promise<void> {
  // Find all trigger nodes that match the event (or all triggers if no event filter)
  const matchingTriggers = graph.nodes.filter(n =>
    n.type === 'trigger' && (triggerEvent ? n.data.subType === triggerEvent : true)
  )
  if (!matchingTriggers.length) return

  const allLogs: NodeLog[] = []
  for (const trigger of matchingTriggers) {
    const { logs } = await executeFlowNodes(supabase, graph, contact, trigger)
    allLogs.push(...logs)
  }

  const hasError = allLogs.some(l => l.status === 'error')
  await supabase.from('flow_runs').insert({
    flow_id: flow.id,
    flow_name: flow.name,
    contact_id: contact.id,
    workspace_id: flow.workspace_id,
    status: hasError ? 'failed' : 'completed',
    triggered_by: 'automatic',
    node_logs: allLogs,
  })
}

// ─── Exported server functions ────────────────────────────

export const listFlowsFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { workspaceId } = ctx.data as unknown as { workspaceId: string }
  const supabase = createServerClient()
  const { data: flows, error } = await supabase
    .from('flows')
    .select('id, name, description, status, trigger_type, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return flows ?? []
})

export const getFlowFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { flowId } = ctx.data as unknown as { flowId: string }
  const supabase = createServerClient()
  const { data: flow, error } = await supabase
    .from('flows')
    .select('*')
    .eq('id', flowId)
    .single()
  if (error) throw new Error(error.message)
  return flow
})

export const createFlowFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as {
    workspace_id: string
    name: string
    description?: string
  }
  const supabase = createServerClient()
  const { data: flow, error } = await supabase
    .from('flows')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return flow
})

export const saveFlowFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { flowId, graph, name, status } = ctx.data as unknown as {
    flowId: string
    graph: { nodes: Array<{ id: string; type: string; data: { subType: string; label: string; config?: Record<string, string> } }>; edges: unknown[]; viewport: { x: number; y: number; zoom: number } }
    name?: string
    status?: 'draft' | 'active' | 'paused' | 'archived'
  }
  const supabase = createServerClient()

  const triggerNodes = graph.nodes.filter(n => n.type === 'trigger')
  const trigger_type = triggerNodes.length > 0
    ? triggerNodes.map(n => n.data.subType).join(',')
    : null

  const updates: Record<string, unknown> = {
    graph,
    updated_at: new Date().toISOString(),
    trigger_type,
  }
  if (name) updates.name = name
  if (status) updates.status = status

  const { data: flow, error } = await supabase
    .from('flows')
    .update(updates)
    .eq('id', flowId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return flow
})

export const deleteFlowFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { id } = ctx.data as unknown as { id: string }
  const supabase = createServerClient()
  const { error } = await supabase.from('flows').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
})

export const createFlowRunFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const data = ctx.data as unknown as {
    flow_id: string
    flow_name: string
    contact_id: string
    workspace_id: string
    triggered_by?: string
    node_logs?: Array<{ nodeId: string; label: string; subType: string; status: string; log: string }>
  }
  const supabase = createServerClient()
  const { node_logs, ...rest } = data
  const insertData: Record<string, unknown> = { ...rest, status: 'completed', triggered_by: data.triggered_by ?? 'manual' }
  if (node_logs) insertData.node_logs = node_logs
  const { data: run, error } = await supabase
    .from('flow_runs')
    .insert(insertData)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return run
})

export const listFlowRunsByFlowFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { flowId } = ctx.data as unknown as { flowId: string }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('flow_runs')
    .select('id, contact_id, flow_id, status, triggered_by, ran_at, node_logs, contacts(first_name, last_name, email)')
    .eq('flow_id', flowId)
    .order('ran_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return data ?? []
})

export const listFlowRunsForContactFn = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const { contactId } = ctx.data as unknown as { contactId: string }
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('flow_runs')
    .select('*')
    .eq('contact_id', contactId)
    .order('ran_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
})

// ─── Motor de ejecución automática ───────────────────────

// Función plana (llamable desde otros server functions sin HTTP overhead)
export async function triggerFlowsForEvent(
  event: 'contact_created' | 'contact_updated',
  contact: ContactRow,
  workspaceId: string
): Promise<{ executed: number }> {
  const supabase = createServerClient()

  const { data: flows } = await supabase
    .from('flows')
    .select('id, name, workspace_id, graph')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  if (!flows?.length) return { executed: 0 }

  let executed = 0
  for (const flow of flows) {
    const graph = flow.graph as FlowGraph | null
    if (!graph?.nodes?.length) continue

    // Check if any trigger node in this flow matches the event
    const hasMatchingTrigger = graph.nodes.some(n => n.type === 'trigger' && n.data.subType === event)
    if (!hasMatchingTrigger) continue

    try {
      await executeFlowGraph(supabase, graph, contact, flow as { id: string; name: string; workspace_id: string }, event)
      executed++
    } catch (err) {
      console.error(`Error ejecutando flow ${flow.id}:`, err)
    }
  }

  return { executed }
}

// Server function wrapper (para llamarlo desde el cliente si se necesita)
export const triggerFlowsForEventFn = createServerFn({ method: 'POST' }).handler(async (ctx) => {
  const { event, contact, workspaceId } = ctx.data as unknown as {
    event: 'contact_created' | 'contact_updated'
    contact: ContactRow
    workspaceId: string
  }
  return triggerFlowsForEvent(event, contact, workspaceId)
})
