import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { useData } from '../../lib/useData'
import { todaySummary, useWardData } from '../../lib/wardData'
import { fmtTime } from '../../lib/format'
import { Avatar, Badge, Card, Empty, ErrorNote, PageLoader, SectionTitle, LocationLabel } from '../../components/ui'

const ACTIVE_ALERTS_KEY = 'gp_supervisor_active_alerts'

function Stat({ label, value, tone = 'text-gray-900' }) {
  return (
    <Card className="p-3">
      <p className={`text-3xl font-bold ${tone}`}>{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </Card>
  )
}

export default function SupervisorDashboard() {
  const { profile } = useAuth()
  const { data, loading, error } = useWardData()
  const { t } = useLanguage()

  // Load initial alerts from localStorage so they survive page refreshes
  const [liveAlerts, setLiveAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_ALERTS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const updateAlerts = useCallback((incoming) => {
    if (!incoming) return
    setLiveAlerts((prev) => {
      const list = Array.isArray(incoming) ? incoming : [incoming]
      const map = new Map()
      // Preserve existing unresolved alerts
      prev.filter((a) => !a.resolved).forEach((a) => map.set(a.id, a))
      // Merge incoming alerts
      list.filter((a) => !a.resolved).forEach((a) => map.set(a.id, a))

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp)
      )
      try {
        localStorage.setItem(ACTIVE_ALERTS_KEY, JSON.stringify(merged))
      } catch {}
      return merged
    })
  }, [])

  // Poll database for alerts
  const alerts = useData(
    () => api.listAlerts?.({ wardNo: profile.ward_no }),
    [profile.ward_no],
    { poll: 4000 }
  )

  useEffect(() => {
    if (alerts.data && alerts.data.length > 0) {
      updateAlerts(alerts.data)
    }
  }, [alerts.data, updateAlerts])

  // Real-time broadcast listener
  useEffect(() => {
    const unsub = api.subscribeAlerts?.((newAlert) => {
      if (newAlert) {
        updateAlerts(newAlert)
      }
    })
    return () => unsub?.()
  }, [updateAlerts])

  const handleDismiss = async (alertId) => {
    setLiveAlerts((prev) => {
      const remaining = prev.filter((a) => a.id !== alertId)
      try {
        localStorage.setItem(ACTIVE_ALERTS_KEY, JSON.stringify(remaining))
      } catch {}
      return remaining
    })
    try {
      await api.dismissAlert?.(alertId)
      alerts.reload(true)
    } catch (e) {
      console.warn('Failed to dismiss alert:', e)
    }
  }

  if (loading) return <PageLoader />
  const { employees = [], attendance = [], tasks = [] } = data ?? {}

  const rows = employees.map((e) => ({
    e,
    s: todaySummary(e.id, attendance),
    taskCount: tasks.filter((t) => t.assigned_to === e.id).length,
    openCount: tasks.filter((t) => t.assigned_to === e.id && t.status !== 'COMPLETED').length,
  }))
  const present = rows.filter((r) => r.s.state !== 'ABSENT').length
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length

  const recentWorkPhotos = tasks
    .flatMap((tk) => (tk.photos || []).map((p) => ({ ...p, taskTitle: tk.title, taskId: tk.id })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 6)

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Welcome {(profile.name || 'Supervisor').split(' ')[0]}</h1>
        <p className="text-gray-600">You are responsible for Ward {profile.ward_no}</p>
      </div>

      {/* CONTINUOUS FLASHING GEOFENCE BREACH WARNING ON SUPERVISOR HOME */}
      {liveAlerts.length > 0 && (
        <div className="mb-5 space-y-3">
          {liveAlerts.map((alert) => (
            <div
              key={alert.id}
              className="relative overflow-hidden rounded-2xl border-4 border-red-600 bg-red-100 p-4 shadow-xl ring-4 ring-red-300 animate-pulse transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-md animate-bounce">
                    <span className="text-2xl">🚨</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                        GEOFENCE BREACH ALERT
                      </span>
                      <span className="text-xs font-bold text-red-700">
                        {fmtTime(alert.timestamp || alert.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-base font-extrabold text-red-950">
                      {alert.employee_name || 'Worker'} has moved OUTSIDE designated 50m zone!
                    </p>
                    <p className="text-xs font-semibold text-red-900">
                      Task: <b>{alert.task_title || 'Assigned Task'}</b> · Distance from zone: <b className="text-red-950 underline">{alert.distance} meters</b> (Exceeded 50m boundary)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto pt-1 md:pt-0">
                  <Link
                    to={`/supervisor/map?taskId=${alert.task_id}`}
                    className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 active:scale-95 transition-transform"
                  >
                    <span>📍</span>
                    <span>View on Live Map</span>
                  </Link>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="rounded-xl border border-red-400 bg-white px-3.5 py-2 text-xs font-bold text-red-800 hover:bg-red-50 shadow-sm"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('sup_dash.total_emp')} value={employees.length} />
        <Stat label={t('sup_dash.present')} value={present} tone="text-green-600" />
        <Stat label={t('sup_dash.absent')} value={employees.length - present} tone="text-red-600" />
        <Stat label={t('sup_dash.tasks_assigned')} value={tasks.length} tone="text-blue-600" />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {completed} of {tasks.length} {t('sup_dash.tasks_completed')}
      </p>

      <SectionTitle right={<Link to="/supervisor/attendance" className="text-sm font-semibold text-blue-600">{t('sup_dash.view_att')}</Link>}>
        {t('sup_dash.employees')}
      </SectionTitle>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map(({ e, s, taskCount, openCount }) => (
            <Card key={e.id} className="flex items-center gap-3">
              <Avatar name={e.name} src={s.checkIn?.photo_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {e.name}
                  {s.checkIn && (
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      [<LocationLabel lat={s.checkIn.latitude} lng={s.checkIn.longitude} />]
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  {taskCount} {t('sup_dash.task_assigned')} · {openCount} {t('sup_dash.open')}
                </p>
                {s.checkIn && <p className="text-xs text-gray-500">{t('sup_dash.in')} {fmtTime(s.checkIn.timestamp)}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge value={s.state} label={s.state === 'PRESENT' ? t('sup_dash.present_badge') : s.state === 'OUT' ? t('sup_dash.out_badge') : t('sup_dash.absent_badge')} />
                {s.flagged && <Badge value="FLAGGED" />}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>{t('sup_dash.no_emp')} {profile.ward_no} yet.</Empty>
      )}

      {/* RECENT WORK PHOTOS FROM FIELD */}
      {recentWorkPhotos.length > 0 && (
        <div className="mt-6">
          <SectionTitle right={<Link to="/supervisor/tasks" className="text-sm font-semibold text-blue-600">View In Tasks</Link>}>
            Field Work Proof Photos ({recentWorkPhotos.length})
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentWorkPhotos.map((photo) => (
              <Card key={photo.id} className="p-2 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-gray-900 mb-2">
                  <img src={photo.url} alt={photo.caption || 'Work proof'} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                    {fmtTime(photo.timestamp)}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-900 truncate">{photo.taskTitle}</p>
                <p className="text-[11px] text-gray-500 truncate">By {photo.employee_name || 'Worker'}</p>
                {photo.caption && <p className="text-[11px] text-gray-700 italic truncate mt-0.5">"{photo.caption}"</p>}
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/supervisor/tasks" className="flex min-h-12 items-center justify-center rounded-xl bg-blue-600 font-semibold text-white">
          {t('sup_dash.assign_btn')}
        </Link>
        <Link to="/supervisor/map" className="flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white font-semibold">
          {t('sup_dash.map_btn')}
        </Link>
      </div>
    </div>
  )
}
