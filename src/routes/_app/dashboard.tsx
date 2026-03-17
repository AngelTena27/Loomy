import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { Link } from '@tanstack/react-router'
import {
  Users, TrendingUp, Workflow, DollarSign,
  ArrowUpRight, ChevronRight, Zap,
} from 'lucide-react'
import type { Workspace } from '../../lib/types'
import { useLanguage } from '../../lib/i18n'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function StatCard({ icon: Icon, label, value, color, trend, href }: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  iconBg: string
  trend?: string
  href: string
}) {
  return (
    <Link to={href} className="group relative rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] p-5 hover:border-[#2a2a4a] transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-teal-500/3 to-transparent" />

      <div className="relative flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} strokeWidth={2} />
        </div>
        <ArrowUpRight size={14} className="text-[#3d4466] group-hover:text-teal-400 transition-colors" />
      </div>
      <p className="text-[#6b7a99] text-xs font-medium uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-3xl font-bold text-[#f0f0ff] tracking-tight">{value}</p>
      {trend && <p className="text-xs text-emerald-400 mt-1.5 font-medium">{trend}</p>}
    </Link>
  )
}

function DashboardPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [stats, setStats] = useState({ contacts: 0, deals: 0, flows: 0, revenue: 0 })
  const [userName, setUserName] = useState('')
  const { t } = useLanguage()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserName(user.email?.split('@')[0] ?? '')

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspaces(*)')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      const ws = member?.workspaces as unknown as Workspace
      if (!ws) return
      setWorkspace(ws)

      const [{ count: contacts }, { count: flows }, { data: deals }] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('flows').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('deals').select('value').eq('workspace_id', ws.id).eq('status', 'won'),
      ])

      const revenue = (deals ?? []).reduce((sum, d) => sum + (d.value ?? 0), 0)
      setStats({ contacts: contacts ?? 0, deals: deals?.length ?? 0, flows: flows ?? 0, revenue })
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('greeting_morning') : hour < 18 ? t('greeting_afternoon') : t('greeting_evening')

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-xs font-medium text-teal-400 uppercase tracking-widest">{t('badge_dashboard')}</span>
        </div>
        <h1 className="text-3xl font-bold text-[#f0f0ff] tracking-tight">
          {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-300">{userName}</span>
        </h1>
        <p className="text-sm text-[#6b7a99] mt-2">
          {workspace ? `${workspace.name} — ` : ''}{t('dash_subtitle')}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label={t('stat_contacts')}
          value={stats.contacts}
          color="bg-teal-500/10 text-teal-400"
          iconBg=""
          href="/contacts"
        />
        <StatCard
          icon={TrendingUp}
          label={t('stat_deals')}
          value={stats.deals}
          color="bg-emerald-500/10 text-emerald-400"
          iconBg=""
          href="/pipeline"
        />
        <StatCard
          icon={Workflow}
          label={t('stat_flows')}
          value={stats.flows}
          color="bg-purple-500/10 text-purple-400"
          iconBg=""
          href="/flows"
        />
        <StatCard
          icon={DollarSign}
          label={t('stat_revenue')}
          value={`$${stats.revenue.toLocaleString()}`}
          color="bg-amber-500/10 text-amber-400"
          iconBg=""
          href="/pipeline"
        />
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-[#f0f0ff]">{t('quick_actions')}</h2>
            <p className="text-xs text-[#6b7a99] mt-0.5">{t('quick_actions_sub')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: t('qa_contacts'), sub: t('qa_contacts_sub'), href: '/contacts', icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
            { label: t('qa_pipeline'), sub: t('qa_pipeline_sub'), href: '/pipeline', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: t('qa_flows'), sub: t('qa_flows_sub'), href: '/flows', icon: Workflow, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map(({ label, sub, href, icon: Icon, color, bg }) => (
            <Link
              key={href}
              to={href}
              className="group flex items-center gap-4 p-4 rounded-xl bg-[#0a0a17] border border-[#1e1e38] hover:border-[#2a2a4a] transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={17} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#d0d0f0] group-hover:text-[#f0f0ff] transition-colors">{label}</p>
                <p className="text-xs text-[#3d4466]">{sub}</p>
              </div>
              <ChevronRight size={14} className="text-[#3d4466] group-hover:text-[#6b7a99] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Platform info card */}
      <div className="relative rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent p-6 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl" />
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-teal-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#f0f0ff] mb-1">{t('loomy_ready')}</h3>
            <p className="text-xs text-[#6b7a99] leading-relaxed max-w-lg">
              {t('loomy_ready_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
