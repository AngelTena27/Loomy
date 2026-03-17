import { useEffect } from 'react'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#07070f]/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        'relative w-full rounded-2xl border border-[#1e1e38]',
        'bg-[#0e0e1c]',
        'shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(45,212,191,0.05)]',
        size === 'sm' && 'max-w-sm',
        size === 'md' && 'max-w-lg',
        size === 'lg' && 'max-w-2xl',
      )}>
        {/* Top glow line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent rounded-full" />

        {title && (
          <div className="flex items-start justify-between px-6 py-5 border-b border-[#1e1e38]">
            <div>
              <h2 className="text-base font-semibold text-[#f0f0ff]">{title}</h2>
              {description && <p className="text-sm text-[#6b7a99] mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-[#3d4466] hover:text-[#6b7a99] transition-colors cursor-pointer mt-0.5 hover:bg-[#151528] rounded-md p-1 -mr-1"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
