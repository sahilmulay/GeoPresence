import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { CircleMarker, Circle, Marker, Polyline, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useWardData } from '../../lib/wardData'
import { api } from '../../lib/api'
import { useData } from '../../lib/useData'
import { fmtCoords, fmtDateTime, fmtTime, isToday, mapsLink } from '../../lib/format'
import { Badge, Card, ErrorNote, PageLoader } from '../../components/ui'

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const PUNE = [18.5204, 73.8567]

function FitBounds({ points }) {
  const map = useMap()
  const key = points.map((p) => p.join()).join('|')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], 16)
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

export default function SupervisorMap() {
  const [searchParams] = useSearchParams()
  const initialTaskId = searchParams.get('taskId')

  const { data, loading, error } = useWardData(10000)
  const { t } = useLanguage()
  const [mainView, setMainView] = useState(initialTaskId ? 'geofence' : 'checkins') // checkins | geofence
  const [mode, setMode] = useState('today') // today | latest
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId || '')

  const geoTasks = useMemo(() => {
    return (data?.tasks ?? []).filter((t) => t.target_lat && t.target_lng)
  }, [data?.tasks])

  // If initialTaskId was passed in URL, select it
  useEffect(() => {
    if (initialTaskId) {
      setMainView('geofence')
      setSelectedTaskId(initialTaskId)
    }
  }, [initialTaskId])

  // Live breadcrumbs for selected task
  const trackingData = useData(
    () => (selectedTaskId ? api.listTracking?.({ taskId: selectedTaskId }) : Promise.resolve([])),
    [selectedTaskId],
    { poll: 5000 }
  )

  const markers = useMemo(() => {
    const checkIns = (data?.attendance ?? []).filter((a) => a.check_type === 'CHECKIN' && a.latitude != null)
    if (mode === 'today') return checkIns.filter((a) => isToday(a.timestamp))
    const seen = new Set()
    return checkIns.filter((a) => (seen.has(a.employee_id) ? false : seen.add(a.employee_id))) // list is newest-first
  }, [data, mode])

  if (loading) return <PageLoader />

  // Calculate points for auto-zoom
  const selectedTask = geoTasks.find((t) => t.id === selectedTaskId)
  const breadcrumbs = trackingData.data ?? []
  const latestBreadcrumb = breadcrumbs[breadcrumbs.length - 1]

  const points = useMemo(() => {
    if (mainView === 'checkins') {
      return markers.map((m) => [m.latitude, m.longitude])
    }
    const pts = []
    if (selectedTask) pts.push([selectedTask.target_lat, selectedTask.target_lng])
    if (latestBreadcrumb) pts.push([latestBreadcrumb.latitude, latestBreadcrumb.longitude])
    if (!pts.length && geoTasks.length) {
      return geoTasks.map((t) => [t.target_lat, t.target_lng])
    }
    return pts
  }, [mainView, markers, selectedTask, latestBreadcrumb, geoTasks])

  return (
    <div>
      <div className="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {mainView === 'checkins' ? 'Check-in Live Map' : 'Live Task Geofences & Routes'}
        </h1>
        
        {/* Toggle between Checkins and Live Geofencing */}
        <div className="flex rounded-xl border border-gray-300 bg-white p-1 text-xs font-semibold shadow-sm">
          <button
            onClick={() => setMainView('checkins')}
            className={`min-h-8 rounded-lg px-3 ${mainView === 'checkins' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            📸 Check-ins
          </button>
          <button
            onClick={() => setMainView('geofence')}
            className={`min-h-8 rounded-lg px-3 ${mainView === 'geofence' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            🛰️ Live Geofences & Trails
          </button>
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {/* Sub-controls */}
      {mainView === 'checkins' ? (
        <div className="mb-3 flex justify-end">
          <div className="flex rounded-full border border-gray-300 bg-white p-1 text-xs font-semibold">
            {[
              ['today', 'Today'],
              ['latest', 'Latest'],
            ].map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`min-h-7 rounded-full px-3 ${mode === v ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-900">Track Task:</span>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="rounded-lg border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-950 focus:outline-none"
            >
              <option value="">All Pinned Tasks</option>
              {geoTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.assignee?.name || 'Assigned'})
                </option>
              ))}
            </select>
          </div>
          {selectedTask && (
            <span className="text-blue-800">
              Radius: <b>{selectedTask.radius_m || 50}m</b> · Waypoints: <b>{breadcrumbs.length}</b>
            </span>
          )}
        </div>
      )}

      {/* Map View */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <MapContainer center={PUNE} zoom={13} scrollWheelZoom className="h-[58dvh] min-h-80 w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={points} />

          {/* 1. CHECK-INS VIEW */}
          {mainView === 'checkins' && markers.map((m) => {
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

          {/* 2. GEOFENCES & LIVE BREADCRUMBS VIEW */}
          {mainView === 'geofence' && (
            <>
              {/* Draw 50m circles for pinned tasks */}
              {geoTasks.map((t) => {
                const isSelected = selectedTaskId === t.id
                const radius = Number(t.radius_m) || 50
                const isBreached = isSelected && latestBreadcrumb && latestBreadcrumb.distance > radius
                const circleColor = isBreached ? '#dc2626' : (isSelected ? '#16a34a' : '#2563eb')

                return (
                  <span key={t.id}>
                    <Circle
                      center={[t.target_lat, t.target_lng]}
                      radius={radius}
                      pathOptions={{
                        color: circleColor,
                        fillColor: circleColor,
                        fillOpacity: isSelected ? 0.25 : 0.15,
                        weight: isSelected ? 3 : 1.5,
                      }}
                    />
                    <Marker position={[t.target_lat, t.target_lng]}>
                      <Popup>
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-sm">{t.title}</p>
                          <p>📍 {t.location_name || 'Designated Area'}</p>
                          <p>Assigned to: <b>{t.assignee?.name}</b></p>
                          <p>Geofence: <b>{radius}m radius</b></p>
                          <Badge value={t.status} />
                        </div>
                      </Popup>
                    </Marker>
                  </span>
                )
              })}

              {/* Draw Breadcrumb Route Path */}
              {breadcrumbs.length > 1 && (
                <Polyline
                  positions={breadcrumbs.map((b) => [b.latitude, b.longitude])}
                  pathOptions={{ color: '#7c3aed', weight: 4, dashArray: '6, 6' }}
                />
              )}

              {/* Draw Live Worker Marker */}
              {latestBreadcrumb && (
                <CircleMarker
                  center={[latestBreadcrumb.latitude, latestBreadcrumb.longitude]}
                  radius={10}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: latestBreadcrumb.inside_geofence ? '#16a34a' : '#dc2626',
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-sm">📍 Worker Live Position</p>
                      <p>Distance from center: <b>{latestBreadcrumb.distance}m</b></p>
                      <p>Status: <span className={latestBreadcrumb.inside_geofence ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                        {latestBreadcrumb.inside_geofence ? '✅ Inside 50m Zone' : '🚨 Outside Zone!'}
                      </span></p>
                      <p className="text-gray-500">{fmtTime(latestBreadcrumb.timestamp)}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              )}
            </>
          )}
        </MapContainer>
      </div>

      {/* Legend / Status card */}
      <Card className="mt-3 flex items-center justify-between text-xs">
        {mainView === 'checkins' ? (
          <>
            <span><b>{markers.length}</b> check-in location{markers.length === 1 ? '' : 's'} shown</span>
            <span className="flex items-center gap-3 text-gray-600">
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full bg-green-600" /> Present</span>
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full bg-red-600" /> Flagged</span>
            </span>
          </>
        ) : (
          <>
            <span>
              <b>{geoTasks.length}</b> geofenced task{geoTasks.length === 1 ? '' : 's'} · 
              {selectedTask ? ` Tracking "${selectedTask.title}"` : ' Select a task to see trail'}
            </span>
            <span className="flex items-center gap-3 text-gray-600">
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full bg-blue-500" /> 50m Zone</span>
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full bg-purple-600" /> Route Trail</span>
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full bg-red-600" /> Breach</span>
            </span>
          </>
        )}
      </Card>
    </div>
  )
}
