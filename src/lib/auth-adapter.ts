import { createAdapterFactory } from 'better-auth/adapters'
import { createServerClient } from './supabase.server'

type Where = {
  field: string
  value: unknown
  operator?: string
  connector?: string
}

const applyWhere = (query: any, where: Where[]) => {
  for (const w of where) {
    switch (w.operator ?? 'eq') {
      case 'eq': query = query.eq(w.field, w.value); break
      case 'ne': query = query.neq(w.field, w.value); break
      case 'lt': query = query.lt(w.field, w.value); break
      case 'lte': query = query.lte(w.field, w.value); break
      case 'gt': query = query.gt(w.field, w.value); break
      case 'gte': query = query.gte(w.field, w.value); break
      case 'in': query = query.in(w.field, w.value as unknown[]); break
      case 'contains': query = query.ilike(w.field, `%${w.value}%`); break
      case 'starts_with': query = query.ilike(w.field, `${w.value}%`); break
      case 'ends_with': query = query.ilike(w.field, `%${w.value}`); break
    }
  }
  return query
}

export const supabaseAdapter = createAdapterFactory({
  config: {
    supportsBooleans: true,
    supportsDates: true,
    supportsJSON: true,
    transaction: false,
  },
  adapter: () => ({
    async create({ model, data, select }) {
      const db = createServerClient()
      const { data: result, error } = await db
        .from(model)
        .insert(data as Record<string, unknown>)
        .select(select?.join(',') ?? '*')
        .single()
      if (error) throw new Error(error.message)
      return result as any
    },

    async findOne({ model, where, select }) {
      const db = createServerClient()
      let query: any = db.from(model).select(select?.join(',') ?? '*')
      query = applyWhere(query, where as Where[])
      const { data, error } = await query.limit(1).maybeSingle()
      if (error) throw new Error(error.message)
      return data ?? null
    },

    async findMany({ model, where, limit, offset, sortBy, select }) {
      const db = createServerClient()
      let query: any = db.from(model).select(select?.join(',') ?? '*')
      if (where) query = applyWhere(query, where as Where[])
      if (sortBy) query = query.order(sortBy.field, { ascending: sortBy.direction === 'asc' })
      if (typeof limit === 'number') query = query.limit(limit)
      if (typeof offset === 'number' && typeof limit === 'number') {
        query = query.range(offset, offset + limit - 1)
      }
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []) as any[]
    },

    async count({ model, where }) {
      const db = createServerClient()
      let query: any = db.from(model).select('*', { count: 'exact', head: true })
      if (where) query = applyWhere(query, where as Where[])
      const { count, error } = await query
      if (error) throw new Error(error.message)
      return count ?? 0
    },

    async update({ model, where, update }) {
      const db = createServerClient()
      let query: any = db.from(model).update(update as Record<string, unknown>).select('*')
      query = applyWhere(query, where as Where[])
      const { data, error } = await query.maybeSingle()
      if (error) throw new Error(error.message)
      return data ?? null
    },

    async updateMany({ model, where, update }) {
      const db = createServerClient()
      let query: any = db.from(model).update(update as Record<string, unknown>).select('id')
      query = applyWhere(query, where as Where[])
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data?.length ?? 0
    },

    async delete({ model, where }) {
      const db = createServerClient()
      let query: any = db.from(model).delete()
      query = applyWhere(query, where as Where[])
      const { error } = await query
      if (error) throw new Error(error.message)
    },

    async deleteMany({ model, where }) {
      const db = createServerClient()
      let query: any = db.from(model).delete().select('id')
      query = applyWhere(query, where as Where[])
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data?.length ?? 0
    },
  }),
})
