export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  workspace_id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  source: string | null
  tags: string[]
  notes: string | null
  avatar_url: string | null
  created_by_email: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface WorkspaceTag {
  id: string
  workspace_id: string
  name: string
  color: string
  created_at: string
}

export interface FlowRun {
  id: string
  flow_id: string | null
  flow_name: string
  contact_id: string
  workspace_id: string
  status: string
  triggered_by: string
  ran_at: string
}

export interface ContactFieldGroup {
  id: string
  workspace_id: string
  name: string
  position: number
  created_at: string
  contact_fields: ContactField[]
}

export interface ContactField {
  id: string
  group_id: string
  workspace_id: string
  name: string
  field_type: 'text' | 'number' | 'date' | 'url' | 'phone' | 'select'
  options: string[]
  position: number
  created_at: string
}

export interface ContactFieldValue {
  id: string
  contact_id: string
  field_id: string
  workspace_id: string
  value: string | null
  created_at: string
  updated_at: string
}

export interface Pipeline {
  id: string
  workspace_id: string
  name: string
  position: number
  created_at: string
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  name: string
  color: string
  position: number
  created_at: string
}

export interface Deal {
  id: string
  stage_id: string
  contact_id: string | null
  workspace_id: string
  title: string
  value: number
  currency: string
  position: number
  status: 'open' | 'won' | 'lost'
  close_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  contact?: Contact
}

export interface Flow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'archived'
  graph: FlowGraph
  trigger_type: string | null
  created_at: string
  updated_at: string
}

export interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: { x: number; y: number; zoom: number }
}

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface ContactNote {
  id: string
  contact_id: string
  workspace_id: string
  user_id: string | null
  user_email: string | null
  content: string
  type: 'note' | 'call' | 'email' | 'meeting'
  created_at: string
}

export interface User {
  id: string
  email: string
  user_metadata: Record<string, unknown>
}
