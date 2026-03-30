import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import {
  getContactFn, listContactNotesFn, createContactNoteFn,
  updateContactFn, deleteContactFn, listFieldGroupsFn,
  listFieldValuesFn, upsertFieldValueFn,
} from '../../../server/contacts'
import { listFlowRunsForContactFn } from '../../../server/flows'
import { listWorkspaceTagsFn } from '../../../server/tags'
import { listWhatsAppMessagesFn, sendWhatsAppMessageFn } from '../../../server/whatsapp'
import type { Contact, ContactNote, ContactFieldGroup, ContactFieldValue, FlowRun, WorkspaceTag, WhatsAppMessage } from '../../../lib/types'
import { useLanguage } from '../../../lib/i18n'
import {
  ArrowLeft, Mail, Phone, Building, Tag, FileText, Calendar, User,
  MessageSquare, PhoneCall, AtSign, Users as MeetingIcon,
  Send, Trash2, Edit2, Check, X, Loader2, ChevronDown, ChevronRight as ChevronRightIcon,
  Workflow, ExternalLink, Plus, MessageCircle,
} from 'lucide-react'

export const Route = createFileRoute('/_app/contacts/$contactId')({
  component: ContactDetailPage,
})

const NOTE_TYPES = [
  { value: 'note',    icon: MessageSquare, color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
  { value: 'call',    icon: PhoneCall,     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { value: 'email',   icon: AtSign,        color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { value: 'meeting', icon: MeetingIcon,   color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
] as const

function Avatar({ contact, size = 'md' }: { contact: Contact; size?: 'md' | 'lg' }) {
  const initials = `${contact.first_name[0]}${contact.last_name?.[0] ?? ''}`.toUpperCase()
  const colors = ['from-teal-500/60 to-teal-700/60', 'from-purple-500/60 to-purple-700/60', 'from-blue-500/60 to-blue-700/60', 'from-amber-500/60 to-amber-700/60']
  const color = colors[initials.charCodeAt(0) % colors.length]
  const sz = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-[#f0f0ff] shrink-0 border border-white/10`}>
      {initials}
    </div>
  )
}

function NoteItem({ note, currentUserId, onDelete }: { note: ContactNote; currentUserId: string; onDelete: (id: string) => void }) {
  const isMine = note.user_id === currentUserId
  const typeConfig = NOTE_TYPES.find(t => t.value === note.type) ?? NOTE_TYPES[0]
  const Icon = typeConfig.icon
  const date = new Date(note.created_at)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short' })
  const isToday = new Date().toDateString() === date.toDateString()

  return (
    <div className={`group flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full ${typeConfig.bg} border ${typeConfig.border} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon size={13} className={typeConfig.color} />
      </div>
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`relative px-3.5 py-2.5 rounded-2xl text-sm text-[#d0d0f0] leading-relaxed whitespace-pre-wrap break-words
          ${isMine
            ? 'bg-teal-500/15 border border-teal-500/20 rounded-tr-sm'
            : 'bg-[#151528] border border-[#1e1e38] rounded-tl-sm'
          }`}>
          {note.content}
          {isMine && (
            <button
              onClick={() => onDelete(note.id)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0a0a17] border border-[#1e1e38] items-center justify-center hidden group-hover:flex text-[#3d4466] hover:text-red-400 transition-colors cursor-pointer"
            >
              <X size={10} />
            </button>
          )}
        </div>
        <span className="text-[10px] text-[#3d4466] px-1">
          {isToday ? timeStr : `${dateStr} · ${timeStr}`}
          {!isMine && note.user_email && ` · ${note.user_email}`}
        </span>
      </div>
    </div>
  )
}

function EditableField({ label, value, onSave, type = 'text', placeholder }: {
  label: string; value: string; onSave: (v: string) => Promise<void>; type?: string; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(val)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1 flex-1">
        <label className="text-[10px] font-semibold text-[#3d4466] uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type={type} value={val} autoFocus placeholder={placeholder}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value); setEditing(false) } }}
            className="flex-1 bg-[#0a0a17] border border-teal-500/40 rounded-lg px-2.5 py-1.5 text-sm text-[#f0f0ff] outline-none focus:ring-2 focus:ring-teal-500/15"
          />
          <button onClick={save} disabled={saving} className="w-7 h-7 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 flex items-center justify-center text-teal-400 transition-colors cursor-pointer disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button onClick={() => { setVal(value); setEditing(false) }} className="w-7 h-7 rounded-lg bg-[#151528] hover:bg-[#1e1e38] flex items-center justify-center text-[#6b7a99] transition-colors cursor-pointer">
            <X size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col gap-1 flex-1">
      <label className="text-[10px] font-semibold text-[#3d4466] uppercase tracking-wider">{label}</label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[#d0d0f0] truncate">{value || <span className="text-[#3d4466] italic">—</span>}</span>
        <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-[#151528] flex items-center justify-center text-[#3d4466] hover:text-teal-400 transition-all cursor-pointer shrink-0">
          <Edit2 size={11} />
        </button>
      </div>
    </div>
  )
}

function CustomFieldGroupSection({
  group, fieldValues, contactId, workspaceId, onValueChange,
}: {
  group: ContactFieldGroup
  fieldValues: Record<string, string>
  contactId: string
  workspaceId: string
  onValueChange: (fieldId: string, value: string) => void
}) {
  const [open, setOpen] = useState(true)

  async function saveValue(fieldId: string, value: string) {
    onValueChange(fieldId, value)
    await upsertFieldValueFn({ data: { contact_id: contactId, field_id: fieldId, workspace_id: workspaceId, value } })
  }

  if (group.contact_fields.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-[#6b7a99] uppercase tracking-wider hover:text-teal-400 transition-colors cursor-pointer py-1"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRightIcon size={11} />}
        {group.name}
      </button>
      {open && (
        <div className="flex flex-col gap-3 pl-2">
          {group.contact_fields.map(field => (
            <EditableField
              key={field.id}
              label={field.name}
              value={fieldValues[field.id] ?? ''}
              type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : field.field_type === 'url' ? 'url' : field.field_type === 'phone' ? 'tel' : 'text'}
              onSave={v => saveValue(field.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const TAG_COLORS = ['#2dd4bf','#818cf8','#f472b6','#fb923c','#a3e635','#38bdf8','#e879f9','#facc15','#f87171','#34d399']

function TagsEditor({ tags, workspaceTags, onSave, onTagCreated, workspaceId }: {
  tags: string[]
  workspaceTags: WorkspaceTag[]
  onSave: (tags: string[]) => Promise<void>
  onTagCreated: (tag: WorkspaceTag) => void
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#2dd4bf')
  const colorMap = Object.fromEntries(workspaceTags.map(t => [t.name, t.color]))

  async function removeTag(name: string) {
    setSaving(true)
    await onSave(tags.filter(t => t !== name))
    setSaving(false)
  }

  async function addTag(name: string, color?: string) {
    if (tags.includes(name)) { setOpen(false); return }
    setSaving(true)
    // Use the color passed or look up from colorMap
    if (color) colorMap[name] = color
    await onSave([...tags, name])
    setSaving(false)
    setOpen(false)
  }

  async function handleCreate() {
    if (!newName.trim() || !workspaceId) return
    setSaving(true)
    const { createWorkspaceTagFn } = await import('../../../server/tags')
    const tag = await createWorkspaceTagFn({ data: { workspace_id: workspaceId, name: newName.trim(), color: newColor } }) as WorkspaceTag
    onTagCreated(tag)
    await addTag(tag.name, tag.color)
    setNewName('')
    setNewColor('#2dd4bf')
    setCreating(false)
    setSaving(false)
  }

  const available = workspaceTags.filter(t => !tags.includes(t.name))

  return (
    <div className="flex flex-wrap gap-1.5 justify-center relative">
      {tags.map(tag => {
        const color = colorMap[tag] ?? '#2dd4bf'
        return (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
            style={{ color, background: `${color}18`, borderColor: `${color}35` }}>
            {tag}
            <button onClick={() => removeTag(tag)} disabled={saving}
              className="cursor-pointer hover:opacity-70 transition-opacity ml-0.5">
              <X size={9} />
            </button>
          </span>
        )
      })}

      <div className="relative">
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed border-[#2a2a4a] text-[#3d4466] hover:border-teal-500/40 hover:text-teal-400 transition-all cursor-pointer">
          <Plus size={10} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setCreating(false) }} />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-20 w-52 rounded-xl border border-[#1e1e38] bg-[#0e0e1c] shadow-2xl overflow-hidden">
              {available.length > 0 && (
                <div className="py-1 max-h-36 overflow-y-auto">
                  {available.map(wt => (
                    <button key={wt.id} onClick={() => addTag(wt.name, wt.color)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#151528] transition-colors cursor-pointer text-left">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: wt.color }} />
                      <span className="text-xs text-[#d0d0f0]">{wt.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-[#1e1e38]">
                {!creating ? (
                  <button onClick={() => setCreating(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#3d4466] hover:text-teal-400 hover:bg-[#151528] transition-colors cursor-pointer">
                    <Plus size={11} /> Nueva etiqueta
                  </button>
                ) : (
                  <div className="p-2.5 space-y-2">
                    <div className="flex gap-1 flex-wrap">
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
                        className="flex-1 bg-[#0a0a17] border border-[#1e1e38] rounded-lg px-2 py-1 text-xs text-[#f0f0ff] placeholder-[#3d4466] outline-none focus:border-teal-500/40 min-w-0"
                      />
                      <button onClick={handleCreate} disabled={!newName.trim() || saving}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[#07070f] cursor-pointer disabled:opacity-40 shrink-0"
                        style={{ background: newColor }}>
                        {saving ? <Loader2 size={10} className="animate-spin text-white" /> : <Check size={10} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FlowRunsSection({ flowRuns, t }: { flowRuns: FlowRun[]; t: (k: string) => string }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-[#6b7a99] uppercase tracking-wider hover:text-purple-400 transition-colors cursor-pointer py-1"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRightIcon size={11} />}
        <Workflow size={11} />
        {t('flow_runs_section')}
        <span className="ml-auto text-[#3d4466] font-normal normal-case tracking-normal">{flowRuns.length}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 pl-2">
          {flowRuns.map(run => {
            const date = new Date(run.ran_at)
            const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' })
            return (
              <Link
                key={run.id}
                to="/flows/$flowId"
                params={{ flowId: run.flow_id ?? '' }}
                className={[
                  'flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all group',
                  run.flow_id
                    ? 'border-[#1e1e38] bg-[#0a0a17] hover:border-purple-500/25 hover:bg-purple-500/5 cursor-pointer'
                    : 'border-[#1e1e38] bg-[#0a0a17] pointer-events-none opacity-50',
                ].join(' ')}
              >
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Workflow size={11} className="text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#d0d0f0] group-hover:text-purple-300 transition-colors truncate">{run.flow_name}</p>
                  <p className="text-[10px] text-[#3d4466]">{dateStr}</p>
                </div>
                {run.flow_id && <ExternalLink size={10} className="text-[#3d4466] group-hover:text-purple-400 transition-colors shrink-0" />}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ContactDetailPage() {
  const { contactId } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()

  const [contact, setContact] = useState<Contact | null>(null)
  const [notes, setNotes] = useState<ContactNote[]>([])
  const [fieldGroups, setFieldGroups] = useState<ContactFieldGroup[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([])
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTag[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null)
  const [workspaceId, setWorkspaceId] = useState('')
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email' | 'meeting'>('note')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'activity' | 'whatsapp'>('activity')
  const [waMessages, setWaMessages] = useState<WhatsAppMessage[]>([])
  const [waContent, setWaContent] = useState('')
  const [waSending, setWaSending] = useState(false)
  const waFeedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser({ id: user.id, email: user.email ?? '' })

      const { data: member } = await supabase
        .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single()
      const wsId = member?.workspace_id ?? ''
      if (wsId) setWorkspaceId(wsId)

      const [contactData, notesData, groupsData, valuesData, runsData, tagsData, waData] = await Promise.all([
        getContactFn({ data: { id: contactId } }),
        listContactNotesFn({ data: { contactId } }),
        wsId ? listFieldGroupsFn({ data: { workspaceId: wsId } }) : Promise.resolve([]),
        listFieldValuesFn({ data: { contactId } }),
        listFlowRunsForContactFn({ data: { contactId } }),
        wsId ? listWorkspaceTagsFn({ data: { workspaceId: wsId } }) : Promise.resolve([]),
        listWhatsAppMessagesFn({ data: { contactId } }),
      ])
      setContact(contactData as Contact)
      setNotes(notesData as ContactNote[])
      setFieldGroups(groupsData as ContactFieldGroup[])
      setFlowRuns(runsData as FlowRun[])
      setWorkspaceTags(tagsData as WorkspaceTag[])
      setWaMessages(waData as WhatsAppMessage[])
      const valMap: Record<string, string> = {}
      for (const v of valuesData as ContactFieldValue[]) {
        valMap[v.field_id] = v.value ?? ''
      }
      setFieldValues(valMap)
      setLoading(false)
    }
    load()
  }, [contactId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`contact-notes-${contactId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_notes', filter: `contact_id=eq.${contactId}` }, (payload) => {
        setNotes(prev => prev.find(n => n.id === payload.new.id) ? prev : [...prev, payload.new as ContactNote])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'contact_notes', filter: `contact_id=eq.${contactId}` }, (payload) => {
        setNotes(prev => prev.filter(n => n.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [contactId])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [notes])

  useEffect(() => {
    if (waFeedRef.current) waFeedRef.current.scrollTop = waFeedRef.current.scrollHeight
  }, [waMessages])

  // Realtime + polling for WhatsApp messages
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`wa-messages-${contactId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `contact_id=eq.${contactId}` }, (payload) => {
        setWaMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new as WhatsAppMessage])
      })
      .subscribe()

    // Polling fallback every 5s (webhook may not always fire in dev)
    const interval = setInterval(async () => {
      const fresh = await listWhatsAppMessagesFn({ data: { contactId } })
      setWaMessages(fresh as WhatsAppMessage[])
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [contactId])

  async function handleSend() {
    if (!content.trim() || !currentUser || !workspaceId) return
    setSending(true)
    const trimmed = content.trim()
    setContent('')
    await createContactNoteFn({ data: { contact_id: contactId, workspace_id: workspaceId, user_id: currentUser.id, user_email: currentUser.email, content: trimmed, type: noteType } })
    setSending(false)
  }

  async function handleSendWa() {
    if (!waContent.trim() || !workspaceId) return
    setWaSending(true)
    const trimmed = waContent.trim()
    setWaContent('')
    try {
      const msg = await sendWhatsAppMessageFn({ data: { workspaceId, contactId, message: trimmed } })
      setWaMessages(prev => [...prev, msg as WhatsAppMessage])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar'
      alert(message)
    }
    setWaSending(false)
  }

  async function handleDeleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
    const supabase = createClient()
    await supabase.from('contact_notes').delete().eq('id', id)
  }

  async function saveField(field: string, value: string) {
    if (!contact) return
    const updated = await updateContactFn({ data: { id: contactId, updates: { [field]: value } } })
    setContact(updated as Contact)
  }

  async function handleDeleteContact() {
    if (!confirm(t('confirm_delete_contact'))) return
    await deleteContactFn({ data: { id: contactId } })
    navigate({ to: '/contacts' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-sm text-[#6b7a99]">{t('contact_not_found')}</p>
        <Link to="/contacts" className="text-xs text-teal-400 hover:underline">{t('back_to_contacts')}</Link>
      </div>
    )
  }

  const createdAt = new Date(contact.created_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
  const groupsWithFields = fieldGroups.filter(g => g.contact_fields.length > 0)
  const uniqueFlowRuns = flowRuns.filter((run, i, arr) =>
    arr.findIndex(r => r.flow_id === run.flow_id) === i
  )

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 lg:px-8 py-4 border-b border-[#1e1e38] shrink-0">
        <Link to="/contacts" className="flex items-center gap-1.5 text-xs text-[#6b7a99] hover:text-teal-400 transition-colors">
          <ArrowLeft size={13} />{t('back_to_contacts')}
        </Link>
        <div className="h-3 w-px bg-[#1e1e38]" />
        <span className="text-sm font-medium text-[#d0d0f0]">{contact.first_name} {contact.last_name}</span>
        <div className="ml-auto">
          <button onClick={handleDeleteContact} className="flex items-center gap-1.5 text-xs text-[#3d4466] hover:text-red-400 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-red-500/5 border border-transparent hover:border-red-500/10">
            <Trash2 size={12} />{t('delete_contact')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — info del contacto */}
        <div className="w-72 lg:w-80 shrink-0 border-r border-[#1e1e38] overflow-y-auto p-5 flex flex-col gap-5">
          {/* Perfil */}
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <Avatar contact={contact} size="lg" />
            <div>
              <h2 className="text-base font-bold text-[#f0f0ff]">{contact.first_name} {contact.last_name}</h2>
              {contact.company && <p className="text-xs text-[#6b7a99] mt-0.5">{contact.company}</p>}
            </div>
            <TagsEditor
              tags={contact.tags}
              workspaceTags={workspaceTags}
              workspaceId={workspaceId}
              onTagCreated={(tag) => setWorkspaceTags(prev => [...prev, tag])}
              onSave={async (newTags) => {
                const updated = await updateContactFn({ data: { id: contactId, updates: { tags: newTags } } })
                setContact(updated as Contact)
              }}
            />
          </div>

          <div className="w-full h-px bg-[#1e1e38]" />

          {/* Campos estándar */}
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <Mail size={13} className="text-[#3d4466] shrink-0 mt-4" />
              <EditableField label={t('field_email')} value={contact.email ?? ''} onSave={v => saveField('email', v)} type="email" placeholder="email@empresa.com" />
            </div>
            <div className="flex items-start gap-2">
              <Phone size={13} className="text-[#3d4466] shrink-0 mt-4" />
              <EditableField label={t('field_phone')} value={contact.phone ?? ''} onSave={v => saveField('phone', v)} placeholder="+52 55 0000 0000" />
            </div>
            <div className="flex items-start gap-2">
              <Building size={13} className="text-[#3d4466] shrink-0 mt-4" />
              <EditableField label={t('field_company')} value={contact.company ?? ''} onSave={v => saveField('company', v)} placeholder="Empresa S.A." />
            </div>
            <div className="flex items-start gap-2">
              <Tag size={13} className="text-[#3d4466] shrink-0 mt-4" />
              <EditableField label={t('field_source')} value={contact.source ?? ''} onSave={v => saveField('source', v)} placeholder="web, referido..." />
            </div>
            <div className="flex items-start gap-2">
              <FileText size={13} className="text-[#3d4466] shrink-0 mt-1" />
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#3d4466] uppercase tracking-wider">{t('field_notes')}</label>
                <textarea
                  rows={3}
                  value={contact.notes ?? ''}
                  onChange={e => setContact(c => c ? { ...c, notes: e.target.value } : c)}
                  onBlur={e => saveField('notes', e.target.value)}
                  placeholder={t('ph_notes')}
                  className="w-full bg-[#0a0a17] border border-[#1e1e38] rounded-lg px-2.5 py-1.5 text-sm text-[#d0d0f0] placeholder-[#3d4466] outline-none focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10 resize-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Campos personalizados */}
          {groupsWithFields.length > 0 && (
            <>
              <div className="w-full h-px bg-[#1e1e38]" />
              <div className="flex flex-col gap-5">
                {groupsWithFields.map(group => (
                  <CustomFieldGroupSection
                    key={group.id}
                    group={group}
                    fieldValues={fieldValues}
                    contactId={contactId}
                    workspaceId={workspaceId}
                    onValueChange={(fieldId, value) => setFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                  />
                ))}
              </div>
            </>
          )}

          {/* Automatizaciones */}
          {uniqueFlowRuns.length > 0 && (
            <>
              <div className="w-full h-px bg-[#1e1e38]" />
              <FlowRunsSection flowRuns={uniqueFlowRuns} t={t} />
            </>
          )}

          <div className="w-full h-px bg-[#1e1e38]" />

          {/* Meta */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs text-[#3d4466]">
              <Calendar size={12} />
              <span>{t('created_on')} {createdAt}</span>
            </div>
            {(contact.created_by_name || contact.created_by_email) && (
              <div className="flex items-center gap-2 text-xs text-[#3d4466]">
                <User size={12} />
                <span>{t('created_by')} <span className="text-[#6b7a99]">{contact.created_by_name || contact.created_by_email}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Right — actividad / WhatsApp */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="px-5 border-b border-[#1e1e38] shrink-0 flex items-center gap-1 pt-1">
            <button
              onClick={() => setActiveTab('activity')}
              className={['flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
                activeTab === 'activity'
                  ? 'border-teal-400 text-teal-400'
                  : 'border-transparent text-[#3d4466] hover:text-[#6b7a99]',
              ].join(' ')}
            >
              <MessageSquare size={12} />
              {t('activity_feed')}
              <span className="ml-1 text-[10px] opacity-60">{notes.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={['flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
                activeTab === 'whatsapp'
                  ? 'border-green-400 text-green-400'
                  : 'border-transparent text-[#3d4466] hover:text-[#6b7a99]',
              ].join(' ')}
            >
              <MessageCircle size={12} />
              WhatsApp
              {waMessages.length > 0 && <span className="ml-1 text-[10px] opacity-60">{waMessages.length}</span>}
            </button>
          </div>

          {/* Activity tab */}
          {activeTab === 'activity' && (
            <>
              <div ref={feedRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {notes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center py-16">
                    <div className="w-12 h-12 rounded-2xl bg-[#0e0e1c] border border-[#1e1e38] flex items-center justify-center mb-1">
                      <MessageSquare size={20} className="text-[#2a2a4a]" />
                    </div>
                    <p className="text-sm font-medium text-[#6b7a99]">{t('no_activity')}</p>
                    <p className="text-xs text-[#3d4466] max-w-xs">{t('no_activity_sub')}</p>
                  </div>
                ) : (
                  notes.map(note => (
                    <NoteItem key={note.id} note={note} currentUserId={currentUser?.id ?? ''} onDelete={handleDeleteNote} />
                  ))
                )}
              </div>
              <div className="px-5 py-4 border-t border-[#1e1e38] shrink-0 space-y-3">
                <div className="flex gap-2">
                  {NOTE_TYPES.map(nt => {
                    const Icon = nt.icon
                    const active = noteType === nt.value
                    const labels: Record<string, string> = { note: t('note_type_note'), call: t('note_type_call'), email: t('note_type_email'), meeting: t('note_type_meeting') }
                    return (
                      <button key={nt.value} onClick={() => setNoteType(nt.value)}
                        className={['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border',
                          active ? `${nt.bg} ${nt.border} ${nt.color}` : 'bg-[#0a0a17] border-[#1e1e38] text-[#3d4466] hover:border-[#2a2a4a] hover:text-[#6b7a99]'
                        ].join(' ')}>
                        <Icon size={12} />{labels[nt.value]}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2 items-end">
                  <textarea rows={2} value={content} onChange={e => setContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
                    placeholder={t('note_placeholder')}
                    className="flex-1 bg-[#0a0a17] border border-[#1e1e38] rounded-xl px-3.5 py-2.5 text-sm text-[#f0f0ff] placeholder-[#3d4466] focus:outline-none focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10 resize-none transition-all hover:border-[#2a2a4a]"
                  />
                  <button onClick={handleSend} disabled={!content.trim() || sending}
                    className="h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)' }}>
                    {sending ? <Loader2 size={15} className="text-[#07070f] animate-spin" /> : <Send size={15} className="text-[#07070f]" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#2a2a4a]">{t('note_hint')}</p>
              </div>
            </>
          )}

          {/* WhatsApp tab */}
          {activeTab === 'whatsapp' && (
            <>
              <div ref={waFeedRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {waMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center py-16">
                    <div className="w-12 h-12 rounded-2xl bg-[#0e0e1c] border border-[#1e1e38] flex items-center justify-center mb-1">
                      <MessageCircle size={20} className="text-[#2a2a4a]" />
                    </div>
                    <p className="text-sm font-medium text-[#6b7a99]">Sin mensajes de WhatsApp</p>
                    <p className="text-xs text-[#3d4466] max-w-xs">Los mensajes enviados y recibidos por WhatsApp aparecerán aquí.</p>
                  </div>
                ) : (
                  waMessages.map(msg => {
                    const isOutbound = msg.direction === 'outbound'
                    const date = new Date(msg.created_at)
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short' })
                    const isToday = new Date().toDateString() === date.toDateString()
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className="w-7 h-7 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <MessageCircle size={13} className="text-green-400" />
                        </div>
                        <div className={`max-w-[75%] flex flex-col gap-1 ${isOutbound ? 'items-end' : 'items-start'}`}>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm text-[#d0d0f0] leading-relaxed whitespace-pre-wrap break-words
                            ${isOutbound
                              ? 'bg-green-500/15 border border-green-500/20 rounded-tr-sm'
                              : 'bg-[#151528] border border-[#1e1e38] rounded-tl-sm'
                            }`}>
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-[#3d4466] px-1">
                            {isToday ? timeStr : `${dateStr} · ${timeStr}`}
                            {' · '}{isOutbound ? 'Enviado' : 'Recibido'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="px-5 py-4 border-t border-[#1e1e38] shrink-0 space-y-2">
                <div className="flex gap-2 items-end">
                  <textarea rows={2} value={waContent} onChange={e => setWaContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendWa() }}
                    placeholder="Escribe un mensaje de WhatsApp... (⌘↵ para enviar)"
                    className="flex-1 bg-[#0a0a17] border border-[#1e1e38] rounded-xl px-3.5 py-2.5 text-sm text-[#f0f0ff] placeholder-[#3d4466] focus:outline-none focus:border-green-500/40 focus:ring-2 focus:ring-green-500/10 resize-none transition-all hover:border-[#2a2a4a]"
                  />
                  <button onClick={handleSendWa} disabled={!waContent.trim() || waSending}
                    className="h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                    {waSending ? <Loader2 size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
