import React, { Component, useEffect, useMemo, useState } from 'react'
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

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const DEFAULT_PUNE = [18.5204, 73.8567]

function isValidLatLng(lat, lng) {
  if (lat == null || lng == null) return false
  const nLat = Number(lat)
  const nLng = Number(lng)
  return !isNaN(nLat) && !isNaN(nLng) && nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180 && (nLat !== 0 || nLng !== 0)
}

// Error Boundary around Leaflet map to prevent blank screen crashes
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Leaflet Map Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
          <span className="text-3xl mb-2">🗺️⚠️</span>
          <p className="font-bold text-base mb-1">Map display error</p>
          <p className="text-xs text-red-600 mb-4">{this.state.error?.message || 'Could not render map tiles'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
          >
            Reload Map View
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function SafeFitBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !points || points.length === 0) return

    const validPoints = points
      .filter((p) => Array.isArray(p) && p.length === 2 && isValidLatLng(p[0], p[1]))
      .map((p) => [Number(p[0]), Number(p[1])])

    if (!validPoints.length) return

    try {
      map.invalidateSize()
      if (validPoints.length === 1) {
        map.setView(validPoints[0], 16)
      } else {
        const bounds = L.latLngBounds(validPoints)
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
        }
      }
    } catch (err) {
      console.warn('FitBounds caught error:', err)
    }
  }, [points, map])

  return null
}

