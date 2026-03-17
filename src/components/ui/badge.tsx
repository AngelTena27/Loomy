import { cn } from '../../lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'teal' | 'purple'
  className?: string
  dot?: boolean
}

export function Badge({ children, variant = 'default', dot, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide',
      variant === 'default' && 'bg-[#1c1c35] text-[#6b7a99] border border-[#1e1e38]',
      variant === 'success' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      variant === 'warning' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      variant === 'danger' && 'bg-red-500/10 text-red-400 border border-red-500/20',
      variant === 'teal' && 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
      variant === 'purple' && 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      className,
    )}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'success' && 'bg-emerald-400',
          variant === 'warning' && 'bg-amber-400',
          variant === 'danger' && 'bg-red-400',
          variant === 'teal' && 'bg-teal-400',
          variant === 'default' && 'bg-[#3d4466]',
        )} />
      )}
      {children}
    </span>
  )
}
