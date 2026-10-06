import { isSupabaseConfigured, supabaseApi } from './supabaseApi'
import { localApi } from './localApi'

// Real Supabase when env vars are present, otherwise browser-only demo mode.
export const api = isSupabaseConfigured ? supabaseApi : localApi
export const isDemoMode = !isSupabaseConfigured
export { localApi }
