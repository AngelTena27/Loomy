import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard, Users, Kanban, Workflow,
  Settings, LogOut, Zap, ChevronRight, X,
} from 'lucide-react'
import { createClient } from '../../lib/supabase'
import { useLanguage } from '../../lib/i18n'

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export const Sidebar = ({ open, onClose }: SidebarProps) => {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav_dashboard') },
    { to: '/contacts', icon: Users, label: t('nav_contacts') },
    { to: '/pipeline', icon: Kanban, label: t('nav_pipeline') },
    { to: '/flows', icon: Workflow, label: t('nav_flows') },
  ]

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'w-[220px] h-screen flex flex-col fixed left-0 top-0 z-40 bg-[#07070f] border-r border-[#1e1e38]',
        'transition-transform duration-300',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Logo area */}
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 shrink-0">
              <div className="absolute inset-0 bg-teal-500 rounded-xl opacity-20 blur-sm" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg">
                <Zap size={17} className="text-[#07070f]" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <span className="font-bold text-[#f0f0ff] text-lg tracking-tight">Loomy</span>
              <p className="text-[10px] text-[#3d4466] -mt-0.5 font-medium tracking-wider uppercase">{t('crm_platform')}</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-[#6b7a99] hover:text-white hover:bg-[#1e1e38] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#1e1e38] to-transparent mb-3" />

        <p className="px-5 text-[10px] font-semibold text-[#3d4466] uppercase tracking-widest mb-2">{t('nav_label')}</p>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
                'text-[#6b7a99] hover:text-[#f0f0ff] hover:bg-[#0e0e1c]',
              )}
              activeProps={{
                className: cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
                  'text-teal-400 bg-teal-500/10 hover:bg-teal-500/10',
                  'border border-teal-500/20',
                  'shadow-[0_0_20px_rgba(45,212,191,0.05)]',
                ),
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1 font-medium">{label}</span>
                  {isActive && <ChevronRight size={12} className="text-teal-500" />}
                </>
              )}
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-5 pt-3 space-y-0.5 border-t border-[#1e1e38]">
          <Link
            to="/settings"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6b7a99] hover:text-[#f0f0ff] hover:bg-[#0e0e1c] transition-all"
            activeProps={{ className: 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-teal-400 bg-teal-500/10' }}
          >
            <Settings size={16} />
            <span className="font-medium">{t('nav_settings')}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6b7a99] hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer"
          >
            <LogOut size={16} />
            <span className="font-medium">{t('sign_out')}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
