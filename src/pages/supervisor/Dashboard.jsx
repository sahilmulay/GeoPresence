import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { todaySummary, useWardData } from '../../lib/wardData'
import { fmtTime } from '../../lib/format'
import { Avatar, Badge, Card, Empty, ErrorNote, PageLoader, SectionTitle } from '../../components/ui'

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

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Welcome {profile.name.split(' ')[0]}</h1>
        <p className="text-gray-600">You are responsible for Ward {profile.ward_no}</p>
      </div>
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="{t('sup_dash.total_emp')}" value={employees.length} />
        <Stat label="{t('sup_dash.present')}" value={present} tone="text-green-600" />
        <Stat label="{t('sup_dash.absent')}" value={employees.length - present} tone="text-red-600" />
        <Stat label="{t('sup_dash.tasks_assigned')}" value={tasks.length} tone="text-blue-600" />
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

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/supervisor/tasks" className="flex min-h-12 items-center justify-center rounded-xl bg-blue-600 font-semibold text-white">
          {t('sup_dash.assign_btn')}
        </Link>
        <Link to="/supervisor/map" className="flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white font-semibold">
          View Map
        </Link>
      </div>
    </div>
  )
}
