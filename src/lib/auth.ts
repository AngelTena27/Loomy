import { betterAuth } from 'better-auth'
import { supabaseAdapter } from './auth-adapter'
import { createServerClient } from './supabase.server'

export const auth = betterAuth({
  database: supabaseAdapter,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5174',
  secret: process.env.BETTER_AUTH_SECRET ?? 'loomy-dev-secret',
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const supabase = createServerClient()
            const workspaceName = user.name
              ? `${user.name}'s Workspace`
              : user.email.split('@')[0] + "'s Workspace"

            const { data: workspace } = await supabase
              .from('workspaces')
              .insert({ name: workspaceName, owner_id: user.id })
              .select()
              .single()

            if (workspace) {
              await supabase.from('workspace_members').insert({
                workspace_id: workspace.id,
                user_id: user.id,
                role: 'owner',
              })
            }
          } catch {
            // Non-critical
          }
        },
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
