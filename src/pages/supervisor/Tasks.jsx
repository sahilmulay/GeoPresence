import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { useWardData } from '../../lib/wardData'
import { fmtDate } from '../../lib/format'
import { Badge, Button, Card, Empty, ErrorNote, Field, PageLoader, SectionTitle, inputCls } from '../../components/ui'

export default function SupervisorTasks() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const { data, loading, error, reload } = useWardData(15000)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', status: 'PENDING' })
  const [busy, setBusy] = useState(false)
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
        status: form.status
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
              <p className="mt-2 text-xs text-gray-500">
                {t('tasks.assigned_to')} <span className="font-semibold text-gray-700">{tk.assignee?.name}</span> · {fmtDate(tk.created_at)}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>{t('tasks.no_tasks')}</Empty>
      )}
    </div>
  )
}
