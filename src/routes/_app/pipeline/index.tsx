import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Modal } from '../../../components/ui/modal'
import { listPipelinesFn, createPipelineFn } from '../../../server/pipeline'
import type { Workspace } from '../../../lib/types'
import { Plus, Kanban, ChevronRight, Circle } from 'lucide-react'
import { useLanguage } from '../../../lib/i18n'

export const Route = createFileRoute('/_app/pipeline/')({
  component: PipelinePage,
})

function PipelinePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; pipeline_stages: unknown[] }>>([])
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase.from('workspace_members').select('workspaces(*)').eq('user_id', user.id).limit(1).single()
      const ws = member?.workspaces as unknown as Workspace
      if (!ws) return
      setWorkspace(ws)
      const data = await listPipelinesFn({ data: { workspaceId: ws.id } })
      setPipelines(data as typeof pipelines)
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!workspace || !name.trim()) return
    setSaving(true)
    const pipeline = await createPipelineFn({ data: { workspace_id: workspace.id, name } })
    setPipelines(prev => [...prev, { ...pipeline, pipeline_stages: [] }])
    setShowModal(false)
    setName('')
    setSaving(false)
  }

  const stageColors = ['#2dd4bf', '#06b6d4', '#f59e0b', '#10b981', '#ef4444']

  return (
    <div className="p-6 lg:p-8 w-full">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest">{t('badge_sales')}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#f0f0ff] tracking-tight">{t('pipeline_title')}</h1>
          <p className="text-sm text-[#6b7a99] mt-1">{t('pipeline_sub')}</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} strokeWidth={2.5} /> {t('new_pipeline')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0e0e1c] border border-[#1e1e38] flex items-center justify-center">
            <Kanban size={28} className="text-[#2a2a4a]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#6b7a99]">{t('no_pipelines')}</p>
            <p className="text-xs text-[#3d4466] mt-1">{t('no_pipelines_sub')}</p>
          </div>
          <Button onClick={() => setShowModal(true)} variant="outline" size="sm">
            <Plus size={13} /> {t('create_pipeline')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map(pipeline => {
            const stages = pipeline.pipeline_stages as unknown[]
            return (
              <Link
                key={pipeline.id}
                to="/pipeline/$pipelineId"
                params={{ pipelineId: pipeline.id }}
                className="group relative rounded-2xl border border-[#1e1e38] bg-[#0e0e1c] p-5 hover:border-[#2a2a4a] transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-emerald-500/3 to-transparent" />

                <div className="relative flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Kanban size={18} className="text-emerald-400" />
                  </div>
                  <ChevronRight size={14} className="text-[#3d4466] group-hover:text-emerald-400 transition-colors mt-1" />
                </div>

                <h3 className="relative font-semibold text-[#d0d0f0] mb-1 text-sm">{pipeline.name}</h3>
                <p className="relative text-xs text-[#3d4466] mb-4">{stages.length} {t('stages_label')}</p>

                {/* Stage dots */}
                <div className="relative flex items-center gap-1.5">
                  {stageColors.slice(0, stages.length).map((color, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: 0.7 }} />
                      {i < stages.length - 1 && <div className="w-3 h-px bg-[#1e1e38]" />}
                    </div>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={t('modal_new_pipeline')} description={t('modal_pipeline_desc')} size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label={t('pipeline_name')} placeholder={t('ph_pipeline_name')} value={name} onChange={e => setName(e.target.value)} required />
          <div className="flex flex-wrap gap-1.5">
            {['New', 'Contacted', 'Qualified', 'Won', 'Lost'].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0e1c] border border-[#1e1e38] text-xs text-[#6b7a99]">
                <Circle size={6} fill={stageColors[i]} color={stageColors[i]} />
                {s}
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end border-t border-[#1e1e38] pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
            <Button type="submit" loading={saving}>{t('create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
