import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Badge } from '../../../components/ui/badge'
import { Modal } from '../../../components/ui/modal'
import { listFlowsFn, createFlowFn, deleteFlowFn } from '../../../server/flows'
import type { Workspace } from '../../../lib/types'
import {
  Plus, Workflow, Trash2, ChevronRight, Zap,
  Search, Folder, FolderOpen, FolderPlus, X, Check,
} from 'lucide-react'
import { useLanguage } from '../../../lib/i18n'
import { cn } from '../../../lib/utils'

export const Route = createFileRoute('/_app/flows/')({
  component: FlowsPage,
})

type FlowStatus = 'draft' | 'active' | 'paused' | 'archived'

interface FlowSummary {
  id: string
  name: string
  description: string | null
  status: FlowStatus
  trigger_type: string | null
  updated_at: string
}

// ─── Storage keys ─────────────────────────────────────────
const FOLDER_NAMES_KEY = 'loomy_folder_names'   // string[]
const FOLDER_MAP_KEY   = 'loomy_flow_folders'    // Record<flowId, folderName>

function loadFolderNames(): string[] {
  try { return JSON.parse(localStorage.getItem(FOLDER_NAMES_KEY) ?? '[]') } catch { return [] }
}
function saveFolderNames(names: string[]) {
  localStorage.setItem(FOLDER_NAMES_KEY, JSON.stringify(names))
}
function loadFolderMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(FOLDER_MAP_KEY) ?? '{}') } catch { return {} }
}
function saveFolderMap(map: Record<string, string>) {
  localStorage.setItem(FOLDER_MAP_KEY, JSON.stringify(map))
}

// ─── Trigger labels ───────────────────────────────────────
const TRIGGER_LABELS: Record<string, string> = {
  contact_created:  'Contacto creado',
  contact_updated:  'Contacto actualizado',
  deal_changed:     'Deal cambiado',
  form_submitted:   'Formulario enviado',
  manual:           'Manual',
  subflow_start:    'Subflujo',
}

