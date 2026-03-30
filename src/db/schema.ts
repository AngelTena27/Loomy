import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  customType,
} from 'drizzle-orm/pg-core'

const tsvector = customType<{ data: string }>({
  dataType() { return 'tsvector' },
})

// ─── Workspaces ───────────────────────────────────────────

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  owner_id: text('owner_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(),
  role: text('role').notNull().default('member'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const workspaceTags = pgTable('workspace_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

// ─── Contacts ─────────────────────────────────────────────

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  first_name: text('first_name').notNull(),
  last_name: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  source: text('source'),
  tags: text('tags').array().notNull().default([]),
  notes: text('notes'),
  avatar_url: text('avatar_url'),
  created_by_email: text('created_by_email'),
  created_by_name: text('created_by_name'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export const contactNotes = pgTable('contact_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  contact_id: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: text('user_id'),
  user_email: text('user_email'),
  content: text('content').notNull(),
  type: text('type').notNull().default('note'), // note | call | email | meeting
  created_at: timestamp('created_at').defaultNow().notNull(),
})

// ─── Custom Fields ────────────────────────────────────────

export const contactFieldGroups = pgTable('contact_field_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const contactFields = pgTable('contact_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  group_id: uuid('group_id').notNull().references(() => contactFieldGroups.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  field_type: text('field_type').notNull(), // text | number | date | url | phone | select
  options: text('options').array().notNull().default([]),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const contactFieldValues = pgTable('contact_field_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  contact_id: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  field_id: uuid('field_id').notNull().references(() => contactFields.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  value: text('value'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Pipelines & Deals ────────────────────────────────────

export const pipelines = pgTable('pipelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const pipelineStages = pgTable('pipeline_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipeline_id: uuid('pipeline_id').notNull().references(() => pipelines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  stage_id: uuid('stage_id').notNull().references(() => pipelineStages.id, { onDelete: 'cascade' }),
  contact_id: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  value: numeric('value').notNull().default('0'),
  currency: text('currency').notNull().default('USD'),
  position: integer('position').notNull().default(0),
  status: text('status').notNull().default('open'), // open | won | lost
  close_date: text('close_date'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Flows ────────────────────────────────────────────────

export const flows = pgTable('flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('draft'), // draft | active | paused | archived
  graph: jsonb('graph').notNull().default({}),
  trigger_type: text('trigger_type'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// ─── WhatsApp ─────────────────────────────────────────────

export const whatsappInstances = pgTable('whatsapp_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  instance_name: text('instance_name').notNull(),
  phone_number: text('phone_number'),
  status: text('status').notNull().default('disconnected'), // disconnected | connecting | connected
  provider: text('provider').notNull().default('evolution'),  // evolution | meta
  qr_code: text('qr_code'), // base64 QR temporal mientras conecta
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  instance_id: uuid('instance_id').notNull().references(() => whatsappInstances.id, { onDelete: 'cascade' }),
  contact_id: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  direction: text('direction').notNull(), // inbound | outbound
  content: text('content').notNull(),
  wa_message_id: text('wa_message_id'),
  status: text('status').notNull().default('sent'), // sent | delivered | read | failed
  created_at: timestamp('created_at').defaultNow().notNull(),
})

// ─── Agents ───────────────────────────────────────────────

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: text('workspace_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  system_prompt: text('system_prompt'),
  model: text('model').notNull().default('claude-sonnet-4-6'),
  is_published: boolean('is_published').notNull().default(false),
  public_token: text('public_token').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export const agentConversations = pgTable('agent_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  workspace_id: text('workspace_id'),
  is_public: boolean('is_public').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const agentMessages = pgTable('agent_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversation_id: uuid('conversation_id').notNull().references(() => agentConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  property_ids: uuid('property_ids').array(),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const agentProperties = pgTable('agent_properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  workspace_id: text('workspace_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  price: numeric('price'),
  currency: text('currency').default('USD'),
  area_m2: numeric('area_m2'),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  property_type: text('property_type'),
  location: text('location'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  status: text('status').notNull().default('available'),
  extra: jsonb('extra'),
  search_vector: tsvector('search_vector'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export const agentPropertyImages = pgTable('agent_property_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  property_id: uuid('property_id').notNull().references(() => agentProperties.id, { onDelete: 'cascade' }),
  agent_id: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  storage_path: text('storage_path').notNull(),
  url: text('url').notNull(),
  display_order: integer('display_order').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

// ─── Flow Runs ────────────────────────────────────────────

export const flowRuns = pgTable('flow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  flow_id: uuid('flow_id').references(() => flows.id, { onDelete: 'set null' }),
  flow_name: text('flow_name').notNull(),
  contact_id: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('completed'), // completed | failed
  triggered_by: text('triggered_by').notNull().default('manual'),
  node_logs: jsonb('node_logs').default([]),
  ran_at: timestamp('ran_at').defaultNow().notNull(),
})
