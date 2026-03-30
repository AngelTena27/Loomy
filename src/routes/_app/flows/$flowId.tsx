import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ReactFlow, Background, Controls, ControlButton, addEdge,
  useNodesState, useEdgesState, useReactFlow,
  ReactFlowProvider, BackgroundVariant,
  Handle, Position,
  getBezierPath, BaseEdge, EdgeLabelRenderer,
  type Connection, type Edge, type Node, type NodeProps, type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { getFlowFn, saveFlowFn, createFlowRunFn, listFlowRunsByFlowFn, listFlowsFn } from '../../../server/flows'
import { listContactsFn, updateContactFn } from '../../../server/contacts'
import { listWorkspaceTagsFn } from '../../../server/tags'
import { sendWhatsAppMessageFn } from '../../../server/whatsapp'
import { createClient } from '../../../lib/supabase'
import type { Contact, Workspace, WorkspaceTag } from '../../../lib/types'
import {
  Zap, Mail, GitBranch, Clock, Database, ChevronLeft, Save,
  Play, Pause, Bell, Tag, User, X, CheckCircle2, AlertCircle,
  Loader2, FlaskConical, ChevronRight, Settings2, Trash2,
  UserCog, TrendingUp, AlarmClock, Plus, Check, Search, History, Wand2, Workflow,
  MessageCircle, Webhook, Copy,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { useLanguage } from '../../../lib/i18n'

export const Route = createFileRoute('/_app/flows/$flowId')({
  component: FlowEditorWrapper,
})

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface FlowNodeData {
  label: string
  description: string
  subType: string
  config: Record<string, string>
  testStatus?: 'idle' | 'running' | 'success' | 'error'
  testLog?: string
  [key: string]: unknown
}

type FlowNode = Node<FlowNodeData>

interface NodeRunLog {
  nodeId: string
  label: string
  subType: string
  status: 'success' | 'error'
  log: string
}

interface FlowRunRecord {
  id: string
  contact_id: string
  status: string
  triggered_by: string
  ran_at: string
  node_logs?: NodeRunLog[] | null
  contacts?: { first_name: string; last_name: string | null; email: string | null } | null
}

const NODE_COLORS: Record<string, { bg: string; border: string; icon: string; headerBg: string }> = {
  trigger:   { bg: '#1a1028', border: '#7c3aed', icon: 'text-purple-400',  headerBg: 'bg-purple-500/15' },
  action:    { bg: '#0d1f1f', border: '#0d9488', icon: 'text-teal-400',    headerBg: 'bg-teal-500/15' },
  condition: { bg: '#1c1708', border: '#d97706', icon: 'text-amber-400',   headerBg: 'bg-amber-500/15' },
  delay:     { bg: '#111118', border: '#6b7280', icon: 'text-gray-400',    headerBg: 'bg-gray-500/10' },
}

const STATUS_ICONS = {
  running: <Loader2 size={13} className="text-cyan-400 animate-spin" />,
  success: <CheckCircle2 size={13} className="text-emerald-400" />,
  error:   <AlertCircle size={13} className="text-red-400" />,
}

// ─────────────────────────────────────────────────────────
// Custom node component
// ─────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  contact_created: User, contact_updated: UserCog,
  deal_changed: TrendingUp, manual: Zap, form_submitted: Bell,
  webhook: Webhook,
  send_email: Mail, add_tag: Tag, remove_tag: Tag,
  create_deal: Database, update_contact: UserCog,
  send_whatsapp: MessageCircle,
  condition: GitBranch, wait: AlarmClock,
  call_subflow: Workflow,
  subflow_start: Play,
}

