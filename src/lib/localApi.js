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

const seedComplaints = () => [
  {
    id: 'seed-cmp-1',
    ticket_no: 'PMC-W5-1042',
    ward_no: 5,
    category: 'Garbage & Sanitation',
    title: 'Overflowing Community Garbage Bin',
    description: 'Large waste heap overflowing onto main road near Mandir entrance. Waste spreading onto pedestrian walkway.',
    location_name: 'Ram Mandir Chowk, Laxmi Road',
    latitude: 18.5196,
    longitude: 73.8553,
    citizen_name: 'Rahul Joshi',
    citizen_phone: '9822******',
    status: 'RESOLVED',
    progress_step: 3,
    upvotes: 24,
    before_photo: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    after_photo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80',
    assigned_to: 'seed-emp-sahil',
    assigned_worker_name: 'Sahil Mulay',
    resolution_notes: 'Solid waste vehicle deployed. Area thoroughly cleared, swept, and disinfected with bleaching powder.',
    created_at: at(-2, 10, 15),
    resolved_at: at(-1, 14, 30),
  },
  {
    id: 'seed-cmp-2',
    ticket_no: 'PMC-W5-1088',
    ward_no: 5,
    category: 'Road & Potholes',
    title: 'Severe Pothole Causing Traffic Risk',
    description: 'Deep road depression and broken tarmac outside school gate after recent rains. Two-wheelers slipping.',
    location_name: 'Lane 3, Narayan Peth',
    latitude: 18.5200,
    longitude: 73.8560,
    citizen_name: 'Sneha Kulkarni',
    citizen_phone: '9823******',
    status: 'IN_PROGRESS',
    progress_step: 2,
    upvotes: 19,
    before_photo: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
    after_photo: null,
    assigned_to: 'seed-emp-sahil',
    assigned_worker_name: 'Sahil Mulay',
    resolution_notes: 'Road maintenance crew dispatched with hot-mix asphalt patching equipment.',
    created_at: at(0, 9, 30),
    resolved_at: null,
  },
  {
    id: 'seed-cmp-3',
    ticket_no: 'PMC-W5-1095',
    ward_no: 5,
    category: 'Drainage & Sewage',
    title: 'Blocked Stormwater Drain Spilling Foul Water',
    description: 'Choked gutter overflowing on walkway. Foul water accumulating with heavy mosquito breeding risk.',
    location_name: 'Shaniwar Peth Corner',
    latitude: 18.5188,
    longitude: 73.8520,
    citizen_name: 'Mahesh Deshmukh',
    citizen_phone: '9422******',
    status: 'RESOLVED',
    progress_step: 3,
    upvotes: 31,
    before_photo: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=600&q=80',
    after_photo: 'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&w=600&q=80',
    assigned_to: 'seed-emp-sahil',
    assigned_worker_name: 'Sahil Mulay',
    resolution_notes: 'Drainage desilted with suction machine. Chamber cover reseated and surrounding lane washed clean.',
    created_at: at(-3, 11, 0),
    resolved_at: at(-1, 16, 45),
  },
  {
    id: 'seed-cmp-4',
    ticket_no: 'PMC-W5-1102',
    ward_no: 5,
    category: 'Street Lighting',
    title: 'Non-functional Streetlights on Main Junction',
    description: 'Three consecutive streetlights dark since two nights. Intersection is hazardous for pedestrians after 7 PM.',
    location_name: 'Appa Balwant Chowk',
    latitude: 18.5165,
    longitude: 73.8540,
    citizen_name: 'Pooja Shinde',
    citizen_phone: '9765******',
    status: 'SUBMITTED',
    progress_step: 1,
    upvotes: 11,
    before_photo: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    after_photo: null,
    assigned_to: null,
    assigned_worker_name: null,
    resolution_notes: null,
    created_at: at(0, 11, 45),
    resolved_at: null,
  },
  {
    id: 'seed-cmp-5',
    ticket_no: 'PMC-W1-2015',
    ward_no: 1,
    category: 'Public Sanitation',
    title: 'Construction Debris Dumped on Walkway',
    description: 'Concrete debris and sand bags obstructing pedestrian traffic outside Shivajinagar Market.',
    location_name: 'Shivajinagar Market Gate',
    latitude: 18.5315,
    longitude: 73.8450,
    citizen_name: 'Vikram Kadam',
    citizen_phone: '9850******',
    status: 'RESOLVED',
    progress_step: 3,
    upvotes: 14,
    before_photo: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80',
    after_photo: 'https://images.unsplash.com/photo-1578965859416-83348d285b03?auto=format&fit=crop&w=600&q=80',
    assigned_to: 'seed-emp-amit',
    assigned_worker_name: 'Amit Shinde',
    resolution_notes: 'Debris carted away in municipal dumper truck. Walkway restored for public use.',
    created_at: at(-2, 14, 20),
    resolved_at: at(-1, 12, 10),
  },
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
    db = { users: seedUsers(), attendance: seedAttendance(), tasks: seedTasks(), complaints: seedComplaints(), tracking: [], alerts: [], session: null, seedDay: today }
    save(db)
  } else {
    db.tracking = db.tracking || []
    db.alerts = db.alerts || []
    if (!db.complaints || !db.complaints.length) {
      db.complaints = seedComplaints()
      save(db)
    }
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

  async addAttendance({ employee_id, blob, latitude, longitude, check_type, status, location_name, target_lat, target_lng, is_live }) {
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
      location_name: location_name || null,
      target_lat: target_lat ?? null,
      target_lng: target_lng ?? null,
      is_live: is_live ?? true,
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

  // ---------- citizen portal & complaints ----------
  async listComplaints({ wardNo, status, category, search } = {}) {
    const db = load()
    let list = db.complaints || []
    if (wardNo && wardNo !== 'ALL') {
      list = list.filter((c) => Number(c.ward_no) === Number(wardNo))
    }
    if (status && status !== 'ALL') {
      list = list.filter((c) => c.status === status)
    }
    if (category && category !== 'ALL') {
      list = list.filter((c) => c.category === category)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.ticket_no?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.location_name?.toLowerCase().includes(q)
      )
    }
    return delay(sortDesc(list, 'created_at'))
  },

  async createComplaint({
    ward_no,
    category,
    title,
    description,
    location_name,
    latitude,
    longitude,
    citizen_name,
    citizen_phone,
    before_photo,
  }) {
    const db = load()
    db.complaints = db.complaints || []
    const ticketNo = `PMC-W${ward_no}-${Math.floor(1000 + Math.random() * 9000)}`
    const complaint = {
      id: uid(),
      ticket_no: ticketNo,
      ward_no: Number(ward_no),
      category: category || 'General Municipal Issue',
      title: title.trim(),
      description: description?.trim() || '',
      location_name: location_name?.trim() || `Ward ${ward_no}`,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      citizen_name: citizen_name?.trim() || 'Ward Resident',
      citizen_phone: citizen_phone?.trim() || '',
      status: 'SUBMITTED',
      progress_step: 1, // 1: Logged, 2: In Progress, 3: Resolved
      upvotes: 1,
      before_photo: before_photo || null,
      after_photo: null,
      assigned_to: null,
      assigned_worker_name: null,
      resolution_notes: null,
      created_at: new Date().toISOString(),
      resolved_at: null,
    }
    db.complaints.unshift(complaint)
    save(db)
    return delay(complaint)
  },

  async upvoteComplaint(id) {
    const db = load()
    const c = (db.complaints || []).find((x) => x.id === id)
    if (c) {
      c.upvotes = (c.upvotes || 0) + 1
      save(db)
    }
    return delay(c)
  },

  async updateComplaintStatus(id, { status, progress_step, after_photo, resolution_notes, assigned_worker_name }) {
    const db = load()
    const c = (db.complaints || []).find((x) => x.id === id)
    if (c) {
      if (status) c.status = status
      if (progress_step) c.progress_step = progress_step
      if (after_photo) c.after_photo = after_photo
      if (resolution_notes) c.resolution_notes = resolution_notes
      if (assigned_worker_name) c.assigned_worker_name = assigned_worker_name
      if (status === 'RESOLVED' && !c.resolved_at) {
        c.resolved_at = new Date().toISOString()
        c.progress_step = 3
      }
      save(db)
    }
    return delay(c)
  },

  async getWardStaffAvailability(wardNo = 5) {
    const db = load()
    const wardNum = Number(wardNo)
    const employees = db.users.filter((u) => u.role === 'employee' && (wardNo === 'ALL' || u.ward_no === wardNum))
    const today = new Date()
    const p = (n) => String(n).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`

    const staffStatus = employees.map((emp) => {
      const checkIns = (db.attendance || [])
        .filter((a) => a.employee_id === emp.id && a.timestamp?.startsWith(todayStr))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      const latest = checkIns[0]
      const isOnDuty = latest && latest.check_type === 'CHECKIN'
      return {
        id: emp.id,
        name: emp.name,
        ward_no: emp.ward_no,
        onDuty: Boolean(isOnDuty),
        checkInTime: latest?.timestamp || null,
        photo_url: latest?.photo_url || null,
        location: latest ? { lat: latest.latitude, lng: latest.longitude } : null,
      }
    })

    const supervisor = db.users.find((u) => u.role === 'supervisor' && (wardNo === 'ALL' || u.ward_no === wardNum))

    return delay({
      ward_no: wardNum,
      supervisor: supervisor ? { name: supervisor.name, email: supervisor.email, ward_no: supervisor.ward_no } : null,
      staff: staffStatus,
      totalStaff: staffStatus.length,
      activeStaff: staffStatus.filter((s) => s.onDuty).length,
    })
  },

  // demo-only helper
  async resetDemo() {
    localStorage.removeItem(KEY)
    load()
    notify(null)
  },
}
