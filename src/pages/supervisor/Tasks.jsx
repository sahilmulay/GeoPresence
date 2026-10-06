import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { useWardData } from '../../lib/wardData'
import { fmtDate } from '../../lib/format'
import { Badge, Button, Card, Empty, ErrorNote, Field, PageLoader, SectionTitle, inputCls } from '../../components/ui'

const FILTERS = [
  ['ALL', 'All'],
  ['PENDING', 'Pending'],
  ['IN_PROGRESS', 'In Progress'],
  ['COMPLETED', 'Completed'],
]

export default function SupervisorTasks() {
  const { profile } = useAuth()
  const { data, loading, error, reload } = useWardData(15000)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', status: 'PENDING' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState('ALL')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSuccess('')
    if (!form.assigned_to) return setFormError('Please choose an employee')
    setBusy(true)
    try {
      await api.createTask({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_by: profile.id,
        ward_no: profile.ward_no,
      })
      const who = data.employees.find((x) => x.id === form.assigned_to)?.name
      setSuccess(`Task "${form.title.trim()}" assigned to ${who}`)
      setForm({ title: '', description: '', assigned_to: form.assigned_to, status: 'PENDING' })
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
      <h1 className="mb-3 text-2xl font-bold">Tasks</h1>
      <ErrorNote>{error}</ErrorNote>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Assign a new task</h2>
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Task Title">
            <input className={inputCls} required value={form.title} onChange={set('title')} placeholder="e.g. Road Cleaning" />
          </Field>
          <Field label="Description">
            <textarea className={`${inputCls} min-h-24 py-2`} value={form.description} onChange={set('description')} placeholder="e.g. Clean Market Area" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assign Employee">
              <select className={inputCls} required value={form.assigned_to} onChange={set('assigned_to')}>
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={set('status')}>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </Field>
          </div>
          <ErrorNote>{formError}</ErrorNote>
          {success && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{success}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={!employees.length}>
            Create Task
          </Button>
          {!employees.length && <p className="text-xs text-gray-500">No employees in your ward yet.</p>}
        </form>
      </Card>

      <SectionTitle>All Tasks ({shown.length})</SectionTitle>
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
          {shown.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{t.title}</h3>
                <Badge value={t.status} />
              </div>
              {t.description && <p className="mt-1 text-sm text-gray-600">{t.description}</p>}
              <p className="mt-2 text-xs text-gray-500">
                Assigned to <span className="font-semibold text-gray-700">{t.assignee?.name}</span> · {fmtDate(t.created_at)}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>No tasks here.</Empty>
      )}
    </div>
  )
}
