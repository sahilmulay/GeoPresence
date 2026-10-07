import React, { Component, useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { CircleMarker, Circle, Marker, Polyline, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useWardData } from '../../lib/wardData'
import { api } from '../../lib/api'
import { useData } from '../../lib/useData'
import { fmtCoords, fmtDateTime, fmtTime, mapsLink } from '../../lib/format'
import { Badge, Card, ErrorNote, PageLoader } from '../../components/ui'
import TaskPhotoViewer from '../../components/TaskPhotoViewer'

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

// Error Boundary around Leaflet map
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

// Auto fit map bounds to current employee's latest task and trail
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
          map.fitBounds(bounds, { padding: [45, 45], maxZoom: 17 })
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
  const paramTaskId = searchParams.get('taskId')
  const paramEmpId = searchParams.get('employeeId')

  const { data, loading, error } = useWardData(10000)
  const { t } = useLanguage()

  const employees = data?.employees ?? []
  const allTasks = data?.tasks ?? []
  const allAttendance = data?.attendance ?? []

  // Initialize selected employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  useEffect(() => {
    if (selectedEmployeeId) return
    if (paramEmpId) {
      setSelectedEmployeeId(paramEmpId)
    } else if (paramTaskId) {
      const taskObj = allTasks.find((tk) => String(tk.id) === String(paramTaskId))
      if (taskObj?.assigned_to) {
        setSelectedEmployeeId(taskObj.assigned_to)
      }
    } else if (employees.length > 0) {
      // Pick first employee who has an IN_PROGRESS or latest task, or employees[0]
      const withActiveTask = employees.find((emp) =>
        allTasks.some((tk) => tk.assigned_to === emp.id && tk.status === 'IN_PROGRESS')
      )
      const withAnyTask = employees.find((emp) =>
        allTasks.some((tk) => tk.assigned_to === emp.id)
      )
      setSelectedEmployeeId(withActiveTask?.id || withAnyTask?.id || employees[0]?.id || '')
    }
  }, [paramEmpId, paramTaskId, allTasks, employees, selectedEmployeeId])

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  // Get ONLY the LATEST task of the selected employee
  const latestTask = useMemo(() => {
    if (!selectedEmployeeId) return null
    const empTasks = allTasks.filter((tk) => tk.assigned_to === selectedEmployeeId)
    if (!empTasks.length) return null

    // Prioritize task currently in progress
    const inProgress = empTasks.find((tk) => tk.status === 'IN_PROGRESS')
    if (inProgress) return inProgress

    // Otherwise, pick the most recent task by created_at
    return [...empTasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
  }, [allTasks, selectedEmployeeId])

  // Query live GPS tracking breadcrumbs for THIS latest task
  const trackingData = useData(
    () =>
      latestTask?.id
        ? api.listTracking?.({ taskId: latestTask.id, employeeId: selectedEmployeeId })
        : Promise.resolve([]),
    [latestTask?.id, selectedEmployeeId],
    { poll: 4000 }
  )

  const validBreadcrumbs = useMemo(() => {
    return (trackingData.data ?? [])
      .filter((b) => isValidLatLng(b.latitude, b.longitude))
      .map((b) => ({
        ...b,
        lat: Number(b.latitude),
        lng: Number(b.longitude),
      }))
  }, [trackingData.data])

  const routeCoords = useMemo(() => {
    return validBreadcrumbs.map((b) => [b.lat, b.lng])
  }, [validBreadcrumbs])

  const startPoint = validBreadcrumbs[0]
  const currentPosition = validBreadcrumbs[validBreadcrumbs.length - 1]

  const taskHasLocation = latestTask && isValidLatLng(latestTask.target_lat, latestTask.target_lng)
  const taskLat = taskHasLocation ? Number(latestTask.target_lat) : null
  const taskLng = taskHasLocation ? Number(latestTask.target_lng) : null
  const taskRadius = Number(latestTask?.radius_m) || 50

  const isCurrentlyBreached =
    currentPosition && currentPosition.distance > taskRadius

  // Check-in record for this employee today (if any)
  const employeeCheckIn = useMemo(() => {
    if (!selectedEmployeeId) return null
    return allAttendance.find(
      (a) => a.employee_id === selectedEmployeeId && a.check_type === 'CHECKIN' && isValidLatLng(a.latitude, a.longitude)
    )
  }, [allAttendance, selectedEmployeeId])

  // Points for camera auto-fit
  const points = useMemo(() => {
    const pts = []
    if (taskHasLocation) pts.push([taskLat, taskLng])
    if (routeCoords.length > 0) {
      routeCoords.forEach((pt) => pts.push(pt))
    }
    if (employeeCheckIn && !pts.length) {
      pts.push([Number(employeeCheckIn.latitude), Number(employeeCheckIn.longitude)])
    }
    return pts
  }, [taskHasLocation, taskLat, taskLng, routeCoords, employeeCheckIn])

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('sup_map.title')}</h1>
          <p className="text-xs text-gray-500">
            Select an employee below to view their latest task, 50m geofence, and GPS movement trail.
          </p>
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {/* PRIMARY EMPLOYEE SELECTOR DROPDOWN */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-lg text-blue-700">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="employee-dropdown" className="block text-xs font-bold text-gray-700">
              Select Employee:
            </label>
            <select
              id="employee-dropdown"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            >
              {employees.length === 0 && <option value="">No employees found</option>}
              {employees.map((emp) => {
                const empActive = allTasks.find(
                  (tk) => tk.assigned_to === emp.id && tk.status === 'IN_PROGRESS'
                )
                const empLatest = empActive || allTasks.filter((tk) => tk.assigned_to === emp.id)[0]
                return (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {empLatest ? `· Task: ${empLatest.title} (${empLatest.status})` : '· (No task)'}
                  </option>
                )
              })}
            </select>
          </div>
        </div>

        {selectedEmployee && (
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-gray-600 bg-blue-50/80 px-3 py-2 rounded-xl border border-blue-100">
            <span>Ward {selectedEmployee.ward_no}</span>
            <span>·</span>
            <span className="font-semibold text-blue-900">
              {latestTask ? `Latest Task: ${latestTask.title}` : 'No active task'}
            </span>
          </div>
        )}
      </div>

      {/* LATEST TASK HEADER SUMMARY */}
      {latestTask ? (
        <Card className="mb-3 p-3.5 border-l-4 border-l-blue-600">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-950">{latestTask.title}</span>
                <Badge value={latestTask.status} />
                {latestTask.status === 'IN_PROGRESS' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    Live Working
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {latestTask.description || 'Assigned municipal work'} · 📍{' '}
                <b>{latestTask.location_name || 'Designated Area'}</b> (Geofence: {taskRadius}m radius)
              </p>
            </div>

            {currentPosition && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold border ${
                    currentPosition.inside_geofence
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-300 animate-bounce'
                  }`}
                >
                  {currentPosition.inside_geofence
                    ? `✅ Inside 50m Zone (${currentPosition.distance}m from pin)`
                    : `🚨 GEOFENCE BREACH (${currentPosition.distance}m away)`}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-900">
          <p className="font-bold">No tasks assigned to {selectedEmployee?.name || 'this worker'} yet.</p>
          <p className="mt-1 text-amber-700">Assign a new task with a pinned location in the Tasks section to track live movement.</p>
          <Link
            to="/supervisor/tasks"
            className="mt-2 inline-block rounded-lg bg-blue-600 px-3.5 py-1.5 font-bold text-white shadow-xs hover:bg-blue-700"
          >
            Go to Assign Task
          </Link>
        </div>
      )}

      {/* MAP VIEW CONTAINER */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
        <MapErrorBoundary>
          <MapContainer
            center={taskHasLocation ? [taskLat, taskLng] : DEFAULT_PUNE}
            zoom={16}
            scrollWheelZoom={true}
            style={{ height: '62vh', minHeight: '400px', width: '100%' }}
            className="w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <SafeFitBounds points={points} />

            {/* 1. LATEST TASK TARGET PIN & 50m GEOFENCE BOUNDARY */}
            {taskHasLocation && (
              <>
                <Circle
                  center={[taskLat, taskLng]}
                  radius={taskRadius}
                  pathOptions={{
                    color: isCurrentlyBreached ? '#dc2626' : '#2563eb',
                    fillColor: isCurrentlyBreached ? '#f87171' : '#3b82f6',
                    fillOpacity: 0.2,
                    weight: 2.5,
                    dashArray: '5, 5',
                  }}
                />

                <Marker position={[taskLat, taskLng]}>
                  <Popup>
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-sm text-blue-900">🎯 Task Designated Center</p>
                      <p className="font-semibold">{latestTask.title}</p>
                      <p>📍 {latestTask.location_name || 'Designated Area'}</p>
                      <p>Radius: <b>{taskRadius} meters</b></p>
                      <Badge value={latestTask.status} />
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* 2. EMPLOYEE GPS MOVEMENT ROUTE TRAIL (Polyline like Photo 1) */}
            {routeCoords.length > 1 && (
              <>
                {/* Glow outline behind route line */}
                <Polyline
                  positions={routeCoords}
                  pathOptions={{
                    color: '#fb923c',
                    weight: 12,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />

                {/* Primary Route Path (Vibrant Vermilion Orange like fitness/movement map) */}
                <Polyline
                  positions={routeCoords}
                  pathOptions={{
                    color: '#ea580c',
                    weight: 6,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />

                {/* Waypoint markers along the route */}
                {validBreadcrumbs.map((b, idx) => (
                  <CircleMarker
                    key={b.id || idx}
                    center={[b.lat, b.lng]}
                    radius={4}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 1.5,
                      fillColor: b.inside_geofence ? '#ea580c' : '#dc2626',
                      fillOpacity: 1,
                    }}
                  >
                    <Popup>
                      <div className="space-y-0.5 text-xs">
                        <p className="font-bold">📍 Waypoint #{idx + 1}</p>
                        <p>Time: <b>{fmtTime(b.timestamp)}</b></p>
                        <p>Distance from center: <b>{b.distance}m</b></p>
                        <p>
                          {b.inside_geofence ? (
                            <span className="text-green-700 font-semibold">✅ Inside Geofence</span>
                          ) : (
                            <span className="text-red-700 font-bold">🚨 Outside Zone</span>
                          )}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </>
            )}

            {/* 3. ROUTE START POINT */}
            {startPoint && (
              <CircleMarker
                center={[startPoint.lat, startPoint.lng]}
                radius={8}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: '#16a34a',
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-green-700">🟢 Route Start Point</p>
                    <p>Time: {fmtTime(startPoint.timestamp)}</p>
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* 4. CURRENT / LATEST LIVE WORKER POSITION */}
            {currentPosition && (
              <CircleMarker
                center={[currentPosition.lat, currentPosition.lng]}
                radius={12}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3.5,
                  fillColor: currentPosition.inside_geofence ? '#2563eb' : '#dc2626',
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-sm">📍 Worker Current Position</p>
                    <p>Employee: <b>{selectedEmployee?.name || 'Worker'}</b></p>
                    <p>Task: <b>{latestTask?.title}</b></p>
                    <p>
                      Distance to task center:{' '}
                      <b className="text-base text-blue-900">{currentPosition.distance}m</b>
                    </p>
                    <p>
                      Geofence status:{' '}
                      <span
                        className={
                          currentPosition.inside_geofence
                            ? 'text-green-700 font-bold'
                            : 'text-red-700 font-bold'
                        }
                      >
                        {currentPosition.inside_geofence ? '✅ Inside 50m Boundary' : '🚨 OUTSIDE 50M BOUNDARY'}
                      </span>
                    </p>
                    <p className="text-gray-500">Updated: {fmtTime(currentPosition.timestamp)}</p>
                    <a
                      href={mapsLink(currentPosition.lat, currentPosition.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline block pt-0.5"
                    >
                      Open in Google Maps ↗
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* Fallback Check-in Marker if no task geofence */}
            {!taskHasLocation && employeeCheckIn && (
              <CircleMarker
                center={[Number(employeeCheckIn.latitude), Number(employeeCheckIn.longitude)]}
                radius={12}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3,
                  fillColor: '#16a34a',
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-sm">Checked In Today</p>
                    <p>{selectedEmployee?.name}</p>
                    <p>{fmtDateTime(employeeCheckIn.timestamp)}</p>
                    {employeeCheckIn.photo_url && (
                      <img src={employeeCheckIn.photo_url} alt="" className="h-16 w-16 rounded object-cover" />
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>
        </MapErrorBoundary>
      </div>

      {/* MAP LEGEND & STATS BAR */}
      <Card className="mt-3 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="font-bold text-gray-900">
            {selectedEmployee?.name ? `${selectedEmployee.name}'s Trail:` : 'Trail Info:'}
          </span>
          <span>
            {validBreadcrumbs.length > 0 ? (
              <b>{validBreadcrumbs.length} movement waypoints tracked</b>
            ) : (
              'Awaiting GPS route points'
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> 50m Geofence
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full bg-orange-600" /> GPS Route Trail
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-600 ring-2 ring-blue-300" /> Current Worker Pin
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-green-600" /> Route Start
          </span>
        </div>
      </Card>

      {/* WORK PHOTOS POSTED FOR THIS LATEST TASK */}
      {latestTask && (
        <div className="mt-4">
          <TaskPhotoViewer
            photos={latestTask.photos || []}
            title={`Work Proof Photos for "${latestTask.title}" (${selectedEmployee?.name || 'Worker'})`}
          />
        </div>
      )}
    </div>
  )
}
