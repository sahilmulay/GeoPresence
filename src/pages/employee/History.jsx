import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { useData } from '../../lib/useData'
import { fmtCoords, fmtDate, fmtTime, mapsLink } from '../../lib/format'
import { Avatar, Badge, Card, Empty, ErrorNote, PageLoader } from '../../components/ui'

export default function EmployeeHistory() {
  const { profile } = useAuth()
  const { data, loading, error } = useData(() => api.listAttendance({ employeeId: profile.id }), [profile.id])

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Attendance History</h1>
      <ErrorNote>{error}</ErrorNote>
      {loading ? (
        <PageLoader />
      ) : data?.length ? (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a.id} className="flex items-center gap-3">
              <Avatar name={profile.name} src={a.photo_url} size="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{fmtDate(a.timestamp)}</p>
                  <Badge value={a.check_type} label={a.check_type === 'CHECKIN' ? 'Check In' : 'Check Out'} />
                </div>
                <p className="text-sm text-gray-700">{fmtTime(a.timestamp)}</p>
                <a
                  href={mapsLink(a.latitude, a.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-blue-600 underline"
                >
                  {fmtCoords(a.latitude, a.longitude)}
                </a>
                {a.status === 'FLAGGED' && <Badge value="FLAGGED" label="Flagged: low GPS accuracy" />}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>No attendance records yet. Mark your first check in from Home.</Empty>
      )}
    </div>
  )
}