function FlowNodeComponent({ data, selected, type }: NodeProps<FlowNode>) {
  const nodeType = type as string
  const colors = NODE_COLORS[nodeType] ?? NODE_COLORS.action
  const Icon = ICON_MAP[data.subType] ?? Zap
  const isCondition = nodeType === 'condition'
  const isTrigger = nodeType === 'trigger'

  return (
    <div
      className="w-[240px] rounded-xl overflow-hidden transition-all"
      style={{
        background: colors.bg,
        border: `1.5px solid ${selected ? colors.border : '#2a2a3a'}`,
        boxShadow: selected ? `0 0 0 2px ${colors.border}40, 0 8px 32px rgba(0,0,0,0.4)` : '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Top handle (not on trigger) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !rounded-full !border-2 !border-[#2a2a3a] !bg-[#1a1a24]"
          style={{ top: -6 }}
        />
      )}

      {/* Header */}
      <div className={`${colors.headerBg} px-3 py-2.5 flex items-center gap-2.5 border-b border-white/5`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colors.headerBg}`}
          style={{ border: `1px solid ${colors.border}40` }}>
          <Icon size={14} className={colors.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#e0e0f0] truncate">{data.label}</p>
          {isTrigger && (
            <p className="text-[10px]" style={{ color: colors.border }}>Trigger</p>
          )}
        </div>
        {data.testStatus && data.testStatus !== 'idle' && (
          <div className="shrink-0">{STATUS_ICONS[data.testStatus]}</div>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <p className="text-[11px] text-[#6b7a99] leading-relaxed">{data.description}</p>
        {data.config && Object.entries(data.config).filter(([, v]) => v).length > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(data.config).filter(([, v]) => v).slice(0, 2).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-[9px] text-[#3d4466] uppercase tracking-wider w-14 shrink-0">{k.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-[#8892aa] truncate">{v as string}</span>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Bottom handle(s) */}
      {isCondition ? (
        <>
          <Handle type="source" position={Position.Bottom} id="true"
            className="!w-3 !h-3 !rounded-full !border-2 !bg-emerald-600 !border-emerald-400"
            style={{ bottom: -6, left: '35%' }} />
          <Handle type="source" position={Position.Bottom} id="false"
            className="!w-3 !h-3 !rounded-full !border-2 !bg-red-700 !border-red-500"
            style={{ bottom: -6, left: '65%' }} />
          <div className="flex justify-between px-4 pb-2 mt-1">
            <span className="text-[9px] text-emerald-500 font-medium">TRUE</span>
            <span className="text-[9px] text-red-500 font-medium">FALSE</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom}
          className="!w-3 !h-3 !rounded-full !border-2 !border-[#2a2a3a] !bg-[#1a1a24]"
          style={{ bottom: -6 }} />
      )}
    </div>
  )
}

const nodeTypes = {
  trigger:   FlowNodeComponent,
  action:    FlowNodeComponent,
  condition: FlowNodeComponent,
  delay:     FlowNodeComponent,
}

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }: EdgeProps) {
  const { setEdges } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          className="nodrag nopan"
        >
          <button
            onClick={() => setEdges(eds => eds.filter(e => e.id !== id))}
            className="w-5 h-5 rounded-full opacity-0 hover:opacity-100 bg-[#0d0d18] border border-[#2a2a3a] hover:border-red-500/50 hover:bg-red-500/10 flex items-center justify-center text-[#3d4466] hover:text-red-400 transition-all cursor-pointer"
          >
            <X size={9} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { deletable: DeletableEdge }

// ─────────────────────────────────────────────────────────
// Flow tag picker (with inline create)
// ─────────────────────────────────────────────────────────

const TAG_COLORS = ['#2dd4bf','#818cf8','#f472b6','#fb923c','#a3e635','#38bdf8','#e879f9','#facc15','#f87171','#34d399']

function FlowTagPicker({ selected, workspaceTags, workspace, onSelect, onTagCreated }: {
  selected: string
  workspaceTags: WorkspaceTag[]
  workspace: import('../../../lib/types').Workspace | null
  onSelect: (csv: string) => void
  onTagCreated: (tag: WorkspaceTag) => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#2dd4bf')
  const [saving, setSaving] = useState(false)

  const selectedSet = new Set(selected ? selected.split(',').filter(Boolean) : [])

  function toggle(name: string) {
    const next = new Set(selectedSet)
    next.has(name) ? next.delete(name) : next.add(name)
    onSelect(Array.from(next).join(','))
  }

  async function handleCreate() {
    if (!newName.trim() || !workspace) return
    setSaving(true)
    const { createWorkspaceTagFn } = await import('../../../server/tags')
    const tag = await createWorkspaceTagFn({ data: { workspace_id: workspace.id, name: newName.trim(), color: newColor } }) as WorkspaceTag
    onTagCreated(tag)
    toggle(tag.name)
    setNewName('')
    setNewColor('#2dd4bf')
    setCreating(false)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold text-[#6b7a99] uppercase tracking-wider">Etiquetas</label>
      <div className="flex flex-wrap gap-1.5">
        {workspaceTags.map(wt => {
          const isSelected = selectedSet.has(wt.name)
          return (
            <button key={wt.id} onClick={() => toggle(wt.name)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer"
              style={isSelected
                ? { background: `${wt.color}25`, borderColor: `${wt.color}60`, color: wt.color }
                : { background: '#0a0a12', borderColor: '#1e1e2e', color: '#6b7a99' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: wt.color }} />
              {wt.name}
              {isSelected && <X size={9} className="ml-0.5" />}
            </button>
          )
        })}
      </div>

      {!creating ? (
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-[10px] text-[#3d4466] hover:text-teal-400 transition-colors cursor-pointer mt-0.5">
          <Plus size={10} /> Nueva etiqueta
        </button>
      ) : (
        <div className="rounded-xl border border-[#1e1e2e] p-3 space-y-2.5" style={{ background: '#0a0a12' }}>
          <div className="flex gap-1.5 flex-wrap">
            {TAG_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className="w-4 h-4 rounded-full cursor-pointer border-2 transition-transform"
                style={{ background: c, borderColor: newColor === c ? '#fff' : 'transparent', transform: newColor === c ? 'scale(1.3)' : 'scale(1)' }}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Nombre..."
              className="flex-1 bg-[#111120] border border-[#1e1e2e] rounded-lg px-2 py-1 text-xs text-[#d0d8f0] placeholder-[#3d4466] outline-none focus:border-teal-500/40 min-w-0"
            />
            <button onClick={handleCreate} disabled={!newName.trim() || saving}
              className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
              style={{ background: newColor }}>
              {saving ? <Loader2 size={10} className="animate-spin text-[#07070f]" /> : <Check size={10} className="text-[#07070f]" />}
            </button>
            <button onClick={() => setCreating(false)} className="w-6 h-6 rounded-lg bg-[#1e1e2e] flex items-center justify-center text-[#6b7a99] cursor-pointer">
              <X size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Trigger outputs map
// ─────────────────────────────────────────────────────────

const TRIGGER_OUTPUTS: Record<string, Array<{ key: string; label: string }>> = {
  contact_created: [
    { key: 'id', label: 'ID' },
    { key: 'first_name', label: 'Nombre' },
    { key: 'last_name', label: 'Apellido' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'company', label: 'Empresa' },
    { key: 'source', label: 'Fuente' },
  ],
  contact_updated: [
    { key: 'id', label: 'ID' },
    { key: 'first_name', label: 'Nombre' },
    { key: 'last_name', label: 'Apellido' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'company', label: 'Empresa' },
    { key: 'source', label: 'Fuente' },
  ],
  form_submitted: [
    { key: 'id', label: 'ID' },
    { key: 'first_name', label: 'Nombre' },
    { key: 'last_name', label: 'Apellido' },
    { key: 'email', label: 'Email' },
  ],
  manual: [
    { key: 'id', label: 'ID' },
    { key: 'first_name', label: 'Nombre' },
    { key: 'last_name', label: 'Apellido' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'company', label: 'Empresa' },
  ],
  subflow_start: [
    { key: 'id', label: 'ID' },
    { key: 'first_name', label: 'Nombre' },
    { key: 'last_name', label: 'Apellido' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'company', label: 'Empresa' },
  ],
  webhook: [
    { key: 'contact_id', label: 'ID Contacto' },
    { key: 'first_name', label: 'Nombre' },
    { key: 'last_name', label: 'Apellido' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'payload', label: 'Payload' },
  ],
}

// ─────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────

function FlowEditor() {
  const { flowId } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [flowName, setFlowName] = useState('Untitled Flow')
  const [flowStatus, setFlowStatus] = useState<'draft' | 'active' | 'paused' | 'archived'>('draft')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [showTest, setShowTest] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTag[]>([])
  const [availableFlows, setAvailableFlows] = useState<Array<{ id: string; name: string }>>([])
  const [testContact, setTestContact] = useState<Contact | null>(null)
  const [testRunning, setTestRunning] = useState(false)
  const [testSearch, setTestSearch] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [historyRuns, setHistoryRuns] = useState<FlowRunRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const { toObject, setViewport, fitView, getNodes, getEdges } = useReactFlow()
  const idCounter = useRef(0)
  const clipboard = useRef<{ nodes: FlowNode[]; edges: Edge[] }>({ nodes: [], edges: [] })
  const [copyToast, setCopyToast] = useState<string | null>(null)

  // Palette defined inside component to use t()
  const palette = [
    {
      section: t('section_triggers'),
      color: 'text-purple-400',
      items: [
        { type: 'trigger', subType: 'contact_created',  label: t('node_contact_created'),  description: t('node_contact_created_desc'),  icon: User },
        { type: 'trigger', subType: 'contact_updated',  label: t('node_contact_updated'),  description: t('node_contact_updated_desc'),  icon: UserCog },
        { type: 'trigger', subType: 'deal_changed',     label: t('node_deal_changed'),     description: t('node_deal_changed_desc'),     icon: TrendingUp },
        { type: 'trigger', subType: 'form_submitted',   label: t('node_form_submitted'),   description: t('node_form_submitted_desc'),   icon: Bell },
        { type: 'trigger', subType: 'manual',           label: t('node_manual'),           description: t('node_manual_desc'),           icon: Zap },
        { type: 'trigger', subType: 'webhook',          label: 'Webhook',                  description: 'Se activa al recibir una petición HTTP externa',         icon: Webhook },
        { type: 'trigger', subType: 'subflow_start',    label: 'Inicio de subflujo',       description: 'Punto de entrada cuando este flujo es llamado por otro', icon: Play },
      ],
    },
    {
      section: t('section_actions'),
      color: 'text-teal-400',
      items: [
        { type: 'action', subType: 'send_email',     label: t('node_send_email'),     description: t('node_send_email_desc'),     icon: Mail },
        { type: 'action', subType: 'add_tag',        label: t('node_add_tag'),        description: t('node_add_tag_desc'),        icon: Tag },
        { type: 'action', subType: 'remove_tag',     label: t('node_remove_tag'),     description: t('node_remove_tag_desc'),     icon: Tag },
        { type: 'action', subType: 'create_deal',    label: t('node_create_deal'),    description: t('node_create_deal_desc'),    icon: Database },
        { type: 'action', subType: 'update_contact', label: t('node_update_contact'), description: t('node_update_contact_desc'), icon: UserCog },
        { type: 'action', subType: 'send_whatsapp',  label: 'Enviar WhatsApp',        description: 'Envía un mensaje de WhatsApp al contacto',          icon: MessageCircle },
        { type: 'action', subType: 'call_subflow',   label: 'Llamar subflujo',        description: 'Ejecuta otro flujo como subproceso',                icon: Workflow },
      ],
    },
    {
      section: t('section_logic'),
      color: 'text-amber-400',
      items: [
        { type: 'condition', subType: 'condition', label: t('node_condition'), description: t('node_condition_desc'), icon: GitBranch },
        { type: 'delay',     subType: 'wait',      label: t('node_wait'),      description: t('node_wait_desc'),      icon: AlarmClock },
      ],
    },
  ]

  // Config fields defined inside component to use t()
  const CONFIG_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string; type?: string; options?: string[] }>> = {
    send_email:     [
      { key: 'subject',   label: t('cfg_subject'),   placeholder: 'Welcome to {{workspace}}' },
      { key: 'body',      label: t('cfg_body'),      placeholder: 'Hi {{first_name}}, ...', type: 'textarea' },
      { key: 'from_name', label: t('cfg_from_name'), placeholder: 'Your name' },
    ],
    add_tag:        [{ key: 'tag', label: t('cfg_tag'), placeholder: 'e.g. hot-lead' }],
    remove_tag:     [{ key: 'tag', label: t('cfg_tag'), placeholder: 'e.g. cold-lead' }],
    create_deal:    [
      { key: 'name',  label: t('cfg_name'),  placeholder: '{{first_name}} — Deal' },
      { key: 'value', label: t('cfg_value'), placeholder: '1000', type: 'number' },
      { key: 'stage', label: t('cfg_stage'), placeholder: 'New' },
    ],
    update_contact: [
      { key: 'field', label: t('cfg_field'),     placeholder: 'company', options: ['company', 'phone', 'source', 'notes'] },
      { key: 'value', label: t('cfg_new_value'), placeholder: 'Acme Inc.' },
    ],
    condition:      [
      { key: 'field',    label: t('cfg_field'),    placeholder: 'email',    options: ['email', 'company', 'source', 'tags', 'phone'] },
      { key: 'operator', label: t('cfg_operator'), placeholder: 'contains', options: ['contains', 'equals', 'not_empty', 'is_empty', 'starts_with'] },
      { key: 'value',    label: t('cfg_value'),    placeholder: 'gmail.com' },
    ],
    wait:           [
      { key: 'amount', label: t('cfg_amount'), placeholder: '1', type: 'number' },
      { key: 'unit',   label: t('cfg_unit'),   placeholder: 'hours', options: ['minutes', 'hours', 'days'] },
    ],
    deal_changed:   [{ key: 'stage', label: t('cfg_target_stage'), placeholder: 'Won' }],
    send_whatsapp:  [
      { key: 'message', label: 'Mensaje', placeholder: 'Hola {{first_name}}, ...', type: 'textarea' },
    ],
    call_subflow:   [],   // selector custom, no usa CONFIG_FIELDS estándar
    webhook:        [],   // URL se muestra en panel especial
  }

  // Resuelve variables {{key}} con datos reales del contacto
  function resolveVars(template: string, contact: Contact): string {
    return (template ?? '')
      .replace(/\{\{first_name\}\}/gi, contact.first_name ?? '')
      .replace(/\{\{last_name\}\}/gi, contact.last_name ?? '')
      .replace(/\{\{email\}\}/gi, contact.email ?? '')
      .replace(/\{\{phone\}\}/gi, contact.phone ?? '')
      .replace(/\{\{company\}\}/gi, contact.company ?? '')
      .replace(/\{\{source\}\}/gi, contact.source ?? '')
      .replace(/\{\{id\}\}/gi, contact.id ?? '')
      .replace(/\{\{workspace\}\}/gi, workspace?.name ?? '')
  }

  function getContactField(field: string, contact: Contact): string {
    const map: Record<string, string> = {
      email: contact.email ?? '',
      company: contact.company ?? '',
      source: contact.source ?? '',
      phone: contact.phone ?? '',
      tags: (contact.tags ?? []).join(', '),
      first_name: contact.first_name ?? '',
      last_name: contact.last_name ?? '',
    }
    return map[field] ?? ''
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

  // Ejecuta un nodo y devuelve el log rico + contacto actualizado + branch para condiciones
  async function executeNode(node: FlowNode, contact: Contact): Promise<{ log: string; updatedContact?: Contact; nextHandle?: string }> {
    const c = node.data.config ?? {}

    switch (node.data.subType) {
      case 'contact_created':
      case 'contact_updated':
      case 'manual':
      case 'form_submitted':
      case 'subflow_start':
      case 'webhook': {
        const log = [
          `Contacto: ${contact.first_name} ${contact.last_name ?? ''}`,
          `ID: ${contact.id}`,
          `Email: ${contact.email || '—'}`,
          `Teléfono: ${contact.phone || '—'}`,
          `Empresa: ${contact.company || '—'}`,
          `Fuente: ${contact.source || '—'}`,
          `Etiquetas: ${contact.tags?.join(', ') || '—'}`,
        ].join('\n')
        return { log }
      }

      case 'add_tag': {
        if (!c.tag) return { log: '⚠️ Sin etiquetas configuradas' }
        const tagNames = c.tag.split(',').map((s: string) => s.trim()).filter(Boolean)
        const newTags = Array.from(new Set([...(contact.tags ?? []), ...tagNames]))
        const updated = await updateContactFn({ data: { id: contact.id, updates: { tags: newTags } } }) as Contact
        setContacts(prev => prev.map(x => x.id === updated.id ? updated : x))
        return {
          log: `Etiquetas añadidas: ${tagNames.join(', ')}\nEtiquetas ahora: ${newTags.join(', ')}`,
          updatedContact: updated,
        }
      }

      case 'remove_tag': {
        if (!c.tag) return { log: '⚠️ Sin etiquetas configuradas' }
        const tagNames = c.tag.split(',').map((s: string) => s.trim()).filter(Boolean)
        const newTags = (contact.tags ?? []).filter((t: string) => !tagNames.includes(t))
        const updated = await updateContactFn({ data: { id: contact.id, updates: { tags: newTags } } }) as Contact
        setContacts(prev => prev.map(x => x.id === updated.id ? updated : x))
        return {
          log: `Etiquetas quitadas: ${tagNames.join(', ')}\nEtiquetas ahora: ${newTags.join(', ') || '—'}`,
          updatedContact: updated,
        }
      }

      case 'update_contact': {
        if (!c.field) return { log: '⚠️ Campo no configurado' }
        const resolvedVal = resolveVars(c.value ?? '', contact)
        const updated = await updateContactFn({ data: { id: contact.id, updates: { [c.field]: resolvedVal } } }) as Contact
        setContacts(prev => prev.map(x => x.id === updated.id ? updated : x))
        return {
          log: `Campo actualizado:\n"${c.field}" = "${resolvedVal}"`,
          updatedContact: updated,
        }
      }

      case 'send_email': {
        const subject = resolveVars(c.subject ?? '(sin asunto)', contact)
        const body = resolveVars(c.body ?? '', contact)
        const preview = body.length > 100 ? body.slice(0, 100) + '…' : body
        return {
          log: `Para: ${contact.email || '—'}\nAsunto: ${subject}${preview ? `\nCuerpo: ${preview}` : ''}`,
        }
      }

      case 'send_whatsapp': {
        if (!c.message) return { log: '⚠️ Mensaje no configurado' }
        if (!contact.phone) return { log: '⚠️ El contacto no tiene número de teléfono' }
        const text = resolveVars(c.message, contact)
        if (!workspace) return { log: '⚠️ Sin workspace' }
        await sendWhatsAppMessageFn({ data: { workspaceId: workspace.id, contactId: contact.id, message: text } })
        const preview = text.length > 80 ? text.slice(0, 80) + '…' : text
        return { log: `WhatsApp enviado a ${contact.phone}\nMensaje: ${preview}` }
      }

      case 'condition': {
        const field = c.field ?? ''
        const operator = c.operator ?? 'contains'
        const compareVal = resolveVars(c.value ?? '', contact)
        const fieldVal = getContactField(field, contact)
        const result = evalCondition(fieldVal, operator, compareVal)
        return {
          log: `Campo: "${field}"\nValor actual: "${fieldVal}"\nOperador: ${operator}\nComparar con: "${compareVal}"\nResultado: ${result ? '✅ TRUE → rama verdadera' : '❌ FALSE → rama falsa'}`,
          nextHandle: result ? 'true' : 'false',
        }
      }

      case 'wait': {
        return { log: `Esperar: ${c.amount ?? '1'} ${c.unit ?? 'hora(s)'}\n(simulado, sin pausa real)` }
      }

      case 'create_deal': {
        const name = resolveVars(c.name ?? 'Deal', contact)
        return { log: `Deal (simulación)\nNombre: ${name}\nValor: $${c.value || '0'}\nEtapa: ${c.stage || 'New'}` }
      }

      case 'call_subflow': {
        if (!c.subflow_id) return { log: '⚠️ Sin subflujo seleccionado' }
        const subflowName = c.subflow_name ?? c.subflow_id
        try {
          const subflow = await getFlowFn({ data: { flowId: c.subflow_id } })
          if (!subflow) return { log: `⚠️ Subflujo "${subflowName}" no encontrado` }
          const graph = subflow.graph as { nodes: FlowNode[]; edges: Edge[] }
          // Prefer subflow_start; fall back to any trigger node
          const subTrigger = graph?.nodes?.find((n: FlowNode) => n.data.subType === 'subflow_start')
            ?? graph?.nodes?.find((n: FlowNode) => n.type === 'trigger')
          if (!subTrigger) return { log: `⚠️ Subflujo "${subflowName}" sin nodo de inicio` }
          // Ejecutar el subflujo inline, recorriendo su grafo
          let subCurrent: FlowNode | undefined = subTrigger
          const subVisited = new Set<string>()
          const subLogs: string[] = [`Subflujo: ${subflow.name}`]
          let subContact = contact
          while (subCurrent && !subVisited.has(subCurrent.id)) {
            subVisited.add(subCurrent.id)
            const res = await executeNode(subCurrent, subContact)
            subLogs.push(`  ↳ ${subCurrent.data.label}: ${res.log.split('\n')[0]}`)
            if (res.updatedContact) subContact = res.updatedContact
            const subEdge = subCurrent.data.subType === 'condition'
              ? graph.edges.find((e: Edge) => e.source === subCurrent!.id && (e as { sourceHandle?: string }).sourceHandle === res.nextHandle)
              : graph.edges.find((e: Edge) => e.source === subCurrent!.id)
            subCurrent = subEdge ? graph.nodes.find((n: FlowNode) => n.id === subEdge.target) : undefined
          }
          return { log: subLogs.join('\n'), updatedContact: subContact !== contact ? subContact : undefined }
        } catch {
          return { log: `⚠️ Error ejecutando subflujo "${subflowName}"` }
        }
      }

      default:
        return { log: `${node.data.label} ejecutado` }
    }
  }

  // Load flow + workspace/contacts
  useEffect(() => {
    async function load() {
      const flow = await getFlowFn({ data: { flowId } })
      setFlowName(flow.name)
      setFlowStatus(flow.status)
      const graph = flow.graph as { nodes: FlowNode[]; edges: Edge[]; viewport?: { x: number; y: number; zoom: number } }
      setNodes((graph?.nodes ?? []).map((n: FlowNode) => ({
        ...n,
        data: { ...n.data, testStatus: 'idle', testLog: undefined },
      })))
      setEdges(graph?.edges ?? [])
      if (graph?.viewport) setViewport(graph.viewport)
    }
    load()

    async function loadWorkspace() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase.from('workspace_members').select('workspaces(*)').eq('user_id', user.id).limit(1).single()
      const ws = member?.workspaces as unknown as Workspace
      if (!ws) return
      setWorkspace(ws)
      const [c, tags, flows] = await Promise.all([
        listContactsFn({ data: { workspaceId: ws.id } }),
        listWorkspaceTagsFn({ data: { workspaceId: ws.id } }),
        listFlowsFn({ data: { workspaceId: ws.id } }),
      ])
      setContacts(c as Contact[])
      setWorkspaceTags(tags as WorkspaceTag[])
      setAvailableFlows((flows as Array<{ id: string; name: string }>).filter(f => f.id !== flowId))
    }
    loadWorkspace()
  }, [flowId, setNodes, setEdges, setViewport])

  // Sync selectedNode when nodes change
  useEffect(() => {
    if (!selectedNode) return
    const updated = nodes.find(n => n.id === selectedNode.id)
    if (updated) setSelectedNode(updated)
  }, [nodes])

  // Copy / paste nodes with Cmd+C / Cmd+V (or Ctrl+C / Ctrl+V)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      // Ignore if focus is inside an input/textarea (user is typing)
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (mod && e.key === 'c') {
        const selected = getNodes().filter(n => n.selected)
        if (selected.length) {
          const selectedIds = new Set(selected.map(n => n.id))
          // Copy edges that connect two selected nodes
          const selectedEdges = getEdges().filter(
            e => selectedIds.has(e.source) && selectedIds.has(e.target)
          )
          clipboard.current = { nodes: selected, edges: selectedEdges }
          const count = selected.length
          setCopyToast(count === 1 ? '1 nodo copiado' : `${count} nodos copiados`)
          setTimeout(() => setCopyToast(null), 2000)
        }
      }
      if (mod && e.key === 'v') {
        if (!clipboard.current.nodes.length) return
        const OFFSET = 30
        const stamp = Date.now()
        // Build ID mapping: old id → new id
        const idMap: Record<string, string> = {}
        clipboard.current.nodes.forEach((n, i) => {
          idMap[n.id] = `${n.data.subType}-copy-${stamp}-${i}`
        })
        const newNodes = clipboard.current.nodes.map(n => ({
          ...n,
          id: idMap[n.id],
          selected: true,
          position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
          data: { ...n.data, testStatus: 'idle' as const, testLog: undefined },
        }))
        const newEdges = clipboard.current.edges.map((e, i) => ({
          ...e,
          id: `edge-copy-${stamp}-${i}`,
          source: idMap[e.source],
          target: idMap[e.target],
        }))
        setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), ...newNodes])
        setEdges(es => [...es, ...newEdges])
        // Update clipboard so repeated pastes keep offsetting
        clipboard.current = { nodes: newNodes, edges: newEdges }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [getNodes, getEdges, setNodes, setEdges])

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({
      ...params,
      type: 'deletable',
      animated: true,
      style: { stroke: '#2dd4bf', strokeWidth: 1.5 },
    }, eds))
  }, [setEdges])

  function onNodeClick(_: React.MouseEvent, node: FlowNode) {
    setSelectedNode(node)
  }

  function onPaneClick() {
    setSelectedNode(null)
  }

  // Drag & drop from palette
  function onDragStart(e: React.DragEvent, type: string, subType: string, label: string, description: string) {
    e.dataTransfer.setData('rf/type', type)
    e.dataTransfer.setData('rf/subType', subType)
    e.dataTransfer.setData('rf/label', label)
    e.dataTransfer.setData('rf/description', description)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const type = e.dataTransfer.getData('rf/type')
    const subType = e.dataTransfer.getData('rf/subType')
    const label = e.dataTransfer.getData('rf/label')
    const description = e.dataTransfer.getData('rf/description')
    if (!type) return

    const bounds = (e.target as Element).closest('.react-flow')?.getBoundingClientRect()
    if (!bounds) return
    idCounter.current += 1

    const newNode: FlowNode = {
      id: `${subType}-${Date.now()}-${idCounter.current}`,
      type,
      position: { x: e.clientX - bounds.left - 120, y: e.clientY - bounds.top - 40 },
      data: { label, description, subType, config: {} },
    }
    setNodes(ns => [...ns, newNode])
    setSelectedNode(newNode)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // Config panel update
  function updateNodeConfig(key: string, value: string) {
    if (!selectedNode) return
    const newConfig = { ...selectedNode.data.config, [key]: value }
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, config: newConfig } } : null)
    setNodes(ns => ns.map(n =>
      n.id === selectedNode.id
        ? { ...n, data: { ...n.data, config: newConfig } }
        : n
    ))
  }

  function deleteNode(id: string) {
    setNodes(ns => ns.filter(n => n.id !== id))
    setEdges(es => es.filter(e => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }

  // Save
  async function handleSave() {
    setSaving(true)
    const graph = toObject()
    await saveFlowFn({ data: { flowId, graph: graph as Parameters<typeof saveFlowFn>[0]['data']['graph'], name: flowName, status: flowStatus } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Activate toggle
  async function toggleActivate() {
    const next = flowStatus === 'active' ? 'paused' : 'active'
    setFlowStatus(next)
    const graph = toObject()
    await saveFlowFn({ data: { flowId, graph: graph as Parameters<typeof saveFlowFn>[0]['data']['graph'], status: next } })
  }

  // Test run — traversal inline con branching de condiciones
  async function runTest() {
    if (!testContact) return
    setTestRunning(true)
    setShowTest(false)

    const triggerNodes = nodes.filter(n => n.type === 'trigger')
    if (!triggerNodes.length) { setTestRunning(false); return }

    let liveContact = testContact
    const collectedLogs: NodeRunLog[] = []

    // Run each trigger chain sequentially
    for (const trigger of triggerNodes) {
      let current: FlowNode | undefined = trigger
      const visited = new Set<string>()

      while (current && !visited.has(current.id)) {
        visited.add(current.id)
        const node = current

        setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, testStatus: 'running', testLog: undefined } } : n))
        await new Promise(r => setTimeout(r, 800))

        let logLine = ''
        let errorLine: string | undefined
        let nextHandle: string | undefined

        try {
          const result = await executeNode(node, liveContact)
          logLine = result.log
          if (result.updatedContact) {
            liveContact = result.updatedContact
            setContacts(prev => prev.map(c => c.id === liveContact.id ? liveContact : c))
          }
          nextHandle = result.nextHandle
        } catch (err) {
          errorLine = `Error: ${err instanceof Error ? err.message : 'fallo al ejecutar'}`
        }

        const nodeStatus = errorLine ? 'error' : 'success'
        const nodeLog = errorLine ?? logLine
        collectedLogs.push({ nodeId: node.id, label: node.data.label, subType: node.data.subType, status: nodeStatus, log: nodeLog })

        setNodes(ns => ns.map(n => n.id === node.id ? {
          ...n,
          data: { ...n.data, testStatus: nodeStatus, testLog: nodeLog },
        } : n))
        await new Promise(r => setTimeout(r, 400))

        const nextEdge = node.data.subType === 'condition'
          ? edges.find(e => e.source === node.id && e.sourceHandle === nextHandle)
          : edges.find(e => e.source === node.id)
        current = nextEdge ? nodes.find(n => n.id === nextEdge.target) : undefined
      }
    }

    if (workspace && testContact) {
      const newRun = await createFlowRunFn({ data: {
        flow_id: flowId, flow_name: flowName,
        contact_id: testContact.id, workspace_id: workspace.id,
        triggered_by: 'test', node_logs: collectedLogs,
      } })
      // Añadir al historial local sin recargar
      const runRecord: FlowRunRecord = {
        ...(newRun as unknown as FlowRunRecord),
        node_logs: collectedLogs,
        contacts: {
          first_name: testContact.first_name,
          last_name: testContact.last_name ?? null,
          email: testContact.email ?? null,
        },
      }
      setHistoryRuns(prev => [runRecord, ...prev])
    }

    setTestRunning(false)
  }

  function resetTest() {
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, testStatus: 'idle', testLog: undefined } })))
    setTestContact(null)
  }

  // Auto-layout top-down con dagre manual
  function autoLayout() {
    const NODE_W = 240
    const NODE_H = 120
    const H_GAP = 60
    const V_GAP = 80

    if (nodes.length === 0) return

    // Asignar profundidad — triggers siempre en capa 0, BFS desde todos ellos
    const depthMap: Record<string, number> = {}
    const triggerList = nodes.filter(n => n.type === 'trigger')
    const seeds = triggerList.length > 0 ? triggerList : [nodes[0]]
    seeds.forEach(n => { depthMap[n.id] = 0 })
    const queue: Array<{ id: string; depth: number }> = seeds.map(n => ({ id: n.id, depth: 0 }))
    const visited = new Set<string>(seeds.map(n => n.id))

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!
      edges.filter(e => e.source === id).forEach(e => {
        if (!visited.has(e.target)) {
          visited.add(e.target)
          depthMap[e.target] = depth + 1
          queue.push({ id: e.target, depth: depth + 1 })
        }
      })
    }

    // Nodos no alcanzados: poner en la capa siguiente a la máxima
    const maxDepth = Math.max(0, ...Object.values(depthMap))
    nodes.filter(n => depthMap[n.id] === undefined).forEach(n => {
      depthMap[n.id] = maxDepth + 1
    })

    // Agrupar por capa
    const layers: Record<number, string[]> = {}
    nodes.forEach(n => {
      const d = depthMap[n.id] ?? 0
      if (!layers[d]) layers[d] = []
      layers[d].push(n.id)
    })

    // Calcular posiciones: centrar cada capa horizontalmente
    const posMap: Record<string, { x: number; y: number }> = {}
    Object.entries(layers).forEach(([depthStr, ids]) => {
      const depth = Number(depthStr)
      const totalW = ids.length * NODE_W + (ids.length - 1) * H_GAP
      const startX = -totalW / 2
      ids.forEach((id, i) => {
        posMap[id] = {
          x: startX + i * (NODE_W + H_GAP),
          y: depth * (NODE_H + V_GAP),
        }
      })
    })

    setNodes(ns => ns.map(n => posMap[n.id] ? { ...n, position: posMap[n.id] } : n))
    // Centrar la vista después del layout
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  }

  // Replay de un run histórico sobre el canvas (anima nodo por nodo)
  function showRunOnCanvas(run: FlowRunRecord) {
    const logs: NodeRunLog[] = (run.node_logs as NodeRunLog[] | null) ?? []
    // Construir mapa nodeId → log para aplicar de golpe
    const logMap = new Map(logs.map(l => [l.nodeId, l]))
    setNodes(ns => ns.map(n => {
      const entry = logMap.get(n.id)
      if (entry) return { ...n, data: { ...n.data, testStatus: entry.status, testLog: entry.log } }
      // Nodos que no participaron en este run → idle
      return { ...n, data: { ...n.data, testStatus: 'idle', testLog: undefined } }
    }))
    setShowHistory(false)
    setTimeout(() => fitView({ padding: 0.15, duration: 350 }), 50)
  }

  const statusColor = flowStatus === 'active' ? '#10b981' : flowStatus === 'paused' ? '#f59e0b' : '#6b7280'

  const statusLabel = flowStatus === 'active'
    ? t('status_active_low')
    : flowStatus === 'paused'
      ? t('status_paused_low')
      : t('status_draft_low')

  return (
    <div className="relative flex h-screen" style={{ background: '#0a0a12' }}>

      {/* ── Left palette ──────────────────── */}
      <div className="w-[200px] shrink-0 flex flex-col border-r border-[#1e1e2e] overflow-hidden" style={{ background: '#0d0d18' }}>
        <div className="px-4 py-3.5 border-b border-[#1e1e2e]">
          <button
            onClick={() => navigate({ to: '/flows' })}
            className="flex items-center gap-1.5 text-xs text-[#6b7a99] hover:text-[#c0c8e0] transition-colors cursor-pointer mb-3"
          >
            <ChevronLeft size={13} /> {t('back_to_flows')}
          </button>
          <p className="text-[10px] font-bold text-[#3d4466] uppercase tracking-widest">{t('nodes_label')}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {palette.map(({ section, color, items }) => (
            <div key={section}>
              <p className={`text-[9px] font-bold uppercase tracking-widest px-1 mb-2 ${color}`}>{section}</p>
              <div className="space-y-1.5">
                {items.map(item => (
                  <div
                    key={item.subType}
                    draggable
                    onDragStart={e => onDragStart(e, item.type, item.subType, item.label, item.description)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#1e1e2e] hover:border-[#2a2a3a] cursor-grab active:cursor-grabbing transition-all hover:bg-[#12121e]"
                    style={{ background: '#111120' }}
                  >
                    <item.icon size={12} className={color} />
                    <p className="text-xs font-medium text-[#9098b8]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Canvas area ───────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e2e] shrink-0" style={{ background: '#0d0d18' }}>
          <div className="flex items-center gap-3">
            <input
              value={flowName}
              onChange={e => setFlowName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-[#d0d8f0] focus:outline-none border-b border-transparent focus:border-teal-500/50 transition-colors w-48"
            />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: `${statusColor}15`, border: `1px solid ${statusColor}40`, color: statusColor }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor }} />
              {statusLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowTest(true); resetTest(); setTestSearch('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8892aa] hover:text-[#d0d8f0] border border-[#1e1e2e] hover:border-[#2a2a3a] transition-all cursor-pointer"
              style={{ background: '#111120' }}
            >
              <FlaskConical size={13} /> {t('test')}
            </button>
            <button
              onClick={() => {
                setShowHistory(true)
                setExpandedRunId(null)
                setLoadingHistory(true)
                listFlowRunsByFlowFn({ data: { flowId } })
                  .then(runs => setHistoryRuns((runs as unknown) as FlowRunRecord[]))
                  .catch(() => {})
                  .finally(() => setLoadingHistory(false))
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8892aa] hover:text-[#d0d8f0] border border-[#1e1e2e] hover:border-[#2a2a3a] transition-all cursor-pointer"
              style={{ background: '#111120' }}
            >
              <History size={13} /> Historial
            </button>
            <button
              onClick={toggleActivate}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                flowStatus === 'active'
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
              )}
            >
              {flowStatus === 'active' ? <><Pause size={12} /> {t('pause')}</> : <><Play size={12} /> {t('activate')}</>}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/15 border border-teal-500/30 text-teal-400 hover:bg-teal-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saved ? t('saved') : t('save')}
            </button>
          </div>
        </div>

        {/* React Flow */}
        <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKeyCode={['Delete', 'Backspace']}
            multiSelectionKeyCode="Shift"
            selectionOnDrag
            style={{ background: '#0a0a12' }}
            defaultEdgeOptions={{
              type: 'deletable',
              animated: true,
              style: { stroke: '#2dd4bf55', strokeWidth: 1.5 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a1a2a" />
            <Controls
              style={{ background: '#111120', border: '1px solid #1e1e2e', borderRadius: 10 }}
              showInteractive={false}
            >
              <ControlButton onClick={autoLayout} title="Ordenar nodos">
                <Wand2 size={12} />
              </ControlButton>
            </Controls>
          </ReactFlow>

          {/* Copy toast */}
          {copyToast && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-teal-300 border border-teal-500/30 pointer-events-none z-50 shadow-lg" style={{ background: '#0d1f1d' }}>
              <Check size={12} className="text-teal-400" />
              {copyToast}
            </div>
          )}

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#111120] border border-[#1e1e2e] flex items-center justify-center mx-auto mb-4">
                  <Zap size={22} className="text-[#2a2a3a]" />
                </div>
                <p className="text-sm font-medium text-[#3d4466]">{t('drag_hint')}</p>
                <p className="text-xs text-[#2a2a3a] mt-1">{t('drag_hint_sub')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right config panel ────────────── */}
      {selectedNode && (
        <div className="w-[280px] shrink-0 flex flex-col border-l border-[#1e1e2e] overflow-hidden" style={{ background: '#0d0d18' }}>
          <div className="px-4 py-3.5 border-b border-[#1e1e2e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 size={13} className="text-[#6b7a99]" />
              <p className="text-xs font-semibold text-[#c0c8e0]">{t('configure_node')}</p>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-[#3d4466] hover:text-[#8892aa] cursor-pointer transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Node info */}
            <div className="rounded-xl border border-[#1e1e2e] p-3" style={{ background: '#111120' }}>
              <p className="text-xs font-semibold text-[#d0d8f0]">{selectedNode.data.label}</p>
              <p className="text-[11px] text-[#6b7a99] mt-0.5">{selectedNode.data.description}</p>
            </div>

            {/* Tag picker for add_tag / remove_tag */}
            {(selectedNode.data.subType === 'add_tag' || selectedNode.data.subType === 'remove_tag') && (
              <FlowTagPicker
                selected={selectedNode.data.config?.tag ?? ''}
                workspaceTags={workspaceTags}
                workspace={workspace}
                onSelect={(name) => updateNodeConfig('tag', name)}
                onTagCreated={(tag) => setWorkspaceTags(prev => [...prev, tag])}
              />
            )}

            {/* Config fields for everything else */}
            {(selectedNode.data.subType !== 'add_tag' && selectedNode.data.subType !== 'remove_tag') &&
              (CONFIG_FIELDS[selectedNode.data.subType] ?? []).map(field => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-[#6b7a99] uppercase tracking-wider">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={4}
                      placeholder={field.placeholder}
                      value={selectedNode.data.config?.[field.key] ?? ''}
                      onChange={e => updateNodeConfig(field.key, e.target.value)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        const variable = e.dataTransfer.getData('variable')
                        if (!variable) return
                        const target = e.target as HTMLTextAreaElement
                        const start = target.selectionStart ?? target.value.length
                        const end = target.selectionEnd ?? target.value.length
                        const current = selectedNode.data.config?.[field.key] ?? ''
                        updateNodeConfig(field.key, current.slice(0, start) + variable + current.slice(end))
                      }}
                      className="w-full rounded-lg px-3 py-2 text-xs text-[#d0d8f0] placeholder-[#3d4466] border border-[#1e1e2e] bg-[#0a0a12] focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 transition-all resize-none"
                    />
                  ) : field.options ? (
                    <select
                      value={selectedNode.data.config?.[field.key] ?? ''}
                      onChange={e => updateNodeConfig(field.key, e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-xs text-[#d0d8f0] border border-[#1e1e2e] bg-[#0a0a12] focus:outline-none focus:border-teal-500/40 transition-all"
                    >
                      <option value="">{field.placeholder}</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      placeholder={field.placeholder}
                      value={selectedNode.data.config?.[field.key] ?? ''}
                      onChange={e => updateNodeConfig(field.key, e.target.value)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        const variable = e.dataTransfer.getData('variable')
                        if (!variable) return
                        const target = e.target as HTMLInputElement
                        const start = target.selectionStart ?? target.value.length
                        const end = target.selectionEnd ?? target.value.length
                        const current = selectedNode.data.config?.[field.key] ?? ''
                        updateNodeConfig(field.key, current.slice(0, start) + variable + current.slice(end))
                      }}
                      className="w-full rounded-lg px-3 py-2 text-xs text-[#d0d8f0] placeholder-[#3d4466] border border-[#1e1e2e] bg-[#0a0a12] focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 transition-all"
                    />
                  )}
                </div>
              ))
            }

            {/* Subflow selector for call_subflow */}
            {selectedNode.data.subType === 'call_subflow' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-[#6b7a99] uppercase tracking-wider">Subflujo a ejecutar</label>
                <select
                  value={selectedNode.data.config?.subflow_id ?? ''}
                  onChange={e => {
                    if (!selectedNode) return
                    const selected = availableFlows.find(f => f.id === e.target.value)
                    const newConfig = {
                      ...selectedNode.data.config,
                      subflow_id: e.target.value,
                      subflow_name: selected?.name ?? '',
                    }
                    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, config: newConfig } } : null)
                    setNodes(ns => ns.map(n =>
                      n.id === selectedNode.id ? { ...n, data: { ...n.data, config: newConfig } } : n
                    ))
                  }}
                  className="w-full rounded-lg px-3 py-2 text-xs text-[#d0d8f0] border border-[#1e1e2e] bg-[#0a0a12] focus:outline-none focus:border-teal-500/40 transition-all"
                >
                  <option value="">— Seleccionar subflujo —</option>
                  {availableFlows.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {availableFlows.length === 0 && (
                  <p className="text-[11px] text-[#3d4466] italic">No hay otros flujos disponibles.</p>
                )}
              </div>
            )}

            {/* Webhook URL panel */}
            {selectedNode.data.subType === 'webhook' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-[#6b7a99] uppercase tracking-wider">URL del Webhook</label>
                <div className="rounded-lg border border-[#1e1e2e] bg-[#0a0a12] px-3 py-2 flex items-center gap-2">
                  <code className="flex-1 text-[10px] text-teal-300 font-mono break-all leading-relaxed select-all">
                    {`${globalThis.location?.origin ?? ''}/api/webhooks/flow/${flowId}`}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${globalThis.location?.origin ?? ''}/api/webhooks/flow/${flowId}`)}
                    className="shrink-0 text-[#3d4466] hover:text-teal-400 transition-colors cursor-pointer"
                    title="Copiar URL"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-[#3d4466] leading-relaxed">
                  Realiza un <span className="text-[#6b7a99]">POST</span> a esta URL con JSON. Incluye <code className="text-teal-400/70">contact_id</code> para asociar un contacto existente.
                </p>
              </div>
            )}

            {(CONFIG_FIELDS[selectedNode.data.subType] ?? []).length === 0 && selectedNode.data.subType !== 'call_subflow' && selectedNode.data.subType !== 'webhook' && (
              <p className="text-xs text-[#3d4466] italic">This node has no configuration options.</p>
            )}

            {/* Resultado del test */}
            {selectedNode.data.testLog && (
              <div className="rounded-xl border border-emerald-500/25 overflow-hidden">
                <div className="px-3 py-2 border-b border-emerald-500/15 flex items-center gap-2" style={{ background: '#071210' }}>
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Resultado</p>
                </div>
                <div className="px-3 py-2.5" style={{ background: '#060f0d' }}>
                  <p className="text-[11px] text-emerald-300/80 font-mono leading-relaxed whitespace-pre-wrap">{selectedNode.data.testLog}</p>
                </div>
              </div>
            )}

            {/* Datos del trigger / Variables arrastrables */}
            {(() => {
              // Prefer subflow_start; fall back to first trigger for variable outputs
              const triggerNode = nodes.find(n => n.data.subType === 'subflow_start')
                ?? nodes.find(n => n.type === 'trigger')
              const outputs = triggerNode ? (TRIGGER_OUTPUTS[triggerNode.data.subType] ?? []) : []
              return (
                <div className="rounded-xl border border-[#1e1e2e] p-3" style={{ background: '#0a0a12' }}>
                  <p className="text-[9px] font-bold text-[#3d4466] uppercase tracking-wider mb-2">
                    {triggerNode ? `Datos de "${triggerNode.data.label}"` : 'Variables disponibles'}
                  </p>
                  <p className="text-[9px] text-[#2a2a3a] mb-2">Arrastra al campo destino</p>
                  <div className="flex flex-wrap gap-1">
                    {outputs.length > 0
                      ? outputs.map(f => (
                          <div
                            key={f.key}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('variable', `{{${f.key}}}`)
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#111120] border border-[#1e1e2e] text-[9px] text-[#6b7a99] font-mono cursor-grab active:cursor-grabbing hover:border-teal-500/30 hover:text-teal-400 transition-all select-none"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500/50 shrink-0" />
                            {f.label}
                          </div>
                        ))
                      : ['{{first_name}}', '{{last_name}}', '{{email}}', '{{company}}', '{{workspace}}'].map(v => (
                          <div
                            key={v}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('variable', v)
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111120] border border-[#1e1e2e] text-[9px] text-[#6b7a99] font-mono cursor-grab active:cursor-grabbing hover:border-teal-500/30 hover:text-teal-400 transition-all select-none"
                          >
                            {v}
                          </div>
                        ))
                    }
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Delete node */}
          <div className="p-4 border-t border-[#1e1e2e]">
            <button
              onClick={() => deleteNode(selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <Trash2 size={12} /> {t('delete_node')}
            </button>
          </div>
        </div>
      )}

      {/* ── Test modal ────────────── */}
      {showTest && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => { setShowTest(false); resetTest() }}
        >
          <div
            className="w-[400px] rounded-2xl border border-[#1e1e2e] overflow-hidden shadow-2xl flex flex-col"
            style={{ background: '#0d0d18', maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FlaskConical size={14} className="text-teal-400" />
                <p className="text-sm font-semibold text-[#d0d8f0]">{t('test_flow')}</p>
              </div>
              <button onClick={() => { setShowTest(false); resetTest() }} className="text-[#3d4466] hover:text-[#8892aa] cursor-pointer">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 flex flex-col">
              <p className="text-[10px] font-bold text-[#6b7a99] uppercase tracking-wider shrink-0">{t('pick_contact')}</p>

              <div className="relative shrink-0">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3d4466]" />
                <input
                  type="text"
                  value={testSearch}
                  onChange={e => setTestSearch(e.target.value)}
                  placeholder="Buscar contacto..."
                  className="w-full bg-[#111120] border border-[#1e1e2e] rounded-lg pl-8 pr-3 py-2 text-xs text-[#d0d8f0] placeholder-[#3d4466] focus:outline-none focus:border-teal-500/40 transition-all"
                />
              </div>

              <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0 max-h-52">
                {(() => {
                  const filtered = contacts.filter(c =>
                    `${c.first_name} ${c.last_name ?? ''} ${c.email ?? ''}`.toLowerCase().includes(testSearch.toLowerCase())
                  )
                  if (contacts.length === 0) return <p className="text-xs text-[#3d4466]">{t('no_contacts_test')}</p>
                  if (filtered.length === 0) return <p className="text-xs text-[#3d4466]">Sin resultados para "{testSearch}"</p>
                  return filtered.map(c => (
                    <button key={c.id} onClick={() => setTestContact(c)}
                      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer',
                        testContact?.id === c.id
                          ? 'border-teal-500/50 bg-teal-500/10'
                          : 'border-[#1e1e2e] bg-[#111120] hover:border-[#2a2a3a]'
                      )}>
                      <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-400 shrink-0">
                        {c.first_name[0]}{c.last_name?.[0] ?? ''}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#c0c8e0] truncate">{c.first_name} {c.last_name}</p>
                        {c.email && <p className="text-[10px] text-[#6b7a99] truncate">{c.email}</p>}
                      </div>
                      {testContact?.id === c.id && <CheckCircle2 size={14} className="text-teal-400 shrink-0" />}
                    </button>
                  ))
                })()}
              </div>

              <button onClick={runTest} disabled={!testContact || testRunning || nodes.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{ background: 'linear-gradient(135deg,#2dd4bf,#0d9488)', boxShadow: '0 0 20px rgba(45,212,191,0.15)' }}>
                <Play size={14} className="text-[#07070f]" />
                <span className="text-[#07070f]">{t('run_test')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel de historial ────────────── */}
      {showHistory && (
        <div
          className="absolute inset-0 z-40 flex items-end justify-end"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => { setShowHistory(false); setExpandedRunId(null) }}
        >
          <div
            className="h-full flex flex-col border-l border-[#1e1e2e] shadow-2xl"
            style={{ width: 380, background: '#0d0d18' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History size={14} className="text-teal-400" />
                <p className="text-sm font-semibold text-[#d0d8f0]">Historial de ejecuciones</p>
                {historyRuns.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#1e1e3a] text-[#6b7a99]">{historyRuns.length}</span>
                )}
              </div>
              <button onClick={() => { setShowHistory(false); setExpandedRunId(null) }} className="text-[#3d4466] hover:text-[#8892aa] cursor-pointer">
                <X size={14} />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={18} className="animate-spin text-teal-500/50" />
                </div>
              ) : historyRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#111120] border border-[#1e1e2e] flex items-center justify-center">
                    <History size={20} className="text-[#2a2a4a]" />
                  </div>
                  <p className="text-xs text-[#6b7a99]">Sin ejecuciones registradas</p>
                  <p className="text-[10px] text-[#3d4466]">Prueba el flujo para ver el historial aquí</p>
                </div>
              ) : (
                <div className="divide-y divide-[#0f0f1e]">
                  {historyRuns.map(run => {
                    const contact = Array.isArray(run.contacts) ? (run.contacts as unknown as FlowRunRecord['contacts'][])[0] : run.contacts
                    const name = contact ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : `Contacto ${run.contact_id.slice(0, 6)}`
                    const initials = contact ? `${contact.first_name[0]}${contact.last_name?.[0] ?? ''}`.toUpperCase() : '?'
                    const date = new Date(run.ran_at)
                    const dateStr = date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                    const timeStr = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                    const logs: NodeRunLog[] = (run.node_logs as NodeRunLog[] | null) ?? []
                    const hasError = logs.some(l => l.status === 'error')

                    return (
                      <button
                        key={run.id}
                        onClick={() => showRunOnCanvas(run)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#0f0f1c] transition-colors text-left cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-400 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#c0c8e0] truncate group-hover:text-teal-400 transition-colors">{name}</p>
                          {contact?.email && <p className="text-[10px] text-[#6b7a99] truncate">{contact.email}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-[#6b7a99]">{dateStr}</p>
                          <p className="text-[10px] text-[#3d4466]">{timeStr}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className={cn('w-1.5 h-1.5 rounded-full', hasError ? 'bg-red-500' : 'bg-emerald-500')} />
                          <Play size={11} className="text-[#3d4466] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FlowEditorWrapper() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  )
}
