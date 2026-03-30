import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Settings, Shield, Bell, Palette, Plug, Globe, Plus, Trash2, ChevronDown, ChevronRight, Loader2, FolderOpen, X, Tag, Smartphone, CheckCircle2, WifiOff } from 'lucide-react'
import { useLanguage } from '../../lib/i18n'
import type { Lang } from '../../lib/i18n'
import type { ContactFieldGroup, ContactField, WorkspaceTag } from '../../lib/types'
import { createClient } from '../../lib/supabase'
import { listFieldGroupsFn, createFieldGroupFn, deleteFieldGroupFn, createFieldFn, deleteFieldFn } from '../../server/contacts'
import { listWorkspaceTagsFn, createWorkspaceTagFn, deleteWorkspaceTagFn } from '../../server/tags'
import { connectWhatsAppFn, getWhatsAppStatusFn, disconnectWhatsAppFn } from '../../server/whatsapp'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

const FIELD_TYPES = ['text', 'number', 'date', 'url', 'phone', 'select'] as const
type FieldType = typeof FIELD_TYPES[number]

function FieldTypeLabel({ type, t }: { type: FieldType; t: (k: string) => string }) {
  const colors: Record<FieldType, string> = {
    text: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    number: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    date: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    url: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    phone: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    select: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[type]}`}>
      {t(`field_type_${type}`)}
    </span>
  )
}

function GroupCard({
  group, workspaceId, onDelete, onFieldAdded, onFieldDeleted, t,
}: {
  group: ContactFieldGroup
  workspaceId: string
  onDelete: () => void
  onFieldAdded: (field: ContactField) => void
  onFieldDeleted: (fieldId: string) => void
  t: (k: string) => string
}) {
  const [open, setOpen] = useState(true)
  const [showAddField, setShowAddField] = useState(false)
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [saving, setSaving] = useState(false)

  async function handleAddField() {
    if (!fieldName.trim()) return
    setSaving(true)
    const field = await createFieldFn({ data: { group_id: group.id, workspace_id: workspaceId, name: fieldName.trim(), field_type: fieldType } })
    onFieldAdded(field as ContactField)
    setFieldName('')
    setFieldType('text')
    setShowAddField(false)
    setSaving(false)
  }

  async function handleDeleteField(id: string) {
    if (!confirm(t('confirm_delete_field'))) return
    await deleteFieldFn({ data: { id } })
    onFieldDeleted(id)
  }

  return (
    <div className="rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e38]">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 flex-1 text-left cursor-pointer group">
          <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
            <FolderOpen size={13} className="text-teal-400" />
          </div>
          <span className="text-sm font-semibold text-[#d0d0f0] group-hover:text-teal-400 transition-colors">{group.name}</span>
          <span className="text-[10px] text-[#3d4466]">({group.contact_fields.length})</span>
          {open ? <ChevronDown size={13} className="text-[#3d4466] ml-auto" /> : <ChevronRight size={13} className="text-[#3d4466] ml-auto" />}
        </button>
        <button onClick={onDelete} className="w-6 h-6 rounded-md flex items-center justify-center text-[#3d4466] hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer shrink-0">
          <Trash2 size={12} />
        </button>
      </div>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {group.contact_fields.length === 0 && !showAddField && (
            <p className="text-xs text-[#3d4466] py-1">{t('no_fields_in_group')}</p>
          )}

          {/* Fields list */}
          {group.contact_fields.map(field => (
            <div key={field.id} className="flex items-center gap-2 group py-1">
              <span className="text-sm text-[#d0d0f0] flex-1">{field.name}</span>
              <FieldTypeLabel type={field.field_type} t={t} />
              <button onClick={() => handleDeleteField(field.id)} className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-[#3d4466] hover:text-red-400 transition-all cursor-pointer shrink-0">
                <X size={11} />
              </button>
            </div>
          ))}

          {/* Add field form */}
          {showAddField ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                autoFocus
                value={fieldName}
                onChange={e => setFieldName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddField(); if (e.key === 'Escape') setShowAddField(false) }}
                placeholder={t('ph_field_name')}
                className="flex-1 bg-[#0a0a17] border border-[#1e1e38] rounded-lg px-2.5 py-1.5 text-sm text-[#f0f0ff] placeholder-[#3d4466] outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/10"
              />
              <select
                value={fieldType}
                onChange={e => setFieldType(e.target.value as FieldType)}
                className="bg-[#0a0a17] border border-[#1e1e38] rounded-lg px-2 py-1.5 text-xs text-[#d0d0f0] outline-none focus:border-teal-500/40 cursor-pointer"
              >
                {FIELD_TYPES.map(ft => (
                  <option key={ft} value={ft}>{t(`field_type_${ft}`)}</option>
                ))}
              </select>
              <button onClick={handleAddField} disabled={!fieldName.trim() || saving}
                className="w-7 h-7 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 flex items-center justify-center text-teal-400 transition-colors cursor-pointer disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
              <button onClick={() => setShowAddField(false)} className="w-7 h-7 rounded-lg bg-[#151528] hover:bg-[#1e1e38] flex items-center justify-center text-[#6b7a99] transition-colors cursor-pointer">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddField(true)}
              className="flex items-center gap-1.5 text-xs text-[#3d4466] hover:text-teal-400 transition-colors cursor-pointer py-1 mt-1"
            >
              <Plus size={12} />
              {t('add_field')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function WhatsAppSection({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [qrBase64, setQrBase64] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    getWhatsAppStatusFn({ data: { workspaceId } }).then(instance => {
      if (!instance) return
      setStatus(instance.status as typeof status)
      setPhoneNumber(instance.phone_number ?? null)
      if (instance.qr_code) setQrBase64(instance.qr_code)
      if (instance.status === 'connecting') startPolling()
    })
  }, [workspaceId])

  function startPolling() {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const instance = await getWhatsAppStatusFn({ data: { workspaceId } })
      if (!instance) { stopPolling(); return }
      setStatus(instance.status as typeof status)
      setPhoneNumber(instance.phone_number ?? null)
      if (instance.qr_code) setQrBase64(instance.qr_code)
      if (instance.status === 'connected') {
        setQrBase64(null)
        stopPolling()
      }
    }, 2000)
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  async function handleConnect() {
    setConnecting(true)
    setStatus('connecting')
    setQrBase64(null)
    try {
      const result = await connectWhatsAppFn({ data: { workspaceId } })
      if (result.qr) setQrBase64(result.qr)
      startPolling()
    } catch {
      setStatus('disconnected')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    stopPolling()
    setDisconnecting(true)
    try {
      await disconnectWhatsAppFn({ data: { workspaceId } })
    } finally {
      setStatus('disconnected')
      setPhoneNumber(null)
      setQrBase64(null)
      setDisconnecting(false)
    }
  }

  const isConnecting = status === 'connecting'
  const isConnected = status === 'connected'

  return (
    <div className="rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e38]">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${isConnected ? 'bg-green-500/10 border-green-500/20' : isConnecting ? 'bg-amber-500/10 border-amber-500/20' : 'bg-[#1a1a30] border-[#1e1e38]'}`}>
            <Smartphone size={16} className={isConnected ? 'text-green-400' : isConnecting ? 'text-amber-400' : 'text-[#3d4466]'} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#d0d0f0]">WhatsApp</h3>
            <p className="text-xs text-[#3d4466]">Evolution API</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 size={13} /> {phoneNumber ?? 'Conectado'}
            </span>
          )}
          {!isConnected && !isConnecting && (
            <span className="flex items-center gap-1.5 text-xs text-[#3d4466]">
              <WifiOff size={13} /> Desconectado
            </span>
          )}
          {isConnecting && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 size={13} className="animate-spin" />
              {qrBase64 ? 'Escanea el QR' : 'Generando QR...'}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {isConnected ? (
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/20 text-red-400 text-sm hover:bg-red-500/5 transition-colors cursor-pointer disabled:opacity-50">
            {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <WifiOff size={13} />}
            Desconectar
          </button>
        ) : isConnecting ? (
          <div className="flex flex-col items-center gap-4">
            {qrBase64 ? (
              <>
                <div className="p-3 bg-white rounded-2xl shadow-lg">
                  <img src={qrBase64} alt="QR WhatsApp" className="w-48 h-48" />
                </div>
                <p className="text-xs text-[#6b7a99] text-center">
                  Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Loader2 size={22} className="text-amber-400 animate-spin" />
                </div>
                <p className="text-sm text-[#6b7a99]">Generando código QR...</p>
                <p className="text-xs text-[#3d4466]">Puede tomar unos segundos</p>
              </div>
            )}
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="text-xs text-[#3d4466] hover:text-red-400 cursor-pointer transition-colors flex items-center gap-1">
              {disconnecting ? <Loader2 size={11} className="animate-spin" /> : null}
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={handleConnect} disabled={connecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#07070f] cursor-pointer disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}>
            {connecting ? <Loader2 size={13} className="animate-spin text-[#07070f]" /> : <Smartphone size={13} />}
            {connecting ? 'Conectando...' : 'Conectar WhatsApp'}
          </button>
        )}
      </div>
    </div>
  )
}

