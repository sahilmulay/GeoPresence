import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { useData } from '../../lib/useData'
import { getPosition } from '../../lib/device'
import { getDistance, GEOFENCE_RADIUS_M } from '../../lib/geo'
import { isToday, fmtTime } from '../../lib/format'
import AttendanceCapture from '../../components/AttendanceCapture'
import VoiceAssistant from '../../components/VoiceAssistant'
import { Badge, Button, Card, Empty, ErrorNote, LocationLabel, PageLoader, SectionTitle } from '../../components/ui'

export default function EmployeeDashboard() {
  const { t } = useLanguage()
  const { profile } = useAuth()
  const [capture, setCapture] = useState(null) // 'CHECKIN' | 'CHECKOUT' | null
  const [busyTask, setBusyTask] = useState(null)
  const [taskError, setTaskError] = useState('')

  const att = useData(() => api.listAttendance({ employeeId: profile.id }), [profile.id])
  const tasks = useData(() => api.listTasks({ employeeId: profile.id }), [profile.id], { poll: 10000 })

  const todays = (att.data ?? []).filter((a) => isToday(a.timestamp))
  const latest = todays[0] // list is sorted newest first
  const canCheckIn = !latest || latest.check_type === 'CHECKOUT'
  const canCheckOut = latest?.check_type === 'CHECKIN'
  
  const pendingTasks = (tasks.data ?? []).filter(tk => tk.status !== 'COMPLETED').length
  let voiceStatus = 'ALL_DONE'
  if (canCheckIn) voiceStatus = 'NEED_CHECKIN'
  else if (pendingTasks > 0) voiceStatus = 'NEED_WORK'

  const statusText = !latest
    ? t('emp_dash.not_checked_in')
    : latest.check_type === 'CHECKIN'
      ? `${t('emp_dash.checked_in_at')} ${fmtTime(latest.timestamp)}`
      : `${t('emp_dash.checked_out_at')} ${fmtTime(latest.timestamp)}`

  // Live Geofence Tracking for Active Task
  const activeTask = tasks.data?.find((tk) => tk.status === 'IN_PROGRESS' && tk.target_lat && tk.target_lng)
  const [liveDistance, setLiveDistance] = useState(null)
  const [isOutsideZone, setIsOutsideZone] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const outCountRef = useRef(0)
  const lastAlertTimeRef = useRef(0)
  const lastLoggedTimeRef = useRef(0)

  useEffect(() => {
    if (!activeTask) {
      setLiveDistance(null)
      setIsOutsideZone(false)
      return
    }

    let wakeLock = null
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then((wl) => {
        wakeLock = wl
        setWakeLockActive(true)
      }).catch(() => {})
    }

    const radius = Number(activeTask.radius_m) || GEOFENCE_RADIUS_M

    const handlePosition = (pos) => {
      const { latitude, longitude } = pos.coords
      const dist = getDistance(latitude, longitude, activeTask.target_lat, activeTask.target_lng)
      const roundedDist = Math.round(dist)
      setLiveDistance(roundedDist)

      const isOut = dist > (radius + 5) // 5m buffer for GPS jitter
      setIsOutsideZone(isOut)

      const now = Date.now()
      // Log breadcrumb every 10 seconds
      if (now - lastLoggedTimeRef.current > 10000) {
        lastLoggedTimeRef.current = now
        api.logTracking?.({
          taskId: activeTask.id,
          employeeId: profile.id,
          latitude,
          longitude,
          distance: roundedDist,
          insideGeofence: !isOut,
        })
      }

      // Breach detection: alert immediately on breach
      if (isOut) {
        if (now - lastAlertTimeRef.current > 15000) {
          lastAlertTimeRef.current = now
          api.triggerBreachAlert?.({
            taskId: activeTask.id,
            employeeId: profile.id,
            employeeName: profile.name,
            taskTitle: activeTask.title,
            distance: roundedDist,
            latitude,
            longitude,
          })
        }
      }
    }

    const watchId = navigator.geolocation?.watchPosition(
      handlePosition,
      (err) => console.warn('Live tracking GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    )

    // Periodic check interval (ensures continuous updates even if stationary)
    const intervalId = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          (err) => console.warn('Interval GPS error:', err),
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        )
      }
    }, 10000)

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId)
      clearInterval(intervalId)
      if (wakeLock) wakeLock.release().catch(() => {})
      setWakeLockActive(false)
    }
  }, [activeTask?.id, activeTask?.target_lat, activeTask?.target_lng, activeTask?.radius_m, profile.id, profile.name])

  const setStatus = async (id, status) => {
    setBusyTask(id)
    setTaskError('')
    try {
      if (status === 'IN_PROGRESS') {
        const task = tasks.data?.find((tk) => tk.id === id)
        if (task?.target_lat && task?.target_lng) {
          const radius = Number(task.radius_m) || GEOFENCE_RADIUS_M
          try {
            const pos = await getPosition()
            const dist = getDistance(pos.latitude, pos.longitude, task.target_lat, task.target_lng)
            if (dist > radius) {
              const proceed = window.confirm(
                `Geofence Notice: You are ${Math.round(dist)}m away from the assigned location (Designated Radius is ${radius}m).\n\nDo you want to proceed and start work anyway?\n(Starting work while outside will trigger a geofence breach alert on the Supervisor Dashboard).`
              )
              if (!proceed) {
                setBusyTask(null)
                return
              }
            }
          } catch (gpsErr) {
            console.warn('GPS location check skipped:', gpsErr.message)
          }
        }
      }
      await api.updateTaskStatus(id, status)
      await tasks.reload(true)
    } catch (e) {
      setTaskError(e.message)
    } finally {
      setBusyTask(null)
    }
  }

  const openTasks = (tasks.data ?? []).filter((tk) => tk.status !== 'COMPLETED').length

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t('emp_dash.welcome')} {(profile.name || 'Employee').split(' ')[0]}</h1>
        <VoiceAssistant status={voiceStatus} />
        <p className="text-gray-600">Ward Number: {profile.ward_no}</p>
      </div>

      <Card className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('emp_dash.supervisor')}</p>
          <p className="font-semibold">{profile.supervisor?.name ?? t('emp_dash.not_assigned')}</p>
          {!profile.supervisor && <p className="text-xs text-gray-500">A supervisor for Ward {profile.ward_no} has not registered yet.</p>}
        </div>
      </Card>

      <SectionTitle>{t('emp_dash.mark_att')}</SectionTitle>
      <Card>
        <p className="mb-3 font-medium text-gray-700">{att.loading ? 'Loading…' : statusText}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="success" className="min-h-16 text-lg" disabled={att.loading || !canCheckIn} onClick={() => setCapture('CHECKIN')}>
            CHECK IN
          </Button>
          <Button variant="danger" className="min-h-16 text-lg" disabled={att.loading || !canCheckOut} onClick={() => setCapture('CHECKOUT')}>
            CHECK OUT
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-500">{t('emp_dash.att_note')}</p>
      </Card>

      <SectionTitle right={<span className="text-sm text-gray-500">{openTasks} {t('emp_dash.open_tasks')}</span>}>{t('emp_dash.assigned_tasks')}</SectionTitle>
      <ErrorNote>{taskError || tasks.error}</ErrorNote>

      {activeTask && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="font-semibold">Work In Progress: {activeTask.title}</span>
          </div>
          {wakeLockActive && <span className="text-[11px] text-blue-700">📱 GPS Active</span>}
        </div>
      )}

      {tasks.loading ? (
        <PageLoader />
      ) : tasks.data?.length ? (
        <div className="space-y-3">
          {tasks.data.map((task) => (
            <Card key={task.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{task.title}</h3>
                <Badge value={task.status} />
              </div>
              {task.description && <p className="mt-1 text-sm text-gray-600">{task.description}</p>}
              <p className="mt-1 text-xs font-semibold text-blue-700 flex items-center gap-1">
                <span>📍</span>
                <span>
                  {task.location_name
                    ? task.location_name
                    : task.target_lat && task.target_lng
                      ? <LocationLabel lat={task.target_lat} lng={task.target_lng} fallback={`Ward ${task.ward_no || profile.ward_no || 5}`} />
                      : `Ram Mandir Chowk, Ward ${task.ward_no || profile.ward_no || 5}`}
                </span>
              </p>
              {task.status === 'PENDING' && latest?.check_type !== 'CHECKIN' && (
                <p className="mt-1 text-xs font-semibold text-red-600">{t('emp_dash.checkin_first')}</p>
              )}
              {task.status !== 'COMPLETED' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Button variant="outline" disabled={task.status !== 'PENDING' || busyTask === task.id || latest?.check_type !== 'CHECKIN'} onClick={() => setStatus(task.id, 'IN_PROGRESS')}>
                    {t('emp_dash.start_work')}
                  </Button>
                  <Button variant="success" loading={busyTask === task.id} onClick={() => setStatus(task.id, 'COMPLETED')}>
                    {t('emp_dash.mark_completed')}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty>{t('emp_dash.no_tasks')}</Empty>
      )}

      {capture && (
        <AttendanceCapture tasks={tasks.data ?? []}
          type={capture}
          employeeId={profile.id}
          onClose={() => setCapture(null)}
          onDone={() => att.reload(true)}
        />
      )}
    </div>
  )
}
