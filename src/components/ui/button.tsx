import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none',
        variant === 'primary' && [
          'bg-teal-500 hover:bg-teal-400 text-[#07070f]',
          'shadow-[0_0_20px_rgba(45,212,191,0.25)] hover:shadow-[0_0_30px_rgba(45,212,191,0.4)]',
        ],
        variant === 'secondary' && 'bg-[#151528] hover:bg-[#1c1c35] text-[#a0aec0] hover:text-[#f0f0ff] border border-[#1e1e38] hover:border-[#2a2a4a]',
        variant === 'outline' && 'bg-transparent hover:bg-[#151528] text-teal-400 border border-teal-500/30 hover:border-teal-500/60',
        variant === 'ghost' && 'hover:bg-[#151528] text-[#6b7a99] hover:text-[#f0f0ff]',
        variant === 'danger' && 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40',
        size === 'xs' && 'text-xs px-2.5 py-1.5 h-7',
        size === 'sm' && 'text-xs px-3 py-2 h-8',
        size === 'md' && 'text-sm px-4 py-2 h-9',
        size === 'lg' && 'text-sm px-6 py-3 h-11',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
