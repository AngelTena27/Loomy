import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ className, label, error, hint, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[#6b7a99] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full bg-[#0e0e1c] border border-[#1e1e38] rounded-lg px-3.5 py-2.5 text-sm text-[#f0f0ff] placeholder-[#3d4466]',
          'focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/10 transition-all duration-150',
          'hover:border-[#2a2a4a]',
          error && 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/10',
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-[#3d4466]">{hint}</p>}
      {error && <p className="text-xs text-red-400 flex items-center gap-1">⚠ {error}</p>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ className, label, error, id, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[#6b7a99] uppercase tracking-wider">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          'w-full bg-[#0e0e1c] border border-[#1e1e38] rounded-lg px-3.5 py-2.5 text-sm text-[#f0f0ff] placeholder-[#3d4466] resize-none',
          'focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/10 transition-all duration-150',
          'hover:border-[#2a2a4a]',
          error && 'border-red-500/40',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </div>
  )
}
