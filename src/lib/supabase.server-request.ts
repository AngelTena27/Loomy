import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'

// Creates a Supabase client that reads/writes cookies from the current request
// Use this in server functions to properly get the auth session
export function createRequestClient() {
  return createSupabaseServerClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = getCookies()
          return Object.entries(cookies).map(([name, value]) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            setCookie(name, value, options)
          }
        },
      },
    },
  )
}
