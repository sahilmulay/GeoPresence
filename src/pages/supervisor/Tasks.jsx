import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { useWardData } from '../../lib/wardData'
import { getPosition } from '../../lib/device'
import { fmtDate } from '../../lib/format'
import TaskPhotoViewer from '../../components/TaskPhotoViewer'
import { Badge, Button, Card, Empty, ErrorNote, Field, LocationLabel, PageLoader, SectionTitle, inputCls } from '../../components/ui'

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Pune coordinates as default center
const DEFAULT_CENTER = [18.5204, 73.8567]

function LocationPicker({ position, setPosition, radius = 50 }) {
  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
    },
  })
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, 16)
    }
  }, [position, map])

  if (!position) return null
  return (
    <>
      <Marker position={position} />
      <Circle
        center={position}
        radius={Number(radius) || 50}
        pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.25 }}
      />
    </>
  )
}

export default function SupervisorTasks() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const { data, loading, error, reload } = useWardData(15000)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', status: 'PENDING', location_name: '', radius_m: 50 })
  const [targetPos, setTargetPos] = useState(null)
  const [busy, setBusy] = useState(false)
  const [fetchingLoc, setFetchingLoc] = useState(false)

  const handleUseMyLocation = async () => {
    setFetchingLoc(true)
    try {
      const pos = await getPosition()
      setTargetPos([pos.latitude, pos.longitude])
    } catch (e) {
      alert('Could not get your location: ' + e.message)
    } finally {
      setFetchingLoc(false)
    }
  }
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState('ALL')

  const FILTERS = [
    ['ALL', t('tasks.all')],
    ['PENDING', t('tasks.pending')],
    ['IN_PROGRESS', t('tasks.in_progress')],
    ['COMPLETED', t('tasks.completed')],
  ]

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSuccess('')
    if (!form.assigned_to) return setFormError('Please choose an employee')
    setBusy(true)
    try {
      const baseTask = {
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_by: profile.id,
        ward_no: profile.ward_no,
        status: form.status,
        location_name: form.location_name.trim(),
        target_lat: targetPos?.[0] ?? null,
        target_lng: targetPos?.[1] ?? null,
        radius_m: Number(form.radius_m) || 50,
      }

      if (form.assigned_to === 'ALL') {
        await Promise.all(
          data.employees.map((emp) => api.createTask({ ...baseTask, assigned_to: emp.id }))
        )
        setSuccess(`Task "${baseTask.title}" assigned to all employees`)
      } else {
        await api.createTask({ ...baseTask, assigned_to: form.assigned_to })
        const who = data.employees.find((x) => x.id === form.assigned_to)?.name
        setSuccess(`Task "${baseTask.title}" assigned to ${who}`)
      }

      setForm({ title: '', description: '', assigned_to: form.assigned_to, status: 'PENDING', location_name: '', radius_m: 50 })
      setTargetPos(null)
      await reload(true)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoader />
  const { employees = [], tasks = [] } = data ?? {}
  const shown = tasks.filter((t) => filter === 'ALL' || t.status === filter)

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">{t('tasks.title')}</h1>
      <ErrorNote>{error}</ErrorNote>

      <Card>
        <h2 className="mb-3 text-lg font-bold">{t('tasks.assign_new')}</h2>
        <form className="space-y-3" onSubmit={submit}>
          <Field label={t('tasks.task_title')}>
            <input className={inputCls} required value={form.title} onChange={set('title')} placeholder={t('tasks.task_title_ph')} />
          </Field>
          <Field label={t('tasks.description')}>
            <textarea className={`${inputCls} min-h-24 py-2`} value={form.description} onChange={set('description')} placeholder={t('tasks.description_ph')} />
          </Field>
          
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">{t('tasks.geo_opt')}</h3>
              <button 
                type="button" 
                onClick={handleUseMyLocation} 
                disabled={fetchingLoc}
                className="text-xs font-semibold text-blue-600 hover:underline disabled:text-gray-400"
              >
                {fetchingLoc ? t('tasks.fetching') : t('tasks.use_loc')}
              </button>
            </div>
            <p className="text-xs text-gray-500">{t('tasks.geo_desc')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tasks.loc_name')}>
                <input className={inputCls} value={form.location_name} onChange={set('location_name')} placeholder={t('tasks.loc_name_ph')} />
              </Field>
              <Field label="Geofence Radius (m)">
                <input 
                  type="number" 
                  min="10" 
                  max="500" 
                  step="5" 
                  className={inputCls} 
                  value={form.radius_m} 
                  onChange={set('radius_m')} 
                />
              </Field>
            </div>
            <div className="h-48 w-full overflow-hidden rounded-md border border-gray-300">
              <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker position={targetPos} setPosition={setTargetPos} radius={form.radius_m} />
              </MapContainer>
            </div>
            {targetPos && <p className="text-xs text-green-700">{t('tasks.loc_selected')} ({form.radius_m || 50}m radius set)</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('tasks.assign_employee')}>
              <select className={inputCls} required value={form.assigned_to} onChange={set('assigned_to')}>
                <option value="">{t('tasks.select')}</option>
                {employees.length > 0 && <option value="ALL">{t('tasks.all_employees')}</option>}
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('tasks.status')}>
              <select className={inputCls} value={form.status} onChange={set('status')}>
                <option value="PENDING">{t('tasks.pending')}</option>
                <option value="IN_PROGRESS">{t('tasks.in_progress')}</option>
                <option value="COMPLETED">{t('tasks.completed')}</option>
              </select>
            </Field>
          </div>
          <ErrorNote>{formError}</ErrorNote>
          {success && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{success}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={!employees.length}>
            {t('tasks.create')}
          </Button>
          {!employees.length && <p className="text-xs text-gray-500">{t('tasks.no_employees')}</p>}
        </form>
      </Card>

      <SectionTitle>{t('tasks.all_tasks')} ({shown.length})</SectionTitle>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${
              filter === v ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="space-y-3">
          {shown.map((tk) => (
            <Card key={tk.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{tk.title}</h3>
                <Badge value={tk.status} />
              </div>
              {tk.description && <p className="mt-1 text-sm text-gray-600">{tk.description}</p>}
              <p className="mt-1 text-xs font-semibold text-blue-700 flex items-center gap-1">
                <span>📍</span>
                <span>
                  {tk.location_name
                    ? tk.location_name
                    : tk.target_lat && tk.target_lng
                      ? <LocationLabel lat={tk.target_lat} lng={tk.target_lng} fallback={`Ward ${tk.ward_no || profile.ward_no || 5}`} />
                      : `Ram Mandir Chowk, Ward ${tk.ward_no || profile.ward_no || 5}`}
                </span>
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {t('tasks.assigned_to')} <span className="font-semibold text-gray-700">{tk.assignee?.name}</span> · {fmtDate(tk.created_at)}
              </p>

              {/* Work Photos submitted by worker */}
              <TaskPhotoViewer
                photos={tk.photos || []}
                title={`${t('tasks.work_photos')} · ${tk.assignee?.name || 'Worker'}`}
              />

              {(!tk.photos || tk.photos.length === 0) && tk.status === 'IN_PROGRESS' && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-800">
                  <span>⏳</span>
                  <span>Awaiting work progress photos from worker</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty>{t('tasks.no_tasks')}</Empty>
      )}
    </div>
  )
}