// ─── Folder selector (small popover on the card) ──────────
function FolderSelector({
  flowId,
  currentFolder,
  folderNames,
  onAssign,
  onRemove,
}: {
  flowId: string
  currentFolder: string | undefined
  folderNames: string[]
  onAssign: (flowId: string, name: string) => void
  onRemove: (flowId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (folderNames.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        className={cn(
          'flex items-center gap-1 text-[10px] transition-colors cursor-pointer',
          currentFolder ? 'text-purple-400' : 'text-[#3d4466] hover:text-[#6b7a99]'
        )}
        title="Mover a carpeta"
      >
        <Folder size={11} />
        <span className="truncate max-w-[80px]">{currentFolder ?? 'Sin carpeta'}</span>
      </button>

      {open && (
        <div
          className="absolute bottom-6 left-0 z-50 min-w-[160px] rounded-xl border border-[#1e1e38] bg-[#0e0e1c] shadow-xl py-1"
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
        >
          {currentFolder && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(flowId); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-[#6b7a99] hover:bg-[#111120] transition-colors text-left"
            >
              <X size={10} /> Quitar de carpeta
            </button>
          )}
          {folderNames.map(name => (
            <button
              key={name}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onAssign(flowId, name); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-[#d0d0f0] hover:bg-purple-500/10 transition-colors text-left"
            >
              <Folder size={11} className="text-purple-400 shrink-0" />
              <span className="flex-1 truncate">{name}</span>
              {currentFolder === name && <Check size={10} className="text-purple-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Flow card ────────────────────────────────────────────
function FlowCard({
  flow,
  statusConfig,
  currentFolder,
  folderNames,
  onAssign,
  onRemove,
  onDelete,
}: {
  flow: FlowSummary
  statusConfig: Record<FlowStatus, { variant: 'default' | 'success' | 'warning' | 'danger' | 'teal'; label: string }>
  currentFolder: string | undefined
  folderNames: string[]
  onAssign: (flowId: string, name: string) => void
  onRemove: (flowId: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  const s = statusConfig[flow.status]
  const triggerLabel = flow.trigger_type
    ? flow.trigger_type.split(',').map(t => TRIGGER_LABELS[t.trim()] ?? t.trim()).join(' · ')
    : null

  return (
    <Link
      to="/flows/$flowId"
      params={{ flowId: flow.id }}
      className="group relative rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] p-5 hover:border-purple-500/25 transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-purple-500/3 to-transparent pointer-events-none" />
      {flow.status === 'active' && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      )}

      {/* Header */}
      <div className="relative flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
            <Workflow size={17} className="text-purple-400" />
          </div>
          <Badge variant={s.variant} dot={flow.status === 'active'}>{s.label}</Badge>
        </div>
        <button
          onClick={e => onDelete(flow.id, e)}
          className="opacity-0 group-hover:opacity-100 transition-all text-[#3d4466] hover:text-red-400 cursor-pointer p-1 rounded"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Name + description */}
      <h3 className="relative font-semibold text-[#d0d0f0] group-hover:text-[#f0f0ff] transition-colors mb-1 text-sm truncate">
        {flow.name}
      </h3>
      {flow.description && (
        <p className="relative text-xs text-[#3d4466] line-clamp-2 mb-2">{flow.description}</p>
      )}

      {/* Footer */}
      <div className="relative flex items-center justify-between mt-auto pt-3 border-t border-[#1e1e38]">
        <div className="flex items-center gap-3 min-w-0">
          {triggerLabel ? (
            <span className="text-[10px] text-[#6b7a99] flex items-center gap-1.5 truncate">
              <Zap size={10} className="text-purple-400 shrink-0" /> {triggerLabel}
            </span>
          ) : (
            <span className="text-[10px] text-[#3d4466]">Sin disparador</span>
          )}
          <FolderSelector
            flowId={flow.id}
            currentFolder={currentFolder}
            folderNames={folderNames}
            onAssign={onAssign}
            onRemove={onRemove}
          />
        </div>
        <ChevronRight size={13} className="text-[#3d4466] group-hover:text-purple-400 transition-colors shrink-0" />
      </div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────
function FlowsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Flow creation modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  // Folder state
  const [folderNames, setFolderNames] = useState<string[]>([])
  const [folderMap, setFolderMap] = useState<Record<string, string>>({})
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  // Folder creation modal
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderInput, setFolderInput] = useState('')

  // Confirm delete folder modal
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<string | null>(null)

  // Confirm delete flow modal
  const [confirmDeleteFlowId, setConfirmDeleteFlowId] = useState<string | null>(null)

  const { t } = useLanguage()

  const statusConfig: Record<FlowStatus, { variant: 'default' | 'success' | 'warning' | 'danger' | 'teal'; label: string }> = {
    draft:    { variant: 'default',  label: t('status_draft') },
    active:   { variant: 'success',  label: t('status_active') },
    paused:   { variant: 'warning',  label: t('status_paused') },
    archived: { variant: 'danger',   label: t('status_archived') },
  }

  // Load data
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase.from('workspace_members').select('workspaces(*)').eq('user_id', user.id).limit(1).single()
      const ws = member?.workspaces as unknown as Workspace
      if (!ws) return
      setWorkspace(ws)
      setFlows((await listFlowsFn({ data: { workspaceId: ws.id } })) as FlowSummary[])
      setLoading(false)
    }
    load()
    setFolderNames(loadFolderNames())
    setFolderMap(loadFolderMap())
  }, [])

  // ─── Folder helpers ──────────────────────────────────────

  function createFolder() {
    const name = folderInput.trim()
    if (!name || folderNames.includes(name)) return
    const next = [...folderNames, name]
    setFolderNames(next)
    saveFolderNames(next)
    setShowFolderModal(false)
    setFolderInput('')
  }

  function deleteFolder(name: string) {
    const nextNames = folderNames.filter(n => n !== name)
    setFolderNames(nextNames)
    saveFolderNames(nextNames)
    const nextMap = { ...folderMap }
    for (const id of Object.keys(nextMap)) {
      if (nextMap[id] === name) delete nextMap[id]
    }
    setFolderMap(nextMap)
    saveFolderMap(nextMap)
    setConfirmDeleteFolder(null)
    setCollapsedFolders(prev => { const s = new Set(prev); s.delete(name); return s })
  }

  function assignFolder(flowId: string, name: string) {
    const next = { ...folderMap, [flowId]: name }
    setFolderMap(next)
    saveFolderMap(next)
  }

  function removeFromFolder(flowId: string) {
    const next = { ...folderMap }
    delete next[flowId]
    setFolderMap(next)
    saveFolderMap(next)
  }

  function toggleFolder(name: string) {
    setCollapsedFolders(prev => {
      const s = new Set(prev)
      s.has(name) ? s.delete(name) : s.add(name)
      return s
    })
  }

  // ─── Flow CRUD ───────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!workspace) return
    setSaving(true)
    const flow = await createFlowFn({ data: { workspace_id: workspace.id, ...form } })
    setFlows(prev => [flow as FlowSummary, ...prev])
    setShowCreateModal(false)
    setForm({ name: '', description: '' })
    setSaving(false)
  }

  async function confirmFlowDelete() {
    if (!confirmDeleteFlowId) return
    await deleteFlowFn({ data: { id: confirmDeleteFlowId } })
    setFlows(prev => prev.filter(f => f.id !== confirmDeleteFlowId))
    removeFromFolder(confirmDeleteFlowId)
    setConfirmDeleteFlowId(null)
  }

  // ─── Derived ─────────────────────────────────────────────

  const filtered = flows.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  const unassigned = filtered.filter(f => !folderMap[f.id])
  const grouped = Object.fromEntries(
    folderNames.map(name => [name, filtered.filter(f => folderMap[f.id] === name)])
  )

  const sharedCardProps = { statusConfig, folderNames, onAssign: assignFolder, onRemove: removeFromFolder, onDelete: (_id: string, e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteFlowId(_id) } }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 w-full" onClick={() => {}}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="text-xs font-medium text-purple-400 uppercase tracking-widest">{t('badge_automation')}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#f0f0ff] tracking-tight">{t('flows_title')}</h1>
          <p className="text-sm text-[#6b7a99] mt-1">{t('flows_sub')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setFolderInput(''); setShowFolderModal(true) }}>
            <FolderPlus size={14} strokeWidth={2} /> Nueva carpeta
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={14} strokeWidth={2.5} /> {t('new_flow')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3d4466]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar flujos..."
          className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-[#1e1e38] bg-[#0e0e1c] text-[#d0d0f0] placeholder-[#3d4466] focus:outline-none focus:border-purple-500/50 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3d4466] hover:text-[#6b7a99]">
            <X size={12} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && folderNames.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0e0e1c] border border-[#1e1e38] flex items-center justify-center">
            <Workflow size={28} className="text-[#2a2a4a]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#6b7a99]">{search ? 'Sin resultados' : t('no_flows')}</p>
            <p className="text-xs text-[#3d4466] mt-1 max-w-xs">{search ? `No se encontraron flujos para "${search}"` : t('no_flows_sub')}</p>
          </div>
          {!search && (
            <Button onClick={() => setShowCreateModal(true)} variant="outline" size="sm">
              <Plus size={13} /> {t('create_first_flow')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Carpetas */}
          {folderNames.map(name => {
            const folderFlows = grouped[name] ?? []
            const isCollapsed = collapsedFolders.has(name)
            return (
              <section key={name}>
                <div className="flex items-center gap-2 mb-3 group/folder">
                  <button
                    onClick={() => toggleFolder(name)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isCollapsed
                      ? <Folder size={15} className="text-purple-400 shrink-0" />
                      : <FolderOpen size={15} className="text-purple-400 shrink-0" />
                    }
                    <span className="font-semibold text-sm text-[#d0d0f0] truncate">{name}</span>
                    <span className="text-xs text-[#3d4466] shrink-0">{folderFlows.length} {folderFlows.length === 1 ? 'flujo' : 'flujos'}</span>
                    <ChevronRight size={13} className={cn('text-[#3d4466] transition-transform shrink-0', !isCollapsed && 'rotate-90')} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteFolder(name)}
                    className="opacity-0 group-hover/folder:opacity-100 transition-all text-[#3d4466] hover:text-red-400 cursor-pointer p-1 rounded shrink-0"
                    title="Eliminar carpeta"
                  >
                    <X size={13} />
                  </button>
                </div>
                {!isCollapsed && (
                  folderFlows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#1e1e38] py-8 text-center">
                      <p className="text-xs text-[#3d4466]">Carpeta vacía — asigna flujos usando el ícono <Folder size={11} className="inline" /> de cada tarjeta</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {folderFlows.map(flow => (
                        <FlowCard key={flow.id} flow={flow} currentFolder={folderMap[flow.id]} {...sharedCardProps} />
                      ))}
                    </div>
                  )
                )}
              </section>
            )
          })}

          {/* Sin carpeta */}
          {unassigned.length > 0 && (
            <section>
              {folderNames.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <Folder size={15} className="text-[#3d4466]" />
                  <span className="font-semibold text-sm text-[#6b7a99]">Sin carpeta</span>
                  <span className="text-xs text-[#3d4466]">{unassigned.length} {unassigned.length === 1 ? 'flujo' : 'flujos'}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassigned.map(flow => (
                  <FlowCard key={flow.id} flow={flow} currentFolder={undefined} {...sharedCardProps} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal: crear flow */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('modal_new_flow')} description={t('modal_flow_desc')} size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label={t('flow_name')} placeholder={t('ph_flow_name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label={t('flow_desc_label')} placeholder={t('ph_flow_desc')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-3 justify-end border-t border-[#1e1e38] pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>{t('cancel')}</Button>
            <Button type="submit" loading={saving}>{t('create_flow')}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: nueva carpeta */}
      <Modal open={showFolderModal} onClose={() => setShowFolderModal(false)} title="Nueva carpeta" description="Crea una carpeta para organizar tus flujos." size="sm">
        <form onSubmit={e => { e.preventDefault(); createFolder() }} className="space-y-4">
          <Input label="Nombre" placeholder="Ej. Marketing, Ventas…" value={folderInput} onChange={e => setFolderInput(e.target.value)} required />
          <div className="flex gap-3 justify-end border-t border-[#1e1e38] pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowFolderModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={!folderInput.trim()}>Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: confirmar borrar carpeta */}
      <Modal open={!!confirmDeleteFolder} onClose={() => setConfirmDeleteFolder(null)} title="Eliminar carpeta" description={`¿Eliminar la carpeta "${confirmDeleteFolder}"? Los flujos no se borrarán, solo se desasignarán.`} size="sm">
        <div className="flex gap-3 justify-end border-t border-[#1e1e38] pt-4">
          <Button variant="secondary" onClick={() => setConfirmDeleteFolder(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteFolder(confirmDeleteFolder!)}>Eliminar</Button>
        </div>
      </Modal>

      {/* Modal: confirmar borrar flow */}
      <Modal open={!!confirmDeleteFlowId} onClose={() => setConfirmDeleteFlowId(null)} title="Eliminar flujo" description="¿Estás seguro? Esta acción no se puede deshacer." size="sm">
        <div className="flex gap-3 justify-end border-t border-[#1e1e38] pt-4">
          <Button variant="secondary" onClick={() => setConfirmDeleteFlowId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmFlowDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
