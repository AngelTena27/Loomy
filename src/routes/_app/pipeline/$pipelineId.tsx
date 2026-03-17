import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../../lib/supabase'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Modal } from '../../../components/ui/modal'
import { Badge } from '../../../components/ui/badge'
import { getPipelineWithDealsFn, createDealFn, moveDealFn, deleteDealFn } from '../../../server/pipeline'
import type { Deal, PipelineStage, Contact } from '../../../lib/types'
import { Plus, DollarSign, Trash2, GripVertical } from 'lucide-react'
import { DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

export const Route = createFileRoute('/_app/pipeline/$pipelineId')({
  component: KanbanPage,
})

interface StageWithDeals extends PipelineStage {
  deals: (Deal & { contact?: Contact })[]
}

interface DealCardProps {
  deal: Deal & { contact?: Contact }
  onDelete: (id: string) => void
}

function DealCard({ deal, onDelete }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-3 group hover:border-[#3a3a4a] transition-colors">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-0.5 text-gray-700 hover:text-gray-500 cursor-grab active:cursor-grabbing">
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{deal.title}</p>
          {deal.contact && (
            <p className="text-xs text-gray-500 mt-0.5">{deal.contact.first_name} {deal.contact.last_name}</p>
          )}
          {deal.value > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <DollarSign size={11} className="text-emerald-400" />
              <span className="text-xs text-emerald-400">{deal.currency} {deal.value.toLocaleString()}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(deal.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-all cursor-pointer"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function KanbanPage() {
  const { pipelineId } = Route.useParams()
  const [stages, setStages] = useState<StageWithDeals[]>([])
  const [loading, setLoading] = useState(true)
  const [pipelineName, setPipelineName] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [showAddDeal, setShowAddDeal] = useState<string | null>(null)
  const [dealTitle, setDealTitle] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const stagesRef = useRef<StageWithDeals[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (member) setWorkspaceId(member.workspace_id)

      const data = await getPipelineWithDealsFn({ data: { pipelineId } })
      setPipelineName(data.name)
      const stagesData = (data.pipeline_stages as StageWithDeals[]).map(s => ({
        ...s,
        deals: (s.deals ?? []).sort((a, b) => a.position - b.position),
      }))
      setStages(stagesData)
      stagesRef.current = stagesData
      setLoading(false)
    }
    load()
  }, [pipelineId])

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!showAddDeal || !dealTitle.trim() || !workspaceId) return
    setSaving(true)
    const deal = await createDealFn({ data: {
      stage_id: showAddDeal,
      workspace_id: workspaceId,
      title: dealTitle,
      value: parseFloat(dealValue) || 0,
    }})
    setStages(prev => prev.map(s =>
      s.id === showAddDeal ? { ...s, deals: [...s.deals, deal] } : s
    ))
    setShowAddDeal(null)
    setDealTitle('')
    setDealValue('')
    setSaving(false)
  }

  async function handleDeleteDeal(id: string) {
    if (!confirm('Delete this deal?')) return
    await deleteDealFn({ data: { id } })
    setStages(prev => prev.map(s => ({ ...s, deals: s.deals.filter(d => d.id !== id) })))
  }

  function findStageByDeal(dealId: string) {
    return stages.find(s => s.deals.some(d => d.id === dealId))
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const sourceStage = findStageByDeal(active.id as string)
    const targetStage = stages.find(s => s.id === over.id) ?? findStageByDeal(over.id as string)

    if (!sourceStage || !targetStage) return

    const deal = sourceStage.deals.find(d => d.id === active.id)!
    const newPosition = targetStage.deals.length

    setStages(prev => prev.map(s => {
      if (s.id === sourceStage.id) return { ...s, deals: s.deals.filter(d => d.id !== active.id) }
      if (s.id === targetStage.id) return { ...s, deals: [...s.deals, { ...deal, stage_id: targetStage.id }] }
      return s
    }))

    await moveDealFn({ data: { dealId: deal.id, stageId: targetStage.id, position: newPosition } })
  }

  const activeDeal = activeId ? stages.flatMap(s => s.deals).find(d => d.id === activeId) : null

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-600">Loading...</div>

  return (
    <div className="p-8 h-screen flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{pipelineName}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{stages.reduce((n, s) => n + s.deals.length, 0)} deals</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
          {stages.map(stage => (
            <div key={stage.id} className="flex-shrink-0 w-72 flex flex-col gap-2">
              {/* Column header */}
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-medium text-gray-300">{stage.name}</span>
                  <Badge className="text-[10px]">{stage.deals.length}</Badge>
                </div>
                <button
                  onClick={() => setShowAddDeal(stage.id)}
                  className="text-gray-600 hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Cards */}
              <SortableContext items={stage.deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 min-h-16 bg-[#0d0d14]/50 rounded-xl p-2 border border-[#1e1e2e]">
                  {stage.deals.map(deal => (
                    <DealCard key={deal.id} deal={deal} onDelete={handleDeleteDeal} />
                  ))}
                  {stage.deals.length === 0 && (
                    <div className="flex items-center justify-center py-4 text-gray-700 text-xs">
                      Drop cards here
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeDeal && (
            <div className="bg-[#1a1a24] border border-cyan-500/30 rounded-lg p-3 shadow-2xl w-72">
              <p className="text-sm font-medium text-gray-200">{activeDeal.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add deal modal */}
      <Modal open={!!showAddDeal} onClose={() => setShowAddDeal(null)} title="Add Deal" size="sm">
        <form onSubmit={handleAddDeal} className="space-y-4">
          <Input label="Deal title *" placeholder="New website project" value={dealTitle} onChange={e => setDealTitle(e.target.value)} required />
          <Input label="Value ($)" type="number" placeholder="0" value={dealValue} onChange={e => setDealValue(e.target.value)} />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowAddDeal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Deal</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
