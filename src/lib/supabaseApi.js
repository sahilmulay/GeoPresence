// Supabase backend implementation of the GeoPresence data API.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured ? createClient(url, key) : null

const fail = (error) => {
  if (error) throw new Error(error.message || 'Something went wrong')
}

export const supabaseApi = {
  mode: 'supabase',

  // ---------- auth ----------
  subscribe(cb) {
    supabase.auth.getSession().then(({ data }) => cb(data.session?.user?.id ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user?.id ?? null))
    return () => data.subscription.unsubscribe()
  },

  async signUp({ role, name, email, password, ward_no }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // A database trigger reads this metadata and creates the supervisor/employee row.
      options: { data: { role, name, ward_no: Number(ward_no) } },
    })
    fail(error)
    return { needsConfirmation: !data.session }
  },

  async signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    fail(error)
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async getProfile(userId) {
    const { data: sup, error: e1 } = await supabase.from('supervisors').select('*').eq('id', userId).maybeSingle()
    fail(e1)
    if (sup) return { ...sup, role: 'supervisor' }

    const { data: emp, error: e2 } = await supabase
      .from('employees')
      .select('*, supervisor:supervisors(name, email)')
      .eq('id', userId)
      .maybeSingle()
    fail(e2)
    if (!emp) return null
    return { ...emp, role: 'employee' }
  },

  // ---------- data ----------
  async listEmployees() {
    const { data, error } = await supabase.from('employees').select('*').order('name')
    fail(error)
    return data
  },

  async listAttendance({ employeeId } = {}) {
    let q = supabase
      .from('attendance')
      .select('*, employees(name, ward_no)')
      .order('timestamp', { ascending: false })
      .limit(500)
    if (employeeId) q = q.eq('employee_id', employeeId)
    const { data, error } = await q
    fail(error)
    return data
  },

  async addAttendance({ employee_id, blob, latitude, longitude, check_type, status }) {
    const path = `${employee_id}/${Date.now()}-${check_type.toLowerCase()}.jpg`
    const up = await supabase.storage.from('selfies').upload(path, blob, { contentType: 'image/jpeg' })
    fail(up.error)
    const photo_url = supabase.storage.from('selfies').getPublicUrl(path).data.publicUrl

    const { error } = await supabase.from('attendance').insert({
      employee_id,
      photo_url,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      check_type,
      status,
    })
    fail(error)
  },

  async listTasks({ employeeId } = {}) {
    let q = supabase
      .from('tasks')
      .select('*, assignee:employees!assigned_to(name)')
      .order('created_at', { ascending: false })
    if (employeeId) q = q.eq('assigned_to', employeeId)
    const { data, error } = await q
    fail(error)
    return data
  },

  async createTask({ title, description, assigned_by, assigned_to, ward_no, status, location_name, target_lat, target_lng }) {
    const { error } = await supabase
      .from('tasks')
      .insert({ title, description, assigned_by, assigned_to, ward_no, status })
    fail(error)
  },

  async updateTaskStatus(id, status) {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
    fail(error)
  },
}
