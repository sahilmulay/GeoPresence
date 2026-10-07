// Demo-mode backend: same API as supabaseApi, but data lives in localStorage.
// Used automatically when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set,
// so the app can always be demoed (even offline).
import { blobToDataUrl } from './device'

const KEY = 'geopresence_demo_v1'
export const DEMO_PASSWORD = 'Demo@123'

const listeners = new Set()

// ---------- seed ----------
const SUP_ID = 'seed-sup-rajesh'
const emp = (slug, name) => ({
  id: `seed-emp-${slug}`,
  role: 'employee',
  name,
  email: `${slug}@geopresence.demo`,
  password: DEMO_PASSWORD,
  ward_no: 5,
  supervisor_id: SUP_ID,
  created_at: new Date().toISOString(),
})

const seedUsers = () => [
  {
    id: SUP_ID,
    role: 'supervisor',
    name: 'Rajesh Patil',
    email: 'rajesh.patil@geopresence.demo',
    password: DEMO_PASSWORD,
    ward_no: 5,
    created_at: new Date().toISOString(),
  },
  emp('sahil', 'Sahil Mulay'),
  emp('amit', 'Amit Jadhav'),
  emp('rohit', 'Rohit Shinde'),
  emp('priya', 'Priya Kulkarni'),
]

// local time on a given day offset (0 = today), clamped so it is never in the future
const at = (dayOffset, h, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  const now = Date.now() - 60 * 1000
  return new Date(Math.min(d.getTime(), now)).toISOString()
}

const SPOTS = {
  sahil: [18.5196, 73.8553], // Laxmi Road market
  amit: [18.5314, 73.8446], // Shivajinagar
  rohit: [18.5018, 73.8636], // Swargate
  priya: [18.5074, 73.8077], // Kothrud
}

let n = 0
const att = (slug, check_type, ts, status = 'PRESENT') => {
  const [la, lo] = SPOTS[slug]
  const jitter = () => (Math.random() - 0.5) * 0.0006
  n += 1
  return {
    id: `seed-att-${n}`,
    employee_id: `seed-emp-${slug}`,
    photo_url: null,
    latitude: +(la + jitter()).toFixed(6),
    longitude: +(lo + jitter()).toFixed(6),
    timestamp: ts,
    check_type,
    status,
    created_at: ts,
  }
}

const seedAttendance = () => {
  n = 0
  const rows = [
    // today
    att('sahil', 'CHECKIN', at(0, 8, 58)),
    att('amit', 'CHECKIN', at(0, 8, 50)),
    att('amit', 'CHECKOUT', at(0, 13, 5)),
    att('priya', 'CHECKIN', at(0, 9, 15), 'FLAGGED'),
  ]
  // previous days (history)
  for (const d of [-1, -2, -3]) {
    for (const slug of ['sahil', 'amit', 'rohit', 'priya']) {
      rows.push(att(slug, 'CHECKIN', at(d, 9, 0 + Math.floor(Math.random() * 20))))
      rows.push(att(slug, 'CHECKOUT', at(d, 17, 0 + Math.floor(Math.random() * 20))))
    }
  }
  return rows
}

const task = (id, title, description, slug, status, daysAgo = 0, location_name = null, target_lat = null, target_lng = null) => ({
  id: `seed-task-${id}`,
  title,
  description,
  assigned_by: SUP_ID,
  assigned_to: `seed-emp-${slug}`,
  ward_no: 5,
  status,
  location_name,
  target_lat,
  target_lng,
  created_at: at(-daysAgo, 8, 0),
})

const seedTasks = () => [
  task(1, 'Road Cleaning', 'Area: Market Area. Sweep the main road and clear debris before 11 AM.', 'sahil', 'PENDING', 0, 'Ram Mandir Chowk', 18.5196, 73.8553),
  task(2, 'Drain Cleaning', 'Area: Lane 3. Clear blocked drain near the bus stop.', 'sahil', 'IN_PROGRESS', 0, 'Lane 3', 18.5200, 73.8560),
  task(3, 'Garbage Collection', 'Area: Gandhi Nagar. Collect garbage from all community bins.', 'amit', 'IN_PROGRESS', 0, 'Gandhi Nagar', 18.5314, 73.8446),
  task(4, 'Footpath Cleaning', 'Area: Shivajinagar. Clean footpath outside the market gate.', 'amit', 'COMPLETED', 1, 'Shivajinagar Market', 18.5315, 73.8450),
  task(5, 'Street Light Repair', 'Area: Shivaji Chowk. Check and fix 5 street lights.', 'rohit', 'PENDING', 0, 'Shivaji Chowk', 18.5018, 73.8636),
  task(6, 'Public Toilet Cleaning', 'Area: Bus Stand. Clean and restock community toilets.', 'priya', 'COMPLETED', 1, 'Bus Stand', 18.5074, 73.8077),
]

