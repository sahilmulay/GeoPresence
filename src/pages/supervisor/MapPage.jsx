import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useWardData } from '../../lib/wardData'
import { fmtCoords, fmtDateTime, isToday, mapsLink } from '../../lib/format'
import { Badge, Card, ErrorNote, PageLoader } from '../../components/ui'

const PUNE = [18.5204, 73.8567]

function FitBounds({ points }) {
  const map = useMap()
  const key = points.map((p) => p.join()).join('|')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

export default function SupervisorMap() {
  const { data, loading, error } = useWardData()
  const [mode, setMode] = useState('today') // today | latest

  const markers = useMemo(() => {
    const checkIns = (data?.attendance ?? []).filter((a) => a.check_type === 'CHECKIN' && a.latitude != null)
    if (mode === 'today') return checkIns.filter((a) => isToday(a.timestamp))
    const seen = new Set()
    return checkIns.filter((a) => (seen.has(a.employee_id) ? false : seen.add(a.employee_id))) // list is newest-first
  }, [data, mode])

  if (loading) return <PageLoader />
  const points = markers.map((m) => [m.latitude, m.longitude])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Check-in Map</h1>
        <div className="flex rounded-full border border-gray-300 bg-white p-1 text-sm font-semibold">
          {[
            ['today', 'Today'],
            ['latest', 'Latest'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} className={`min-h-9 rounded-full px-4 ${mode === v ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote>{error}</ErrorNote>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <MapContainer center={PUNE} zoom={12} scrollWheelZoom className="h-[58dvh] min-h-80 w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={points} />
          {markers.map((m) => {
            const flagged = m.status === 'FLAGGED'
            const color = flagged ? '#dc2626' : '#16a34a'
            return (
              <CircleMarker key={m.id} center={[m.latitude, m.longitude]} radius={12} pathOptions={{ color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 }}>
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="text-base font-bold">{m.employees?.name}</p>
                    <p>Ward Number: {m.employees?.ward_no}</p>
                    <p>{fmtDateTime(m.timestamp)}</p>
                    <p>
                      Coordinates:{' '}
                      <a href={mapsLink(m.latitude, m.longitude)} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        {fmtCoords(m.latitude, m.longitude)}
                      </a>
                    </p>
                    <Badge value={m.status} />
                    {m.photo_url && <img src={m.photo_url} alt="" className="mt-1 h-20 w-20 rounded-lg object-cover" />}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <Card className="mt-3 flex items-center justify-between text-sm">
        <span>
          <b>{markers.length}</b> check-in location{markers.length === 1 ? '' : 's'} shown
        </span>
        <span className="flex items-center gap-3 text-gray-600">
          <span className="flex items-center gap-1">
            <i className="inline-block h-3 w-3 rounded-full bg-green-600" /> Present
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-3 w-3 rounded-full bg-red-600" /> Flagged
          </span>
        </span>
      </Card>
      {!markers.length && <p className="mt-2 text-center text-sm text-gray-500">No check-ins to show for this view yet.</p>}
    </div>
  )
}
