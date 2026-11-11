import { createClient } from '@supabase/supabase-js'

const env = (import.meta as { env?: Record<string, string | undefined> }).env
const supabaseUrl = env?.VITE_SUPABASE_URL?.trim()
const supabaseKey = (
  env?.VITE_SUPABASE_ANON_KEY ?? env?.VITE_SUPABASE_PUBLISHABLE_KEY
)?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseKey!) : null