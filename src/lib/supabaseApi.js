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
    supabase.auth.getSession().then(({ data }) => cb(data.session?.user?.id ?? null)).catch((err) => { console.error(err); cb(null); })
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
    return (data ?? []).map((t) => ({
      ...t,
      location_name: t.location_name || (t.target_lat ? null : 'Ram Mandir Chowk, Ward 5'),
    }))
  },

  async createTask({ title, description, assigned_by, assigned_to, ward_no, status, location_name, target_lat, target_lng, radius_m = 50 }) {
    const payload = {
      title,
      description,
      assigned_by,
      assigned_to,
      ward_no,
      status,
      location_name: location_name || null,
      target_lat: target_lat ?? null,
      target_lng: target_lng ?? null,
    }

    // Try inserting with radius_m first
    const { error } = await supabase
      .from('tasks')
      .insert({
        ...payload,
        radius_m: Number(radius_m) || 50,
      })

    if (error) {
      // If the user's Supabase tasks table does not have radius_m yet, fall back seamlessly
      if (error.message?.includes('radius_m') || error.code === 'PGRST204') {
        const { error: retryError } = await supabase.from('tasks').insert(payload)
        fail(retryError)
        return
      }
      fail(error)
    }
  },

  async updateTaskStatus(id, status) {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
    fail(error)
  },

  async logTracking({ taskId, employeeId, latitude, longitude, distance, insideGeofence }) {
    try {
      await supabase.from('task_tracking').insert({
        task_id: taskId,
        employee_id: employeeId,
        latitude,
        longitude,
        distance: Math.round(distance),
        inside_geofence: insideGeofence,
      })
    } catch (e) {
      console.warn('logTracking to supabase skipped:', e.message)
    }
  },

  async listTracking({ taskId } = {}) {
    try {
      let q = supabase.from('task_tracking').select('*').order('created_at', { ascending: true })
      if (taskId) q = q.eq('task_id', taskId)
      const { data } = await q
      return data ?? []
    } catch {
      return []
    }
  },

  async triggerBreachAlert({ taskId, employeeId, employeeName, taskTitle, distance, latitude, longitude }) {
    const alertData = {
      id: crypto.randomUUID(),
      task_id: taskId,
      employee_id: employeeId,
      employee_name: employeeName || 'Employee',
      task_title: taskTitle || 'Assigned Task',
      distance: Math.round(distance),
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      resolved: false,
    }

    // 1. Broadcast over Supabase Realtime WebSocket (works across all devices instantly!)
    if (supabase) {
      try {
        const channel = supabase.channel('geofence_breach_alerts')
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'BREACH',
              payload: alertData,
            })
          }
        })
      } catch (err) {
        console.warn('Realtime broadcast error:', err)
      }
    }

    // 2. Try saving to task_alerts table
    try {
      await supabase.from('task_alerts').insert(alertData)
    } catch (e) {
      console.warn('triggerBreachAlert to supabase skipped:', e.message)
    }

    return alertData
  },

  subscribeAlerts(cb) {
    if (!supabase) return () => {}
    const channel = supabase.channel('geofence_breach_alerts')
    channel
      .on('broadcast', { event: 'BREACH' }, ({ payload }) => {
        cb(payload)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  },

  async listAlerts() {
    try {
      const { data } = await supabase.from('task_alerts').select('*').eq('resolved', false).order('created_at', { ascending: false })
      return data ?? []
    } catch {
      return []
    }
  },

  async dismissAlert(alertId) {
    try {
      await supabase.from('task_alerts').update({ resolved: true }).eq('id', alertId)
    } catch (e) {
      console.warn('dismissAlert skipped:', e.message)
    }
  },
}
