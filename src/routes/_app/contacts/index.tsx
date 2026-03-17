import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { Button } from '../../../components/ui/button'
import { Input, Textarea } from '../../../components/ui/input'
import { Badge } from '../../../components/ui/badge'
import { Modal } from '../../../components/ui/modal'
import { listContactsFn, createContactFn, deleteContactFn } from '../../../server/contacts'
import { listWorkspaceTagsFn } from '../../../server/tags'
import type { Contact, Workspace, WorkspaceTag } from '../../../lib/types'
import { Plus, Search, Trash2, Mail, Phone, Building, Users } from 'lucide-react'
import { useLanguage } from '../../../lib/i18n'

export const Route = createFileRoute('/_app/contacts/')({
  component: ContactsPage,
})

function Avatar({ contact }: { contact: Contact }) {
  const initials = `${contact.first_name[0]}${contact.last_name?.[0] ?? ''}`.toUpperCase()
  const colors = ['from-teal-500/40 to-teal-700/40', 'from-purple-500/40 to-purple-700/40', 'from-blue-500/40 to-blue-700/40', 'from-amber-500/40 to-amber-700/40']
  const color = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-xs font-bold text-[#f0f0ff] shrink-0 border border-white/5`}>
      {initials}
    </div>
  )
}

function ContactsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [tagColorMap, setTagColorMap] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', source: '', notes: '' })
  const { t } = useLanguage()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserEmail(user.email ?? '')
      const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || ''
      setCurrentUserName(name)
      const { data: member } = await supabase
        .from('workspace_members').select('workspaces(*)').eq('user_id', user.id).limit(1).single()
      const ws = member?.workspaces as unknown as Workspace
      if (!ws) return
      setWorkspace(ws)
      const [contactsData, tagsData] = await Promise.all([
        listContactsFn({ data: { workspaceId: ws.id } }),
        listWorkspaceTagsFn({ data: { workspaceId: ws.id } }),
      ])
      setContacts(contactsData)
      setTagColorMap(Object.fromEntries((tagsData as WorkspaceTag[]).map(t => [t.name, t.color])))
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!workspace) return
    setSaving(true)
    const contact = await createContactFn({ data: { workspace_id: workspace.id, ...form, created_by_email: currentUserEmail, created_by_name: currentUserName } })
    setContacts(prev => [contact, ...prev])
    setShowModal(false)
    setForm({ first_name: '', last_name: '', email: '', phone: '', company: '', source: '', notes: '' })
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirm_delete_contact'))) return
    await deleteContactFn({ data: { id } })
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const filtered = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email} ${c.company}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span className="text-xs font-medium text-teal-400 uppercase tracking-widest">{t('badge_crm')}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#f0f0ff] tracking-tight">{t('contacts_title')}</h1>
          <p className="text-sm text-[#6b7a99] mt-1">{contacts.length} {contacts.length !== 1 ? t('contacts_count_many') : t('contacts_count_one')}</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} strokeWidth={2.5} /> {t('new_contact')}
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3d4466]" />
        <input
          type="text"
          placeholder={t('search_placeholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#0e0e1c] border border-[#1e1e38] rounded-xl pl-10 pr-4 py-3 text-sm text-[#f0f0ff] placeholder-[#3d4466] focus:outline-none focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10 transition-all hover:border-[#2a2a4a]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            <p className="text-xs text-[#6b7a99]">{t('loading_contacts')}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0e0e1c] border border-[#1e1e38] flex items-center justify-center">
            <Users size={28} className="text-[#2a2a4a]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#6b7a99]">{search ? t('no_contacts_search') : t('no_contacts_yet')}</p>
            <p className="text-xs text-[#3d4466] mt-1">{t('no_contacts_sub')}</p>
          </div>
          {!search && (
            <Button onClick={() => setShowModal(true)} variant="outline" size="sm">
              <Plus size={13} /> {t('add_contact')}
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e38]">
                <th className="text-left text-[10px] font-semibold text-[#3d4466] uppercase tracking-widest px-5 py-3.5">{t('col_contact')}</th>
                <th className="text-left text-[10px] font-semibold text-[#3d4466] uppercase tracking-widest px-4 py-3.5 hidden md:table-cell">{t('col_email')}</th>
                <th className="text-left text-[10px] font-semibold text-[#3d4466] uppercase tracking-widest px-4 py-3.5 hidden lg:table-cell">{t('col_phone')}</th>
                <th className="text-left text-[10px] font-semibold text-[#3d4466] uppercase tracking-widest px-4 py-3.5 hidden lg:table-cell">{t('col_company')}</th>
                <th className="text-left text-[10px] font-semibold text-[#3d4466] uppercase tracking-widest px-4 py-3.5 hidden xl:table-cell">{t('col_source')}</th>
                <th className="px-4 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0f0f1e]">
              {filtered.map(contact => (
                <tr key={contact.id} className="group hover:bg-[#0a0a17] transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <Link to="/contacts/$contactId" params={{ contactId: contact.id }} className="flex items-center gap-3">
                      <Avatar contact={contact} />
                      <div>
                        <p className="text-sm font-medium text-[#d0d0f0] group-hover:text-teal-400 transition-colors">{contact.first_name} {contact.last_name}</p>
                        {contact.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {contact.tags.slice(0, 2).map(tag => {
                              const color = tagColorMap[tag] ?? '#2dd4bf'
                              return (
                                <span key={tag} className="px-1.5 py-0 rounded-full text-[10px] font-medium border"
                                  style={{ color, background: `${color}18`, borderColor: `${color}35` }}>
                                  {tag}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-[#6b7a99] hover:text-teal-400 transition-colors group/link">
                        <Mail size={13} className="text-[#3d4466] group-hover/link:text-teal-400 transition-colors" />
                        {contact.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-[#6b7a99]">
                        <Phone size={13} className="text-[#3d4466]" /> {contact.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {contact.company && (
                      <div className="flex items-center gap-2 text-sm text-[#6b7a99]">
                        <Building size={13} className="text-[#3d4466]" /> {contact.company}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden xl:table-cell">
                    {contact.source && <Badge variant="default">{contact.source}</Badge>}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(contact.id) }}
                      className="opacity-0 group-hover:opacity-100 text-[#3d4466] hover:text-red-400 transition-all cursor-pointer p-1 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={t('modal_new_contact')} description={t('modal_contact_desc')} size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('field_first_name')} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder={t('ph_first_name')} required />
            <Input label={t('field_last_name')} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder={t('ph_last_name')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('field_email')} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('ph_email')} required />
            <Input label={t('field_phone')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('ph_phone')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('field_company')} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder={t('ph_company')} />
            <Input label={t('field_source')} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder={t('ph_source')} />
          </div>
          <Textarea label={t('field_notes')} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('ph_notes')} />
          <div className="flex gap-3 justify-end pt-2 border-t border-[#1e1e38] mt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
            <Button type="submit" loading={saving}>{t('create_contact')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
