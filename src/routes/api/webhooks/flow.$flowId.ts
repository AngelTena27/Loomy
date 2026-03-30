import { createFileRoute } from '@tanstack/react-router'
import { createServerClient } from '../../../lib/supabase.server'

interface GraphNode {
  id: string
  type: string
  data: { subType: string; label: string; config?: Record<string, string> }
}
interface GraphEdge {
  id: string; source: string; target: string; sourceHandle?: string
}
interface FlowGraph { nodes: GraphNode[]; edges: GraphEdge[] }
interface ContactRow {
  id: string; first_name: string; last_name?: string | null
  email?: string | null; phone?: string | null; company?: string | null
  source?: string | null; tags?: string[] | null
  [key: string]: unknown
}
interface NodeLog {
  nodeId: string; label: string; subType: string
  status: 'success' | 'error'; log: string
}

function resolveVars(template: string, c: ContactRow): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = c[k]; if (v == null) return ''; if (Array.isArray(v)) return v.join(', '); return String(v)
  })
}
function getField(field: string, c: ContactRow): string {
  const v = c[field]; if (v == null) return ''; if (Array.isArray(v)) return v.join(', '); return String(v)
}
function evalCond(fv: string, op: string, cv: string): boolean {
  const f = fv.toLowerCase(), c2 = cv.toLowerCase()
  switch (op) {
    case 'contains': return f.includes(c2)
    case 'equals': return f === c2
    case 'not_empty': return f.length > 0
    case 'is_empty': return f.length === 0
    case 'starts_with': return f.startsWith(c2)
    default: return false
  }
}

