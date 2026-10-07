import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { useData } from '../../lib/useData'
import { fmtDateTime, fmtDate, fmtTime } from '../../lib/format'
import { Badge, Button, Card, Empty, ErrorNote, Field, PageLoader, SectionTitle, inputCls } from '../../components/ui'

const WARDS = [
  { no: 5, name: 'Ward 5 - Pune Central / Laxmi Road' },
  { no: 1, name: 'Ward 1 - Shivajinagar / Model Colony' },
  { no: 2, name: 'Ward 2 - Kothrud / Karve Road' },
  { no: 3, name: 'Ward 3 - Swargate / Parvati' },
]

const CATEGORIES = [
  'All',
  'Garbage & Sanitation',
  'Road & Potholes',
  'Drainage & Sewage',
  'Street Lighting',
  'Public Sanitation',
]

export default function CitizenPortal() {
  const { lang, setLang, t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentWardParam = searchParams.get('ward') ? Number(searchParams.get('ward')) : 5

  const [selectedWard, setSelectedWard] = useState(currentWardParam || 5)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'staff' | 'works' | 'complaints' | 'evidence' | 'track'
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [trackingTicket, setTrackingTicket] = useState('')
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)

  // Fetch data
  const staffData = useData(
    () => api.getWardStaffAvailability?.(selectedWard),
    [selectedWard],
    { poll: 15000 }
  )

  const tasksData = useData(
    () => api.listTasks?.(),
    [],
    { poll: 15000 }
  )

  const complaintsData = useData(
    () => api.listComplaints?.({ wardNo: selectedWard }),
    [selectedWard],
    { poll: 10000 }
  )

  // Form state for filing complaint
  const [form, setForm] = useState({
    title: '',
    category: 'Garbage & Sanitation',
    description: '',
    location_name: '',
    citizen_name: '',
    citizen_phone: '',
    before_photo: '',
  })
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [formError, setFormError] = useState('')

  const handleWardChange = (newWard) => {
    setSelectedWard(Number(newWard))
    setSearchParams({ ward: newWard })
  }

  // Filter tasks for selected ward
  const wardTasks = useMemo(() => {
    return (tasksData.data ?? []).filter((t) => Number(t.ward_no) === Number(selectedWard))
  }, [tasksData.data, selectedWard])

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    let list = complaintsData.data ?? []
    if (categoryFilter !== 'All') {
      list = list.filter((c) => c.category === categoryFilter)
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((c) => c.status === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.ticket_no?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.location_name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [complaintsData.data, categoryFilter, statusFilter, searchQuery])

  // Complaints with both before and after evidence
  const evidenceComplaints = useMemo(() => {
    return (complaintsData.data ?? []).filter((c) => c.before_photo && c.after_photo)
  }, [complaintsData.data])

  // Upvote complaint
  const handleUpvote = async (e, id) => {
    e.stopPropagation()
    await api.upvoteComplaint?.(id)
    complaintsData.reload(true)
  }

  // Handle Photo input (file / camera)
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setPhotoPreview(reader.result)
        setForm((f) => ({ ...f, before_photo: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  // Submit Complaint
  const handleSubmitComplaint = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitSuccess('')
    if (!form.title.trim()) return setFormError('Please enter a complaint title')
    setSubmitting(true)
    try {
      const res = await api.createComplaint?.({
        ...form,
        ward_no: selectedWard,
      })
      setSubmitSuccess(`Complaint successfully registered! Your Ticket Number is #${res.ticket_no}. Save this number to track resolution progress.`)
      setForm({
        title: '',
        category: 'Garbage & Sanitation',
        description: '',
        location_name: '',
        citizen_name: '',
        citizen_phone: '',
        before_photo: '',
      })
      setPhotoPreview(null)
      await complaintsData.reload(true)
      setTimeout(() => {
        setShowFileModal(false)
        setSubmitSuccess('')
      }, 3500)
    } catch (err) {
      setFormError(err.message || 'Failed to submit complaint')
    } finally {
      setSubmitting(false)
    }
  }

  // Track specific complaint
  const trackedComplaint = useMemo(() => {
    if (!trackingTicket.trim()) return null
    const query = trackingTicket.trim().toUpperCase()
    return (complaintsData.data ?? []).find(
      (c) => c.ticket_no?.toUpperCase().includes(query) || c.id === query
    )
  }, [trackingTicket, complaintsData.data])

  const staff = staffData.data?.staff ?? []
  const activeStaffCount = staffData.data?.activeStaff ?? 0
  const totalStaffCount = staffData.data?.totalStaff ?? staff.length

  const completedWorks = wardTasks.filter((t) => t.status === 'COMPLETED').length
  const inProgressWorks = wardTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const resolvedComplaintsCount = (complaintsData.data ?? []).filter((c) => c.status === 'RESOLVED').length

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-20">
      {/* Top Banner & Header */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <span className="text-xl">🏛️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                  PMC CITIZEN PORTAL
                </span>
                <span className="text-xs text-slate-500 font-medium">Pune Municipal Corporation</span>
              </div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                Civic Transparency & Public Works
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'en' ? 'mr' : 'en')}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {lang === 'en' ? 'मराठी' : 'English'}
            </button>
            <Link
              to="/auth/login"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shadow-sm"
            >
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* Ward Selector Bar */}
      <section className="border-b border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">Select Ward:</span>
            <select
              value={selectedWard}
              onChange={(e) => handleWardChange(e.target.value)}
              className="rounded-xl border border-blue-300 bg-blue-50/60 px-3 py-1.5 text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
            >
              {WARDS.map((w) => (
                <option key={w.no} value={w.no}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFileModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-transform"
            >
              <span>📢</span>
              <span>Report Civic Issue / File Complaint</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-4 pt-4">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card className="p-3 bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <span className="text-xs font-semibold text-blue-800 block">👷 Staff On Duty</span>
            <p className="text-2xl font-black text-blue-950 mt-1">
              {activeStaffCount} <span className="text-xs font-normal text-slate-500">/ {totalStaffCount}</span>
            </p>
            <span className="text-[11px] text-green-700 font-semibold">● Active in Ward {selectedWard}</span>
          </Card>

          <Card className="p-3 bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <span className="text-xs font-semibold text-amber-800 block">🚜 Public Works</span>
            <p className="text-2xl font-black text-amber-950 mt-1">
              {inProgressWorks} <span className="text-xs font-normal text-slate-500">Active</span>
            </p>
            <span className="text-[11px] text-slate-600">{completedWorks} completed this week</span>
          </Card>

          <Card className="p-3 bg-gradient-to-br from-rose-50 to-white border-rose-200">
            <span className="text-xs font-semibold text-rose-800 block">📢 Public Complaints</span>
            <p className="text-2xl font-black text-rose-950 mt-1">
              {(complaintsData.data ?? []).length}
            </p>
            <span className="text-[11px] text-rose-700 font-medium">{resolvedComplaintsCount} resolved</span>
          </Card>

          <Card className="p-3 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <span className="text-xs font-semibold text-emerald-800 block">📸 Verified Proof</span>
            <p className="text-2xl font-black text-emerald-950 mt-1">
              {evidenceComplaints.length}
            </p>
            <span className="text-[11px] text-emerald-700 font-medium">Before/After photos</span>
          </Card>
        </div>

        {/* Feature Navigation Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none border-b border-slate-200 text-xs font-bold">
          {[
            ['overview', '🏛️ Ward Overview'],
            ['staff', '✅ Staff Availability'],
            ['works', '✅ Public Works & Status'],
            ['complaints', '✅ Public Complaints'],
            ['evidence', '✅ Before/After Evidence'],
            ['track', '✅ Complaint Progress'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 transition-all ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ============================================================== */}
        {/* 1. OVERVIEW & WARD SUMMARY */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card className="p-4 border-blue-200 bg-blue-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    WARD CITIZEN CHARTER
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    Municipal Operations & Civic Services for Ward {selectedWard}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl">
                    Transparency guarantee by Pune Municipal Corporation: Track daily staff attendance, ongoing road/drainage works, and verified Before/After photos of citizen resolutions.
                  </p>
                </div>
                <div className="text-right sm:text-right text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-blue-200">
                  <p className="font-bold text-slate-900">Ward Supervisor</p>
                  <p className="text-blue-700 font-semibold">{staffData.data?.supervisor?.name || 'Rajesh Patil'}</p>
                  <p className="text-[11px] text-slate-500">Emergency: 020-25501000</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quick Staff Availability Preview */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>👷</span> Staff Availability Today
                  </h3>
                  <button
                    onClick={() => setActiveTab('staff')}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View All Staff →
                  </button>
                </div>
                {staff.length ? (
                  <div className="space-y-2">
                    {staff.slice(0, 3).map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                            {emp.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{emp.name}</p>
                            <p className="text-[10px] text-slate-500">Municipal Field Worker</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          emp.onDuty ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {emp.onDuty ? '🟢 On Duty' : '⚪ Off Duty'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>Loading staff data…</Empty>
                )}
              </Card>

              {/* Quick Public Works Preview */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>🚜</span> Active Public Works
                  </h3>
                  <button
                    onClick={() => setActiveTab('works')}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View All Works →
                  </button>
                </div>
                {wardTasks.length ? (
                  <div className="space-y-2">
                    {wardTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                        <div>
                          <p className="font-bold text-slate-800 truncate max-w-[200px]">{task.title}</p>
                          <p className="text-[10px] text-slate-500">📍 {task.location_name || `Ward ${selectedWard}`}</p>
                        </div>
                        <Badge value={task.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>No tasks scheduled for this ward.</Empty>
                )}
              </Card>
            </div>

            {/* Before / After Evidence Feature Box */}
            <Card className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    TRANSPARENCY IN ACTION
                  </span>
                  <h3 className="font-bold text-base text-slate-900">Before & After Verified Evidence</h3>
                  <p className="text-xs text-slate-600">See real proof of complaints resolved by our municipal team.</p>
                </div>
                <button
                  onClick={() => setActiveTab('evidence')}
                  className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                >
                  Browse Gallery →
                </button>
              </div>

              {evidenceComplaints.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded-lg overflow-hidden border border-red-200 bg-white shadow-xs">
                    <img src={evidenceComplaints[0].before_photo} alt="Before" className="h-32 w-full object-cover" />
                    <div className="p-1.5 text-center bg-red-50 text-[11px] font-bold text-red-700">
                      🚨 Before: {evidenceComplaints[0].title}
                    </div>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-green-200 bg-white shadow-xs">
                    <img src={evidenceComplaints[0].after_photo} alt="After" className="h-32 w-full object-cover" />
                    <div className="p-1.5 text-center bg-green-50 text-[11px] font-bold text-green-700">
                      ✅ After: Resolved & Cleaned
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. STAFF AVAILABILITY (WARD LEVEL) */}
        {/* ============================================================== */}
        {activeTab === 'staff' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Ward {selectedWard} Staff Availability</h2>
                <p className="text-xs text-slate-500">Live roster of municipal sanitation & maintenance employees on duty today.</p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                {activeStaffCount} Present Today
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {staff.map((emp) => (
                <Card key={emp.id} className="p-3.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      {emp.photo_url ? (
                        <img src={emp.photo_url} alt="" className="h-12 w-12 rounded-full object-cover border border-slate-200 shadow-xs" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-sm shadow-xs">
                          {emp.name[0]}
                        </div>
                      )}
                      <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                        emp.onDuty ? 'bg-green-500' : 'bg-slate-300'
                      }`} />
                    </div>

                    <div>
                      <p className="font-bold text-sm text-slate-900">{emp.name}</p>
                      <p className="text-xs text-slate-500">Ward {emp.ward_no} Field Worker</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {emp.onDuty ? (
                          <span className="text-green-700 font-semibold">
                            🕒 Checked in at {fmtTime(emp.checkInTime)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not checked in today</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    emp.onDuty ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {emp.onDuty ? 'On Duty' : 'Off Duty'}
                  </span>
                </Card>
              ))}
            </div>

            {/* Ward Supervisor Contact Card */}
            <Card className="p-4 border-blue-200 bg-blue-50/50">
              <h3 className="font-bold text-sm text-blue-900 mb-1">Ward Authority & Supervisor In-Charge</h3>
              <p className="text-xs text-slate-700">
                Supervisor: <b>{staffData.data?.supervisor?.name || 'Rajesh Patil'}</b> (Ward {selectedWard})
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                For urgent ward sanitation grievances, citizens can also dial the PMC Ward Control Room at <b>020-25501000</b>.
              </p>
            </Card>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. PUBLIC WORKS & WORK STATUS */}
        {/* ============================================================== */}
        {activeTab === 'works' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Public Works & Scheduled Tasks</h2>
                <p className="text-xs text-slate-500">Daily civic maintenance operations and their real-time execution status.</p>
              </div>
              <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-bold">
                {[['ALL', 'All'], ['IN_PROGRESS', 'Active'], ['COMPLETED', 'Done']].map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setStatusFilter(val)}
                    className={`rounded-md px-2.5 py-1 ${statusFilter === val ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {wardTasks.length ? (
                wardTasks
                  .filter((t) => statusFilter === 'ALL' || t.status === statusFilter)
                  .map((task) => (
                    <Card key={task.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-slate-900">{task.title}</h3>
                            <Badge value={task.status} />
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-600 mt-1">{task.description}</p>
                          )}
                        </div>
                        {task.radius_m && (
                          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
                            🛰️ {task.radius_m}m Geofence
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <span>📍</span>
                          <span>{task.location_name || `Ward ${selectedWard} Designated Area`}</span>
                        </span>
                        <span>Assigned Crew: <b className="text-slate-800">{task.assignee?.name || 'Municipal Team'}</b></span>
                        <span>{fmtDate(task.created_at)}</span>
                      </div>
                    </Card>
                  ))
              ) : (
                <Empty>No public works currently recorded for Ward {selectedWard}.</Empty>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. PUBLIC COMPLAINTS & FEED */}
        {/* ============================================================== */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Public Complaints & Grievances</h2>
                <p className="text-xs text-slate-500">Browse reported civic issues in Ward {selectedWard} and upvote to prioritize them.</p>
              </div>
              <button
                onClick={() => setShowFileModal(true)}
                className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                + File New Complaint
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-2.5 border border-slate-200 shadow-xs">
              <input
                type="text"
                placeholder="Search ticket # or keyword (e.g. pothole)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />

              <div className="flex gap-1 overflow-x-auto text-xs font-bold">
                {CATEGORIES.slice(0, 4).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-lg px-2.5 py-1 ${categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Complaints Feed */}
            <div className="space-y-3">
              {filteredComplaints.length ? (
                filteredComplaints.map((c) => (
                  <Card
                    key={c.id}
                    onClick={() => {
                      setSelectedComplaint(c)
                      setTrackingTicket(c.ticket_no)
                      setActiveTab('track')
                    }}
                    className="p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            #{c.ticket_no}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            {c.category}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            c.status === 'RESOLVED'
                              ? 'bg-green-100 text-green-800'
                              : c.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-slate-900 mt-1">{c.title}</h3>
                        <p className="text-xs text-slate-600 mt-1">{c.description}</p>
                      </div>

                      {/* Before thumbnail if present */}
                      {c.before_photo && (
                        <img
                          src={c.before_photo}
                          alt="Evidence"
                          className="h-16 w-16 shrink-0 rounded-lg object-cover border border-slate-200 shadow-xs"
                        />
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                      <span>📍 {c.location_name} · Reported by {c.citizen_name}</span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleUpvote(e, c.id)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span>👍 Support</span>
                          <span className="font-mono">{c.upvotes || 1}</span>
                        </button>
                        <span className="text-blue-600 font-bold hover:underline">Track Progress →</span>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Empty>No complaints found matching criteria in Ward {selectedWard}.</Empty>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. BEFORE / AFTER EVIDENCE GALLERY */}
        {/* ============================================================== */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Verified Before / After Evidence Gallery</h2>
              <p className="text-xs text-slate-500">
                Official transparency portal showing photo proof of civic issues resolved by municipal field staff in Ward {selectedWard}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evidenceComplaints.length ? (
                evidenceComplaints.map((item) => (
                  <Card key={item.id} className="overflow-hidden border border-slate-200 shadow-sm">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          #{item.ticket_no}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 mt-0.5">{item.title}</h3>
                        <p className="text-[11px] text-slate-500">📍 {item.location_name}</p>
                      </div>
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-bold text-green-800">
                        ✅ Verified Resolution
                      </span>
                    </div>

                    {/* Dual comparison photos */}
                    <div className="grid grid-cols-2 gap-1 p-2 bg-slate-100">
                      <div className="relative rounded-lg overflow-hidden bg-black/10">
                        <img src={item.before_photo} alt="Before" className="h-40 w-full object-cover" />
                        <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                          Before (Issue)
                        </span>
                      </div>
                      <div className="relative rounded-lg overflow-hidden bg-black/10">
                        <img src={item.after_photo} alt="After" className="h-40 w-full object-cover" />
                        <span className="absolute bottom-1 left-1 rounded bg-green-700 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                          After (Cleaned)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">Work Notes:</p>
                      <p className="text-slate-600 mt-0.5">{item.resolution_notes || 'Cleaned and sanitized by field crew.'}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span>Worker: <b>{item.assigned_worker_name || 'Municipal Team'}</b></span>
                        <span>Resolved on {fmtDate(item.resolved_at || item.created_at)}</span>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Empty>No verified before/after evidence items logged yet for Ward {selectedWard}.</Empty>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. COMPLAINT PROGRESS & TIMELINE TRACKER */}
        {/* ============================================================== */}
        {activeTab === 'track' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Complaint Progress Tracker</h2>
              <p className="text-xs text-slate-500">Track real-time action steps and timeline of your municipal ticket.</p>
            </div>

            {/* Ticket Search Bar */}
            <Card className="p-4 bg-blue-50/50 border-blue-200">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Enter Ticket Number (e.g. PMC-W5-1088 or PMC-W5-1042)..."
                  value={trackingTicket}
                  onChange={(e) => setTrackingTicket(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {}}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Track Status
                </button>
              </div>

              {/* Sample Ticket Shortcuts */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Quick Demo Tickets:</span>
                {['PMC-W5-1042', 'PMC-W5-1088', 'PMC-W5-1095', 'PMC-W5-1102'].map((tok) => (
                  <button
                    key={tok}
                    onClick={() => setTrackingTicket(tok)}
                    className="font-mono text-blue-700 underline text-xs font-bold hover:text-blue-900"
                  >
                    #{tok}
                  </button>
                ))}
              </div>
            </Card>

            {/* Display Tracked Complaint Progress */}
            {trackedComplaint ? (
              <Card className="p-5 border-blue-300 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      #{trackedComplaint.ticket_no}
                    </span>
                    <h3 className="font-extrabold text-lg text-slate-900 mt-1">{trackedComplaint.title}</h3>
                    <p className="text-xs text-slate-600">Category: {trackedComplaint.category} · 📍 {trackedComplaint.location_name}</p>
                  </div>
                  <Badge value={trackedComplaint.status} />
                </div>

                {/* 3-Step Visual Progress Bar */}
                <div className="my-6">
                  <div className="flex items-center justify-between relative">
                    <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 -z-0" />
                    <div
                      className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-blue-600 transition-all -z-0"
                      style={{
                        width:
                          trackedComplaint.progress_step === 3
                            ? '100%'
                            : trackedComplaint.progress_step === 2
                            ? '50%'
                            : '0%',
                      }}
                    />

                    {/* Step 1 */}
                    <div className="flex flex-col items-center text-center z-10">
                      <div className="h-10 w-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shadow-md">
                        1
                      </div>
                      <span className="text-xs font-bold text-slate-900 mt-2">Submitted</span>
                      <span className="text-[10px] text-slate-500">{fmtDate(trackedComplaint.created_at)}</span>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col items-center text-center z-10">
                      <div className={`h-10 w-10 rounded-full font-bold flex items-center justify-center shadow-md ${
                        trackedComplaint.progress_step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        2
                      </div>
                      <span className="text-xs font-bold text-slate-900 mt-2">Crew Dispatched</span>
                      <span className="text-[10px] text-slate-500">
                        {trackedComplaint.assigned_worker_name || 'Assigned to field staff'}
                      </span>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col items-center text-center z-10">
                      <div className={`h-10 w-10 rounded-full font-bold flex items-center justify-center shadow-md ${
                        trackedComplaint.progress_step >= 3 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        3
                      </div>
                      <span className="text-xs font-bold text-slate-900 mt-2">Resolved</span>
                      <span className="text-[10px] text-slate-500">
                        {trackedComplaint.resolved_at ? fmtDate(trackedComplaint.resolved_at) : 'Awaiting sign-off'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Complaint Details & Evidence */}
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs space-y-2 border border-slate-200">
                  <p><b>Description:</b> {trackedComplaint.description}</p>
                  {trackedComplaint.resolution_notes && (
                    <p className="text-green-800"><b>Resolution Note:</b> {trackedComplaint.resolution_notes}</p>
                  )}
                  {trackedComplaint.after_photo && (
                    <div className="mt-2">
                      <p className="font-bold text-slate-800 mb-1">Attached Verified Proof:</p>
                      <img src={trackedComplaint.after_photo} alt="Resolution proof" className="h-32 rounded-lg object-cover border border-slate-300" />
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <span className="text-3xl">🔍</span>
                <p className="font-bold text-slate-800 mt-2 text-sm">Enter a ticket number above to view live progress.</p>
                <p className="text-xs text-slate-500">Example: Click on #PMC-W5-1042 or #PMC-W5-1088.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* MODAL: FILE A NEW COMPLAINT */}
      {/* ============================================================== */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Report a Civic Grievance</h3>
                <p className="text-xs text-slate-500">Your complaint will be routed directly to Ward {selectedWard} field staff.</p>
              </div>
              <button
                onClick={() => setShowFileModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 font-bold text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="space-y-3">
              <Field label="Grievance Title">
                <input
                  required
                  placeholder="e.g. Overflowing garbage bin outside community hall"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputCls}
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Ward Number">
                  <input
                    type="number"
                    readOnly
                    value={selectedWard}
                    className={`${inputCls} bg-slate-100 text-slate-600 font-bold`}
                  />
                </Field>
              </div>

              <Field label="Specific Location / Landmark">
                <input
                  required
                  placeholder="e.g. Near Ram Mandir Chowk, Laxmi Road"
                  value={form.location_name}
                  onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Description & Details">
                <textarea
                  rows={2}
                  placeholder="Provide context regarding the issue..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputCls} py-2`}
                />
              </Field>

              {/* Photo Upload (Before Evidence) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  📸 Attach Photo Evidence (Before Photo)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700"
                />
                {photoPreview && (
                  <div className="mt-2">
                    <img src={photoPreview} alt="Preview" className="h-28 w-28 rounded-lg object-cover border border-slate-300" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Your Name (Optional)">
                  <input
                    placeholder="Resident Name"
                    value={form.citizen_name}
                    onChange={(e) => setForm({ ...form, citizen_name: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Mobile Number (Optional)">
                  <input
                    placeholder="For SMS status updates"
                    value={form.citizen_phone}
                    onChange={(e) => setForm({ ...form, citizen_phone: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <ErrorNote>{formError}</ErrorNote>
              {submitSuccess && (
                <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-xs font-bold text-green-900">
                  {submitSuccess}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowFileModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={submitting}>
                  Submit Grievance
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
