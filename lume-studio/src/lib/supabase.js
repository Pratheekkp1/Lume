import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(supabaseUrl && supabaseKey)

// Placeholder values keep the module importable when env vars are missing;
// App renders a setup screen instead of making requests in that case.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'missing-anon-key',
)

/**
 * Storage path inside the signed-in user's folder ("<uid>/<...parts>").
 * Storage policies only allow writes under your own user id.
 */
export async function userStoragePath(...parts) {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Not signed in')
  return [uid, ...parts].join('/')
}

export function uniqueFileName(file) {
  const ext = file.name.split('.').pop()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
}
