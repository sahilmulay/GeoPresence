// Supabase backend implementation of the GeoPresence data API.
import { createClient } from '@supabase/supabase-js'
import { localApi } from './localApi'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured ? createClient(url, key) : null

export const alertRealtimeChannel = supabase
  ? supabase.channel('geofence_breach_alerts', {
      config: { broadcast: { ack: true, self: true } },
    })
  : null

if (alertRealtimeChannel) {
  alertRealtimeChannel.subscribe()
}

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
    return (data ?? []).map((t) => {
      let localPhotos = []
      try {
        localPhotos = JSON.parse(localStorage.getItem(`gp_task_photos_${t.id}`) || '[]')
      } catch {}
      const remotePhotos = Array.isArray(t.photos) ? t.photos : []
      const mergedPhotos = [...remotePhotos, ...localPhotos.filter((lp) => !remotePhotos.some((rp) => rp.id === lp.id))]
      return {
        ...t,
        photos: mergedPhotos,
        location_name: t.location_name || (t.target_lat ? null : 'Ram Mandir Chowk, Ward 5'),
      }
    })
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

  async addTaskPhoto({ taskId, blob, caption, employeeId, employeeName }) {
    let photo_url = ''
    try {
      const path = `work-photos/${taskId}/${Date.now()}.jpg`
      const up = await supabase.storage.from('selfies').upload(path, blob, { contentType: 'image/jpeg' })
      if (!up.error) {
        photo_url = supabase.storage.from('selfies').getPublicUrl(path).data.publicUrl
      }
    } catch {}

    if (!photo_url) {
      photo_url = await new Promise((res) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result)
        reader.readAsDataURL(blob)
      })
    }

    const photoEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      url: photo_url,
      caption: caption?.trim() || '',
      timestamp: new Date().toISOString(),
      employee_id: employeeId,
      employee_name: employeeName || 'Employee',
    }

    // Cache locally as safety net
    try {
      const localKey = `gp_task_photos_${taskId}`
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]')
      localStorage.setItem(localKey, JSON.stringify([...existing, photoEntry]))
    } catch {}

    try {
      const { data } = await supabase.from('tasks').select('photos').eq('id', taskId).single()
      const existingPhotos = Array.isArray(data?.photos) ? data.photos : []
      await supabase.from('tasks').update({ photos: [...existingPhotos, photoEntry] }).eq('id', taskId)
    } catch (err) {
      console.warn('Could not update photos on supabase tasks table:', err)
    }

    return photoEntry
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
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      resolved: false,
    }

    // 1. Broadcast over Supabase Realtime WebSocket (cross-device)
    if (alertRealtimeChannel) {
      try {
        alertRealtimeChannel.send({
          type: 'broadcast',
          event: 'BREACH',
          payload: alertData,
        })
      } catch (err) {
        console.warn('Realtime broadcast error:', err)
      }
    }

    // 2. Broadcast across tabs/windows on same device
    try {
      const bc = new BroadcastChannel('geofence_breach_alerts')
      bc.postMessage(alertData)
      bc.close()
    } catch {}

    // 3. Store in localStorage for instant storage event detection
    try {
      localStorage.setItem('gp_latest_breach_alert', JSON.stringify(alertData))
    } catch {}

    // 4. Save to task_alerts table (using schema columns: created_at, resolved)
    if (supabase) {
      try {
        await supabase.from('task_alerts').insert({
          id: alertData.id,
          task_id: taskId,
          employee_id: employeeId,
          employee_name: alertData.employee_name,
          task_title: alertData.task_title,
          distance: alertData.distance,
          latitude: alertData.latitude,
          longitude: alertData.longitude,
          resolved: false,
          created_at: alertData.created_at,
        })
      } catch (e) {
        console.warn('triggerBreachAlert DB insert skipped:', e.message)
      }
    }

    return alertData
  },

  subscribeAlerts(cb) {
    const cleanups = []

    // 1. Supabase Realtime broadcast listener
    if (alertRealtimeChannel) {
      const sub = alertRealtimeChannel.on('broadcast', { event: 'BREACH' }, ({ payload }) => {
        if (payload) cb(payload)
      })
      cleanups.push(() => {
        // don't remove channel, just ignore
      })
    }

    // 2. Cross-tab BroadcastChannel
    try {
      const bc = new BroadcastChannel('geofence_breach_alerts')
      bc.onmessage = (e) => {
        if (e.data) cb(e.data)
      }
      cleanups.push(() => bc.close())
    } catch {}

    // 3. Storage event listener (cross-window on same host)
    const storageHandler = (e) => {
      if (e.key === 'gp_latest_breach_alert' && e.newValue) {
        try {
          const item = JSON.parse(e.newValue)
          if (item) cb(item)
        } catch {}
      }
    }
    window.addEventListener('storage', storageHandler)
    cleanups.push(() => window.removeEventListener('storage', storageHandler))

    return () => {
      cleanups.forEach((fn) => fn())
    }
  },

  async listAlerts() {
    if (!supabase) return []
    try {
      const { data, error } = await supabase
        .from('task_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
      if (error) {
        return []
      }
      return (data ?? []).map((a) => ({
        ...a,
        timestamp: a.created_at || a.timestamp,
      }))
    } catch {
      return []
    }
  },

  async dismissAlert(alertId) {
    if (supabase) {
      try {
        await supabase.from('task_alerts').update({ resolved: true }).eq('id', alertId)
      } catch (e) {
        console.warn('dismissAlert skipped:', e.message)
      }
    }
  },

  // ---------- citizen portal & complaints ----------
  async listComplaints({ wardNo, status, category, search } = {}) {
    if (!supabase) return localApi.listComplaints({ wardNo, status, category, search })
    try {
      let q = supabase.from('complaints').select('*').order('created_at', { ascending: false })
      if (wardNo && wardNo !== 'ALL') q = q.eq('ward_no', Number(wardNo))
      if (status && status !== 'ALL') q = q.eq('status', status)
      if (category && category !== 'ALL') q = q.eq('category', category)
      const { data, error } = await q
      if (error) throw error
      let list = data ?? []
      if (search) {
        const s = search.toLowerCase()
        list = list.filter(
          (c) =>
            c.title?.toLowerCase().includes(s) ||
            c.ticket_no?.toLowerCase().includes(s) ||
            c.description?.toLowerCase().includes(s) ||
            c.location_name?.toLowerCase().includes(s)
        )
      }
      return list
    } catch {
      return localApi.listComplaints({ wardNo, status, category, search })
    }
  },

  async createComplaint(payload) {
    if (!supabase) return localApi.createComplaint(payload)
    try {
      const ticketNo = `PMC-W${payload.ward_no}-${Math.floor(1000 + Math.random() * 9000)}`
      const row = {
        ticket_no: ticketNo,
        ward_no: Number(payload.ward_no),
        category: payload.category || 'General Municipal Issue',
        title: payload.title.trim(),
        description: payload.description?.trim() || '',
        location_name: payload.location_name?.trim() || `Ward ${payload.ward_no}`,
        latitude: payload.latitude != null ? Number(payload.latitude) : null,
        longitude: payload.longitude != null ? Number(payload.longitude) : null,
        citizen_name: payload.citizen_name?.trim() || 'Ward Resident',
        citizen_phone: payload.citizen_phone?.trim() || '',
        status: 'SUBMITTED',
        progress_step: 1,
        upvotes: 1,
        before_photo: payload.before_photo || null,
      }
      const { data, error } = await supabase.from('complaints').insert(row).select().single()
      if (error) throw error
      return data
    } catch {
      return localApi.createComplaint(payload)
    }
  },

  async upvoteComplaint(id) {
    if (!supabase) return localApi.upvoteComplaint(id)
    try {
      const { data, error } = await supabase.rpc('increment_complaint_upvote', { complaint_id: id })
      if (error) throw error
      return data
    } catch {
      return localApi.upvoteComplaint(id)
    }
  },

  async updateComplaintStatus(id, updates) {
    if (!supabase) return localApi.updateComplaintStatus(id, updates)
    try {
      const patch = { ...updates }
      if (updates.status === 'RESOLVED') {
        patch.resolved_at = new Date().toISOString()
        patch.progress_step = 3
      }
      const { data, error } = await supabase.from('complaints').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    } catch {
      return localApi.updateComplaintStatus(id, updates)
    }
  },

  async getWardStaffAvailability(wardNo = 5) {
    return localApi.getWardStaffAvailability(wardNo)
  },
}