// ---------- storage ----------
function load() {
  let db = null
  try {
    db = JSON.parse(localStorage.getItem(KEY))
  } catch {
    db = null
  }
  const today = new Date().toDateString()
  if (!db) {
    db = { users: seedUsers(), attendance: seedAttendance(), tasks: seedTasks(), tracking: [], alerts: [], session: null, seedDay: today }
    save(db)
  } else {
    db.tracking = db.tracking || []
    db.alerts = db.alerts || []
    if (db.seedDay !== today) {
      // Keep demo data fresh: re-date the seeded attendance so "Present Today" is never empty.
      db.attendance = [...seedAttendance(), ...db.attendance.filter((a) => !a.id.startsWith('seed-'))]
      db.seedDay = today
      save(db)
    }
  }
  return db
}

const save = (db) => localStorage.setItem(KEY, JSON.stringify(db))
const uid = () => crypto.randomUUID()
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 150))
const notify = (id) => listeners.forEach((cb) => cb(id))

const publicUser = (u) => {
  if (!u) return null
  const { password: _p, ...rest } = u
  return rest
}

const sortDesc = (arr, f) => [...arr].sort((a, b) => new Date(b[f]) - new Date(a[f]))

export const localApi = {
  mode: 'demo',

  subscribe(cb) {
    listeners.add(cb)
    cb(load().session)
    return () => listeners.delete(cb)
  },

  async signUp({ role, name, email, password, ward_no }) {
    const db = load()
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
      throw new Error('An account with this email already exists')
    const user = {
      id: uid(),
      role,
      name,
      email,
      password,
      ward_no: Number(ward_no),
      created_at: new Date().toISOString(),
    }
    db.users.push(user)
    db.session = user.id
    save(db)
    notify(user.id)
    return { needsConfirmation: false }
  },

  async signIn({ email, password }) {
    const db = load()
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password)
    if (!u) throw new Error('Invalid email or password')
    db.session = u.id
    save(db)
    notify(u.id)
  },

  async signOut() {
    const db = load()
    db.session = null
    save(db)
    notify(null)
  },

  async getProfile(userId) {
    const db = load()
    const u = db.users.find((x) => x.id === userId)
    if (!u) return delay(null)
    const profile = publicUser(u)
    if (u.role === 'employee') {
      const sup = db.users.find((x) => x.role === 'supervisor' && x.ward_no === u.ward_no)
      profile.supervisor = sup ? { name: sup.name, email: sup.email } : null
    }
    return delay({ ...profile, role: u.role })
  },

  async listEmployees() {
    const db = load()
    const me = db.users.find((u) => u.id === db.session)
    return delay(
      db.users
        .filter((u) => u.role === 'employee' && u.ward_no === me?.ward_no)
        .map(publicUser)
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  },

  async listAttendance({ employeeId } = {}) {
    const db = load()
    const me = db.users.find((u) => u.id === db.session)
    const rows = db.attendance
      .map((a) => ({ ...a, employees: db.users.find((u) => u.id === a.employee_id) }))
      .filter((a) => a.employees && (employeeId ? a.employee_id === employeeId : a.employees.ward_no === me?.ward_no))
      .map((a) => ({ ...a, employees: { name: a.employees.name, ward_no: a.employees.ward_no } }))
    return delay(sortDesc(rows, 'timestamp'))
  },

  async addAttendance({ employee_id, blob, latitude, longitude, check_type, status }) {
    const photo_url = await blobToDataUrl(blob)
    const db = load()
    const ts = new Date().toISOString()
    db.attendance.push({
      id: uid(),
      employee_id,
      photo_url,
      latitude,
      longitude,
      timestamp: ts,
      check_type,
      status,
      location_name,
      target_lat,
      target_lng,
      created_at: ts,
    })
    save(db)
    return delay()
  },

  async listTasks({ employeeId } = {}) {
    const db = load()
    const me = db.users.find((u) => u.id === db.session)
    const rows = db.tasks
      .filter((t) => (employeeId ? t.assigned_to === employeeId : t.ward_no === me?.ward_no))
      .map((t) => ({
        ...t,
        location_name: t.location_name || (t.target_lat ? null : 'Ram Mandir Chowk, Ward 5'),
        assignee: { name: db.users.find((u) => u.id === t.assigned_to)?.name ?? 'Unknown' }
      }))
    return delay(sortDesc(rows, 'created_at'))
  },

  async createTask({ title, description, assigned_by, assigned_to, ward_no, status, location_name, target_lat, target_lng, radius_m = 50 }) {
    const db = load()
    db.tasks.push({
      id: uid(),
      title,
      description,
      assigned_by,
      assigned_to,
      ward_no,
      status,
      location_name: location_name || null,
      target_lat: target_lat ?? null,
      target_lng: target_lng ?? null,
      radius_m: Number(radius_m) || 50,
      created_at: new Date().toISOString(),
    })
    save(db)
    return delay()
  },

  async updateTaskStatus(id, status) {
    const db = load()
    const t = db.tasks.find((x) => x.id === id)
    if (t) t.status = status
    save(db)
    return delay()
  },

  async logTracking({ taskId, employeeId, latitude, longitude, distance, insideGeofence }) {
    const db = load()
    db.tracking = db.tracking || []
    const entry = {
      id: uid(),
      task_id: taskId,
      employee_id: employeeId,
      latitude,
      longitude,
      distance: Math.round(distance),
      inside_geofence: insideGeofence,
      timestamp: new Date().toISOString(),
    }
    db.tracking.push(entry)
    if (db.tracking.length > 500) db.tracking = db.tracking.slice(-500)
    save(db)
    return delay(entry)
  },

  async listTracking({ taskId, employeeId } = {}) {
    const db = load()
    let list = db.tracking || []
    if (taskId) list = list.filter((t) => t.task_id === taskId)
    if (employeeId) list = list.filter((t) => t.employee_id === employeeId)
    return delay(list)
  },

  async triggerBreachAlert({ taskId, employeeId, employeeName, taskTitle, distance, latitude, longitude }) {
    const db = load()
    db.alerts = db.alerts || []
    const alert = {
      id: uid(),
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
    db.alerts.unshift(alert)
    if (db.alerts.length > 50) db.alerts = db.alerts.slice(0, 50)
    save(db)

    // Broadcast across windows via BroadcastChannel
    try {
      const bc = new BroadcastChannel('geofence_breach_alerts')
      bc.postMessage(alert)
      bc.close()
    } catch {}

    // Broadcast via dedicated localStorage key
    try {
      localStorage.setItem('gp_latest_breach_alert', JSON.stringify(alert))
    } catch {}

    window.dispatchEvent(new CustomEvent('gp_breach_alert', { detail: alert }))
    return delay(alert)
  },

  subscribeAlerts(cb) {
    const cleanups = []

    const handler = (e) => cb(e.detail)
    window.addEventListener('gp_breach_alert', handler)
    cleanups.push(() => window.removeEventListener('gp_breach_alert', handler))

    try {
      const bc = new BroadcastChannel('geofence_breach_alerts')
      bc.onmessage = (e) => {
        if (e.data) cb(e.data)
      }
      cleanups.push(() => bc.close())
    } catch {}

    const storageHandler = (e) => {
      if (e.key === 'gp_latest_breach_alert' && e.newValue) {
        try {
          const item = JSON.parse(e.newValue)
          if (item) cb(item)
        } catch {}
      } else if (e.key === KEY) {
        const db = load()
        const latest = (db.alerts || []).filter((a) => !a.resolved)[0]
        if (latest) cb(latest)
      }
    }
    window.addEventListener('storage', storageHandler)
    cleanups.push(() => window.removeEventListener('storage', storageHandler))

    return () => {
      cleanups.forEach((fn) => fn())
    }
  },

  async listAlerts({ wardNo } = {}) {
    const db = load()
    return delay((db.alerts || []).filter((a) => !a.resolved))
  },

  async dismissAlert(alertId) {
    const db = load()
    const a = (db.alerts || []).find((x) => x.id === alertId)
    if (a) a.resolved = true
    save(db)
    return delay()
  },

  // demo-only helper
  async resetDemo() {
    localStorage.removeItem(KEY)
    load()
    notify(null)
  },
}