export default function SupervisorMap() {
  const [searchParams] = useSearchParams()
  const initialTaskId = searchParams.get('taskId')

  const { data, loading, error } = useWardData(10000)
  const { t } = useLanguage()
  const [mainView, setMainView] = useState(initialTaskId ? 'geofence' : 'checkins')
  const [mode, setMode] = useState('today')
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId || '')

  const geoTasks = useMemo(() => {
    return (data?.tasks ?? []).filter((tk) => isValidLatLng(tk.target_lat, tk.target_lng))
  }, [data?.tasks])

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
    { poll: 4000 }
  )

  const markers = useMemo(() => {
    const checkIns = (data?.attendance ?? []).filter(
      (a) => a.check_type === 'CHECKIN' && isValidLatLng(a.latitude, a.longitude)
    )
    if (mode === 'today') return checkIns.filter((a) => isToday(a.timestamp))
    const seen = new Set()
    return checkIns.filter((a) => (seen.has(a.employee_id) ? false : seen.add(a.employee_id)))
  }, [data, mode])

  const selectedTask = geoTasks.find((tk) => String(tk.id) === String(selectedTaskId))
  
  const validBreadcrumbs = useMemo(() => {
    return (trackingData.data ?? [])
      .filter((b) => isValidLatLng(b.latitude, b.longitude))
      .map((b) => ({
        ...b,
        lat: Number(b.latitude),
        lng: Number(b.longitude),
      }))
  }, [trackingData.data])

  const latestBreadcrumb = validBreadcrumbs[validBreadcrumbs.length - 1]

  const points = useMemo(() => {
    if (mainView === 'checkins') {
      return markers.map((m) => [Number(m.latitude), Number(m.longitude)])
    }
    const pts = []
    if (selectedTask && isValidLatLng(selectedTask.target_lat, selectedTask.target_lng)) {
      pts.push([Number(selectedTask.target_lat), Number(selectedTask.target_lng)])
    }
    if (latestBreadcrumb && isValidLatLng(latestBreadcrumb.lat, latestBreadcrumb.lng)) {
      pts.push([latestBreadcrumb.lat, latestBreadcrumb.lng])
    }
    if (!pts.length && geoTasks.length) {
      return geoTasks.map((tk) => [Number(tk.target_lat), Number(tk.target_lng)])
    }
    return pts
  }, [mainView, markers, selectedTask, latestBreadcrumb, geoTasks])

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {mainView === 'checkins' ? 'Check-in Live Map' : 'Live Task Geofences & Routes'}
        </h1>

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
              <button
                key={v}
                onClick={() => setMode(v)}
                className={`min-h-7 rounded-full px-3 ${mode === v ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-900">Track Task:</span>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="rounded-lg border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-950 focus:outline-none"
            >
              <option value="">All Pinned Tasks ({geoTasks.length})</option>
              {geoTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.assignee?.name || 'Assigned'})
                </option>
              ))}
            </select>
          </div>
          {selectedTask && (
            <span className="text-blue-900 font-medium">
              Geofence: <b>{selectedTask.radius_m || 50}m</b> · Waypoints: <b>{validBreadcrumbs.length}</b>
            </span>
          )}
        </div>
      )}

      {/* Map View wrapped in Error Boundary */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <MapErrorBoundary>
          <MapContainer
            center={DEFAULT_PUNE}
            zoom={13}
            scrollWheelZoom={true}
            style={{ height: '58vh', minHeight: '360px', width: '100%' }}
            className="w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <SafeFitBounds points={points} />

            {/* 1. CHECK-INS VIEW */}
            {mainView === 'checkins' &&
              markers.map((m) => {
                const flagged = m.status === 'FLAGGED'
                const color = flagged ? '#dc2626' : '#16a34a'
                const lat = Number(m.latitude)
                const lng = Number(m.longitude)

                return (
                  <CircleMarker
                    key={m.id}
                    center={[lat, lng]}
                    radius={12}
                    pathOptions={{ color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 }}
                  >
                    <Popup>
                      <div className="space-y-1 text-sm">
                        <p className="text-base font-bold">{m.employees?.name || 'Worker'}</p>
                        <p>Ward Number: {m.employees?.ward_no ?? '—'}</p>
                        <p>{fmtDateTime(m.timestamp)}</p>
                        <p>
                          Coordinates:{' '}
                          <a
                            href={mapsLink(lat, lng)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            {fmtCoords(lat, lng)}
                          </a>
                        </p>
                        <Badge value={m.status} />
                        {m.photo_url && (
                          <img src={m.photo_url} alt="" className="mt-1 h-20 w-20 rounded-lg object-cover" />
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}

            {/* 2. GEOFENCES & LIVE BREADCRUMBS VIEW */}
            {mainView === 'geofence' && (
              <>
                {/* 50m circles for pinned tasks */}
                {geoTasks.map((t) => {
                  const isSelected = String(selectedTaskId) === String(t.id)
                  const radius = Number(t.radius_m) || 50
                  const isBreached =
                    isSelected && latestBreadcrumb && latestBreadcrumb.distance > radius
                  const circleColor = isBreached ? '#dc2626' : isSelected ? '#16a34a' : '#2563eb'
                  const lat = Number(t.target_lat)
                  const lng = Number(t.target_lng)

                  return (
                    <React.Fragment key={t.id}>
                      <Circle
                        center={[lat, lng]}
                        radius={radius}
                        pathOptions={{
                          color: circleColor,
                          fillColor: circleColor,
                          fillOpacity: isSelected ? 0.25 : 0.15,
                          weight: isSelected ? 3 : 1.5,
                        }}
                      />
                      <Marker position={[lat, lng]}>
                        <Popup>
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-sm">{t.title}</p>
                            <p>📍 {t.location_name || 'Designated Area'}</p>
                            <p>
                              Assigned to: <b>{t.assignee?.name || 'Worker'}</b>
                            </p>
                            <p>
                              Geofence: <b>{radius}m radius</b>
                            </p>
                            <Badge value={t.status} />
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  )
                })}

                {/* Breadcrumb Route Path */}
                {validBreadcrumbs.length > 1 && (
                  <Polyline
                    positions={validBreadcrumbs.map((b) => [b.lat, b.lng])}
                    pathOptions={{ color: '#7c3aed', weight: 4, dashArray: '6, 6' }}
                  />
                )}

                {/* Worker Live Position Marker */}
                {latestBreadcrumb && (
                  <CircleMarker
                    center={[latestBreadcrumb.lat, latestBreadcrumb.lng]}
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
                        <p>
                          Distance from zone center: <b>{latestBreadcrumb.distance}m</b>
                        </p>
                        <p>
                          Status:{' '}
                          <span
                            className={
                              latestBreadcrumb.inside_geofence
                                ? 'text-green-700 font-bold'
                                : 'text-red-700 font-bold'
                            }
                          >
                            {latestBreadcrumb.inside_geofence ? '✅ Inside 50m Zone' : '🚨 Outside Zone!'}
                          </span>
                        </p>
                        <p className="text-gray-500">{fmtTime(latestBreadcrumb.timestamp)}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                )}
              </>
            )}
          </MapContainer>
        </MapErrorBoundary>
      </div>

      {/* Legend / Status card */}
      <Card className="mt-3 flex items-center justify-between text-xs">
        {mainView === 'checkins' ? (
          <>
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
          </>
        ) : (
          <>
            <span>
              <b>{geoTasks.length}</b> geofenced task{geoTasks.length === 1 ? '' : 's'} ·
              {selectedTask ? ` Tracking "${selectedTask.title}"` : ' Select a task to see trail'}
            </span>
            <span className="flex items-center gap-3 text-gray-600">
              <span className="flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded-full bg-blue-500" /> 50m Zone
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded-full bg-purple-600" /> Route Trail
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded-full bg-red-600" /> Breach
              </span>
            </span>
          </>
        )}
      </Card>
    </div>
  )
}
