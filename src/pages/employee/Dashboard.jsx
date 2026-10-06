import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { useData } from '../../lib/useData'
import { getPosition } from '../../lib/device'
import { getDistance, GEOFENCE_RADIUS_M } from '../../lib/geo'
import { isToday, fmtTime } from '../../lib/format'
import AttendanceCapture from '../../components/AttendanceCapture'
import { Badge, Button, Card, Empty, ErrorNote, PageLoader, SectionTitle } from '../../components/ui'

export default function EmployeeDashboard() {
  const { t } = useLanguage()
  const { profile } = useAuth()
  const [capture, setCapture] = useState(null) // 'CHECKIN' | 'CHECKOUT' | null
  const [busyTask, setBusyTask] = useState(null)
  const [taskError, setTaskError] = useState('')

  const att = useData(() => api.listAttendance({ employeeId: profile.id }), [profile.id])
  const tasks = useData(() => api.listTasks({ employeeId: profile.id }), [profile.id], { poll: 15000 })

  const todays = (att.data ?? []).filter((a) => isToday(a.timestamp))
  const latest = todays[0] // list is sorted newest first
  const canCheckIn = !latest || latest.check_type === 'CHECKOUT'
  const canCheckOut = latest?.check_type === 'CHECKIN'

  const statusText = !latest
    ? t('emp_dash.not_checked_in')
    : latest.check_type === 'CHECKIN'
      ? `{t('emp_dash.checked_in_at')} ${fmtTime(latest.timestamp)}`
      : `{t('emp_dash.checked_out_at')} ${fmtTime(latest.timestamp)}`

  const setStatus = async (id, status) => {
    setBusyTask(id)
    setTaskError('')
    try {
      if (status === 'IN_PROGRESS') {
        const task = tasks.data?.find((t) => t.id === id)
        if (task?.target_lat && task?.target_lng) {
          const pos = await getPosition()
          const dist = getDistance(pos.latitude, pos.longitude, task.target_lat, task.target_lng)
          if (dist > GEOFENCE_RADIUS_M) {
            throw new Error(`Geofence Error: You are ${Math.round(dist)}m away. You must be within ${GEOFENCE_RADIUS_M}m of the task location to start work.`)
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

  const openTasks = (tasks.data ?? []).filter((t) => t.status !== 'COMPLETED').length

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t('emp_dash.welcome')} {profile.name.split(' ')[0]}</h1>
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
      {tasks.loading ? (
        <PageLoader />
      ) : tasks.data?.length ? (
        <div className="space-y-3">
          {tasks.data.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{t.title}</h3>
                <Badge value={t.status} />
              </div>
              {t.description && <p className="mt-1 text-sm text-gray-600">{t.description}</p>}
              {t.location_name && (
                <p className="mt-1 text-xs font-semibold text-blue-700">📍 {t.location_name}</p>
              )}
              {t.status === 'PENDING' && latest?.check_type !== 'CHECKIN' && (
                <p className="mt-1 text-xs font-semibold text-red-600">{t('emp_dash.checkin_first')}</p>
              )}
              {t.status !== 'COMPLETED' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Button variant="outline" disabled={t.status !== 'PENDING' || busyTask === t.id || latest?.check_type !== 'CHECKIN'} onClick={() => setStatus(t.id, 'IN_PROGRESS')}>
                    Start Work
                  </Button>
                  <Button variant="success" loading={busyTask === t.id} onClick={() => setStatus(t.id, 'COMPLETED')}>
                    Mark Completed
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
