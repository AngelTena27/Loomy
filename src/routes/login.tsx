import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { signUpFn } from '../server/auth'
import { Users, DollarSign, Workflow, ArrowUpRight, Zap, CheckCircle } from 'lucide-react'
import { useLanguage } from '../lib/i18n'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

function LeftPanel() {
  const { t } = useLanguage()

  const stats = [
    { icon: Users,      label: t('stat_leads'), value: '12',      sub: t('stat_leads_sub'), color: 'text-teal-400',    bg: 'bg-teal-500/10',    float: 'float-a' },
    { icon: DollarSign, label: t('stat_rev'),   value: '$24,500', sub: t('stat_rev_sub'),   color: 'text-emerald-400', bg: 'bg-emerald-500/10', float: 'float-b' },
    { icon: Workflow,   label: t('stat_auto'),  value: '7',       sub: t('stat_auto_sub'),  color: 'text-purple-400',  bg: 'bg-purple-500/10',  float: 'float-c' },
  ]

  const features = [
    t('feat_contacts'),
    t('feat_pipeline'),
    t('feat_automations'),
  ]

  return (
    <div className="hidden lg:flex flex-1 flex-col relative overflow-hidden border-r border-[#1e1e38]" style={{ background: '#07070f' }}>
      <div className="bg-grid-teal absolute inset-0 pointer-events-none opacity-60" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 40% 45%, rgba(45,212,191,0.07) 0%, transparent 100%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 40% 40% at 70% 70%, rgba(139,92,246,0.05) 0%, transparent 100%)' }} />

      <div className="relative flex flex-col h-full max-w-lg mx-auto w-full px-12 py-14">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-auto">
          <div className="relative w-9 h-9 shrink-0">
            <div className="absolute inset-0 bg-teal-500 rounded-xl opacity-30 blur-sm" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <Zap size={16} className="text-[#07070f]" strokeWidth={2.5} />
            </div>
          </div>
          <span className="font-bold text-[#f0f0ff] text-lg tracking-tight">Loomy</span>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col justify-center py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs text-teal-400 font-medium mb-6 self-start">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse inline-block" />
            {t('login_tagline')}
          </div>

          <h2 className="text-[2.6rem] font-black text-[#f0f0ff] leading-[1.15] tracking-tight mb-5">
            {t('login_headline1')}<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg,#2dd4bf,#5eead4)' }}>
              {t('login_headline2')}
            </span>
          </h2>

          <p className="text-[#6b7a99] text-sm leading-relaxed mb-8 max-w-sm">
            {t('login_body')}
          </p>

          {/* Feature bullets */}
          <div className="flex flex-col gap-2.5 mb-10">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-[#8892aa]">
                <CheckCircle size={14} className="text-teal-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Floating stat cards */}
          <div className="flex flex-col gap-3">
            {stats.map(({ icon: Icon, label, value, sub, color, bg, float: cls }) => (
              <div key={label} className={`${cls} flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[#1e1e38] bg-[#0e0e1c]/90`}
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={16} className={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#3d4466] uppercase tracking-wider font-semibold">{label}</p>
                  <p className="text-sm font-bold text-[#f0f0ff] leading-tight">{value}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <ArrowUpRight size={11} className={`${color} opacity-70`} />
                  <p className="text-[10px] text-[#6b7a99]">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#2a2a4a]">{t('copyright')}</p>
      </div>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [serverError, setServerError] = useState('')
  const { t } = useLanguage()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setServerError('')
    const supabase = createClient()

    if (isSignUp) {
      const result = await signUpFn({ data: { email: values.email, password: values.password } })
      if (result.error) { setServerError(result.error); return }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
      if (signInErr) { setServerError(signInErr.message); return }
      navigate({ to: '/dashboard' })
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
    if (error) { setServerError(error.message); return }
    navigate({ to: '/dashboard' })
  }

  return (
    <div className="flex min-h-screen bg-[#07070f]">
      <LeftPanel />

      {/* Right — form panel */}
      <div className="flex flex-col items-center justify-center w-full lg:w-[520px] lg:shrink-0 relative px-6 py-12">
        {/* Mobile bg */}
        <div className="lg:hidden absolute inset-0 pointer-events-none">
          <div className="bg-grid-teal absolute inset-0 opacity-60" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(45,212,191,0.06) 0%, transparent 100%)' }} />
        </div>

        <div className="relative w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="relative w-9 h-9 shrink-0">
              <div className="absolute inset-0 bg-teal-500 rounded-xl opacity-30 blur-sm" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <Zap size={16} className="text-[#07070f]" strokeWidth={2.5} />
              </div>
            </div>
            <span className="font-bold text-[#f0f0ff] text-xl tracking-tight">Loomy</span>
          </div>

          <div className="mb-7">
            <h1 className="text-[1.75rem] font-black text-[#f0f0ff] tracking-tight">
              {isSignUp ? t('create_account') : t('welcome_back')}
            </h1>
            <p className="text-sm text-[#6b7a99] mt-1">
              {isSignUp ? t('create_account_sub') : t('sign_in_sub')}
            </p>
          </div>

          <div className="rounded-2xl border border-[#1e1e38] overflow-hidden relative" style={{ background: '#0e0e1c', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.5), transparent)' }} />

            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#6b7a99] uppercase tracking-wider">{t('email_label')}</label>
                <input
                  key={`email-${isSignUp}`}
                  type="email"
                  autoComplete={isSignUp ? 'off' : 'email'}
                  autoFocus
                  placeholder="you@company.com"
                  {...register('email')}
                  className={[
                    'w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#3d4466]',
                    'border transition-all outline-none bg-[#0a0a17]',
                    errors.email
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-[#1e1e38] hover:border-[#2a2a4a] focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/10',
                  ].join(' ')}
                />
                {errors.email && <p className="text-xs text-red-400">⚠ {errors.email.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#6b7a99] uppercase tracking-wider">{t('password_label')}</label>
                <input
                  key={`password-${isSignUp}`}
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="••••••••••••"
                  {...register('password')}
                  className={[
                    'w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#3d4466]',
                    'border transition-all outline-none bg-[#0a0a17]',
                    errors.password
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-[#1e1e38] hover:border-[#2a2a4a] focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/10',
                  ].join(' ')}
                />
                {errors.password && <p className="text-xs text-red-400">⚠ {errors.password.message}</p>}
              </div>

              {serverError && (
                <div className="px-3.5 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-red-400">⚠ {serverError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl text-sm font-semibold text-[#07070f] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #2dd4bf, #14b8a6)', boxShadow: '0 0 24px rgba(45,212,191,0.2)' }}
              >
                {isSubmitting
                  ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{isSignUp ? t('creating') : t('signing_in')}</>
                  : (isSignUp ? t('create_account') : t('sign_in'))}
              </button>
            </div>

            <div className="px-6 py-4 border-t border-[#1e1e38] bg-[#0a0a17]">
              <button
                type="button"
                onClick={() => { setIsSignUp(v => !v); setServerError(''); reset() }}
                className="w-full text-xs text-[#6b7a99] hover:text-teal-400 transition-colors cursor-pointer font-medium text-center"
              >
                {isSignUp ? t('have_account') : t('no_account')}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-[#2a2a4a] mt-6">{t('secure')}</p>
        </div>
      </div>
    </div>
  )
}