function SettingsPage() {
  const { t, lang, setLang } = useLanguage()
  const [workspaceId, setWorkspaceId] = useState('')
  const [groups, setGroups] = useState<ContactFieldGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)
  // Tags
  const [tags, setTags] = useState<WorkspaceTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#2dd4bf')
  const [savingTag, setSavingTag] = useState(false)

  const TAG_COLORS = ['#2dd4bf','#818cf8','#f472b6','#fb923c','#a3e635','#38bdf8','#e879f9','#facc15','#f87171','#34d399']

  const sections = [
    { icon: Shield,  label: t('setting_security'),      description: t('setting_security_desc'),      soon: true },
    { icon: Bell,    label: t('setting_notifications'),  description: t('setting_notifications_desc'),  soon: true },
    { icon: Palette, label: t('setting_appearance'),     description: t('setting_appearance_desc'),     soon: true },
    { icon: Plug,    label: t('setting_integrations'),   description: t('setting_integrations_desc'),   soon: true },
  ]

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single()
      if (!member) return
      setWorkspaceId(member.workspace_id)
      const [groupsData, tagsData] = await Promise.all([
        listFieldGroupsFn({ data: { workspaceId: member.workspace_id } }),
        listWorkspaceTagsFn({ data: { workspaceId: member.workspace_id } }),
      ])
      setGroups(groupsData as ContactFieldGroup[])
      setTags(tagsData as WorkspaceTag[])
      setLoadingGroups(false)
    }
    load()
  }, [])

  async function handleCreateGroup() {
    if (!newGroupName.trim() || !workspaceId) return
    setSavingGroup(true)
    const group = await createFieldGroupFn({ data: { workspace_id: workspaceId, name: newGroupName.trim() } })
    setGroups(prev => [...prev, group as ContactFieldGroup])
    setNewGroupName('')
    setShowNewGroup(false)
    setSavingGroup(false)
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm(t('confirm_delete_group'))) return
    await deleteFieldGroupFn({ data: { id } })
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  function handleFieldAdded(groupId: string, field: ContactField) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, contact_fields: [...g.contact_fields, field] } : g))
  }

  function handleFieldDeleted(groupId: string, fieldId: string) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, contact_fields: g.contact_fields.filter(f => f.id !== fieldId) } : g))
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault()
    if (!newTagName.trim() || !workspaceId) return
    setSavingTag(true)
    const tag = await createWorkspaceTagFn({ data: { workspace_id: workspaceId, name: newTagName.trim(), color: newTagColor } })
    setTags(prev => [...prev, tag as WorkspaceTag])
    setNewTagName('')
    setNewTagColor('#2dd4bf')
    setSavingTag(false)
  }

  async function handleDeleteTag(id: string) {
    await deleteWorkspaceTagFn({ data: { id } })
    setTags(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#6b7a99]" />
          <span className="text-xs font-medium text-[#6b7a99] uppercase tracking-widest">{t('badge_workspace')}</span>
        </div>
        <h1 className="text-2xl font-bold text-[#f0f0ff] tracking-tight">{t('settings_title')}</h1>
        <p className="text-sm text-[#6b7a99] mt-1">{t('settings_sub')}</p>
      </div>

      {/* Dos columnas */}
      <div className="flex gap-8 items-start">

        {/* Columna izquierda — General */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#6b7a99]" />
            <span className="text-xs font-medium text-[#6b7a99] uppercase tracking-widest">{t('badge_workspace')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Idioma */}
            <div className="relative rounded-2xl border border-teal-500/25 bg-[#0e0e1c] p-5">
              <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.3), transparent)' }} />
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <Globe size={17} className="text-teal-400" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-[#d0d0f0] mb-0.5">{t('setting_language')}</h3>
              <p className="text-xs text-[#3d4466] mb-4">{t('setting_language_desc')}</p>
              <div className="flex gap-2">
                {(['es', 'en'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={['flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      lang === l ? 'bg-teal-500/20 border border-teal-500/40 text-teal-400' : 'bg-[#0a0a17] border border-[#1e1e38] text-[#6b7a99] hover:border-[#2a2a4a] hover:text-[#d0d0f0]',
                    ].join(' ')}>
                    {l === 'es' ? '🇲🇽 Español' : '🇺🇸 English'}
                  </button>
                ))}
              </div>
            </div>

            {sections.map(({ icon: Icon, label, description, soon }) => (
              <div key={label} className="relative rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] p-5 opacity-60">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#151528] border border-[#1e1e38] flex items-center justify-center">
                    <Icon size={17} className="text-[#3d4466]" />
                  </div>
                  {soon && <span className="text-[10px] font-medium text-[#3d4466] bg-[#151528] border border-[#1e1e38] px-2 py-0.5 rounded-md">{t('soon')}</span>}
                </div>
                <h3 className="text-sm font-semibold text-[#6b7a99]">{label}</h3>
                <p className="text-xs text-[#3d4466] mt-0.5">{description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha — CRM */}
        <div className="flex-1 min-w-0 flex flex-col gap-8">

          {/* Campos del contacto */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span className="text-xs font-medium text-teal-400 uppercase tracking-widest">{t('badge_crm')}</span>
                </div>
                <h2 className="text-lg font-bold text-[#f0f0ff] tracking-tight">{t('custom_fields_title')}</h2>
                <p className="text-sm text-[#6b7a99] mt-0.5">{t('custom_fields_desc')}</p>
              </div>
              {!showNewGroup && (
                <button
                  onClick={() => setShowNewGroup(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#07070f] transition-all cursor-pointer shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)' }}
                >
                  <Plus size={13} />{t('new_group')}
                </button>
              )}
            </div>

            {showNewGroup && (
              <div className="flex items-center gap-2 mb-4 p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5">
                <FolderOpen size={15} className="text-teal-400 shrink-0" />
                <input
                  autoFocus
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowNewGroup(false) }}
                  placeholder={t('ph_group_name')}
                  className="flex-1 bg-transparent text-sm text-[#f0f0ff] placeholder-[#3d4466] outline-none"
                />
                <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || savingGroup}
                  className="px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/30 text-xs font-semibold text-teal-400 hover:bg-teal-500/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
                  {savingGroup ? <Loader2 size={12} className="animate-spin" /> : null}
                  {t('create')}
                </button>
                <button onClick={() => { setShowNewGroup(false); setNewGroupName('') }}
                  className="w-7 h-7 rounded-lg bg-[#151528] flex items-center justify-center text-[#6b7a99] hover:text-[#d0d0f0] cursor-pointer transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}

            {loadingGroups ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-2xl border border-dashed border-[#1e1e38]">
                <div className="w-12 h-12 rounded-2xl bg-[#0e0e1c] border border-[#1e1e38] flex items-center justify-center">
                  <Settings size={20} className="text-[#2a2a4a]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#6b7a99]">{t('no_groups_yet')}</p>
                  <p className="text-xs text-[#3d4466] mt-1">{t('no_groups_sub')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(group => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    workspaceId={workspaceId}
                    t={t}
                    onDelete={() => handleDeleteGroup(group.id)}
                    onFieldAdded={field => handleFieldAdded(group.id, field)}
                    onFieldDeleted={fieldId => handleFieldDeleted(group.id, fieldId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-green-400 uppercase tracking-widest">Integraciones</span>
            </div>
            <h2 className="text-lg font-bold text-[#f0f0ff] tracking-tight mb-0.5">WhatsApp</h2>
            <p className="text-sm text-[#6b7a99] mb-5">Conecta tu número para enviar y recibir mensajes desde el CRM.</p>
            {workspaceId && <WhatsAppSection workspaceId={workspaceId} />}
          </div>

          {/* Etiquetas */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span className="text-xs font-medium text-teal-400 uppercase tracking-widest">{t('badge_crm')}</span>
            </div>
            <h2 className="text-lg font-bold text-[#f0f0ff] tracking-tight mb-0.5">{t('tags_title')}</h2>
            <p className="text-sm text-[#6b7a99] mb-5">{t('tags_desc')}</p>

            <div className="rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] overflow-hidden">
              {tags.length > 0 && (
                <div className="p-4 border-b border-[#1e1e38]">
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                        style={{ background: `${tag.color}12`, borderColor: `${tag.color}35` }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                        <span className="text-sm font-medium" style={{ color: tag.color }}>{tag.name}</span>
                        <button onClick={() => handleDeleteTag(tag.id)}
                          className="cursor-pointer hover:opacity-70 transition-opacity ml-0.5"
                          style={{ color: tag.color }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <form onSubmit={handleCreateTag} className="flex items-center gap-3 p-4">
                <Tag size={14} className="text-[#3d4466] shrink-0" />
                <input
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder={t('ph_tag_name')}
                  className="flex-1 bg-transparent text-sm text-[#f0f0ff] placeholder-[#3d4466] outline-none"
                />
                <div className="flex gap-1.5 shrink-0">
                  {TAG_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setNewTagColor(c)}
                      className="w-4 h-4 rounded-full transition-all cursor-pointer border-2"
                      style={{ background: c, borderColor: newTagColor === c ? '#fff' : 'transparent', transform: newTagColor === c ? 'scale(1.3)' : 'scale(1)' }}
                    />
                  ))}
                </div>
                <button type="submit" disabled={!newTagName.trim() || savingTag}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#07070f] transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)' }}>
                  {savingTag ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  {t('add_tag_btn')}
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