async function runFlowWebhook(
  graph: FlowGraph,
  contact: ContactRow,
  flow: { id: string; name: string; workspace_id: string }
): Promise<NodeLog[]> {
  const supabase = createServerClient()
  const trigger = graph.nodes.find(n => n.type === 'trigger' && n.data.subType === 'webhook')
  if (!trigger) return []

  let live = { ...contact }
  let current: GraphNode | undefined = trigger
  const visited = new Set<string>()
  const logs: NodeLog[] = []

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const node = current
    const cfg = node.data.config ?? {}
    let log = '', status: 'success' | 'error' = 'success', nextHandle: string | undefined

    try {
      switch (node.data.subType) {
        case 'webhook':
          log = `Webhook recibido\nContacto: ${live.first_name} ${live.last_name ?? ''}\nID: ${live.id}\nEmail: ${live.email || '—'}`
          break
        case 'add_tag': {
          if (!cfg.tag) { log = '⚠️ Sin etiquetas'; break }
          const tags = cfg.tag.split(',').map((s: string) => s.trim()).filter(Boolean)
          const newTags = Array.from(new Set([...(live.tags ?? []), ...tags]))
          const { data, error } = await supabase.from('contacts').update({ tags: newTags, updated_at: new Date().toISOString() }).eq('id', live.id).select().single()
          if (error) throw new Error(error.message)
          live = data as ContactRow
          log = `Etiquetas añadidas: ${tags.join(', ')}`
          break
        }
        case 'remove_tag': {
          if (!cfg.tag) { log = '⚠️ Sin etiquetas'; break }
          const tags = cfg.tag.split(',').map((s: string) => s.trim()).filter(Boolean)
          const newTags = (live.tags ?? []).filter((t: string) => !tags.includes(t))
          const { data, error } = await supabase.from('contacts').update({ tags: newTags, updated_at: new Date().toISOString() }).eq('id', live.id).select().single()
          if (error) throw new Error(error.message)
          live = data as ContactRow
          log = `Etiquetas quitadas: ${tags.join(', ')}`
          break
        }
        case 'update_contact': {
          if (!cfg.field) { log = '⚠️ Campo no configurado'; break }
          const val = resolveVars(cfg.value ?? '', live)
          const { data, error } = await supabase.from('contacts').update({ [cfg.field]: val, updated_at: new Date().toISOString() }).eq('id', live.id).select().single()
          if (error) throw new Error(error.message)
          live = data as ContactRow
          log = `"${cfg.field}" = "${val}"`
          break
        }
        case 'send_email': {
          const subject = resolveVars(cfg.subject ?? '(sin asunto)', live)
          const body = resolveVars(cfg.body ?? '', live)
          log = `Para: ${live.email || '—'}\nAsunto: ${subject}\nCuerpo: ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`
          break
        }
        case 'send_whatsapp': {
          if (!cfg.message) { log = '⚠️ Mensaje no configurado'; break }
          if (!live.phone) { log = '⚠️ Sin número de teléfono'; break }
          const text = resolveVars(cfg.message, live)
          const phone = live.phone.replace(/\D/g, '')
          if (!phone) { log = '⚠️ Número inválido'; break }
          const { data: inst } = await supabase.from('whatsapp_instances')
            .select('instance_name').eq('workspace_id', flow.workspace_id).eq('status', 'connected').limit(1).single()
          if (!inst) { log = '⚠️ Sin instancia WhatsApp conectada'; break }
          const res = await fetch(
            `${process.env.EVOLUTION_API_URL}/message/sendText/${inst.instance_name}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY! }, body: JSON.stringify({ number: phone, text }) }
          )
          if (!res.ok) throw new Error(`Evolution API error: ${res.status}`)
          log = `WhatsApp enviado a ${live.phone}\nMensaje: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`
          break
        }
        case 'condition': {
          const fv = getField(cfg.field ?? '', live)
          const cv = resolveVars(cfg.value ?? '', live)
          const result = evalCond(fv, cfg.operator ?? 'contains', cv)
          log = `"${cfg.field}" ${cfg.operator} "${cv}" → ${result ? '✅ TRUE' : '❌ FALSE'}`
          nextHandle = result ? 'true' : 'false'
          break
        }
        case 'wait':
          log = `Espera: ${cfg.amount ?? '1'} ${cfg.unit ?? 'days'}`
          break
        case 'create_deal':
          log = `Deal: "${resolveVars(cfg.name ?? 'Deal', live)}"`
          break
        default:
          log = `${node.data.label} ejecutado`
      }
    } catch (err) {
      status = 'error'
      log = `Error: ${err instanceof Error ? err.message : 'fallo'}`
    }

    logs.push({ nodeId: node.id, label: node.data.label, subType: node.data.subType, status, log })
    const nextEdge = node.data.subType === 'condition'
      ? graph.edges.find(e => e.source === node.id && e.sourceHandle === nextHandle)
      : graph.edges.find(e => e.source === node.id)
    current = nextEdge ? graph.nodes.find(n => n.id === nextEdge.target) : undefined
  }

  const hasError = logs.some(l => l.status === 'error')
  await supabase.from('flow_runs').insert({
    flow_id: flow.id, flow_name: flow.name, contact_id: contact.id,
    workspace_id: flow.workspace_id, status: hasError ? 'failed' : 'completed',
    triggered_by: 'webhook', node_logs: logs,
  })

  return logs
}

export const Route = createFileRoute('/api/webhooks/flow/$flowId')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { flowId } = params
        const supabase = createServerClient()

        const { data: flow, error: flowError } = await supabase
          .from('flows').select('id, name, workspace_id, graph, status').eq('id', flowId).single()

        if (flowError || !flow) {
          return new Response(JSON.stringify({ error: 'Flow not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
        }
        if (flow.status !== 'active') {
          return new Response(JSON.stringify({ error: 'Flow is not active' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }

        const graph = flow.graph as FlowGraph | null
        if (!graph?.nodes?.length || !graph.nodes.some(n => n.type === 'trigger' && n.data.subType === 'webhook')) {
          return new Response(JSON.stringify({ error: 'Flow has no webhook trigger' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }

        let body: Record<string, unknown> = {}
        try { body = await request.json() } catch { /* empty body */ }

        let contact: ContactRow | null = null
        const contactId = body.contact_id as string | undefined
        if (contactId) {
          const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single()
          if (data) contact = data as ContactRow
        }

        if (!contact) {
          contact = {
            id: `webhook-${Date.now()}`,
            first_name: (body.first_name as string) ?? 'Webhook',
            last_name: (body.last_name as string) ?? null,
            email: (body.email as string) ?? null,
            phone: (body.phone as string) ?? null,
            company: (body.company as string) ?? null,
            source: 'webhook', tags: [],
          }
        }

        try {
          const logs = await runFlowWebhook(graph, contact, { id: flow.id, name: flow.name, workspace_id: flow.workspace_id })
          return new Response(JSON.stringify({ success: true, logs_count: logs.length }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        } catch (err) {
          return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Execution failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
