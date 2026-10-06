import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button, ErrorNote, Field, inputCls } from '../../components/ui'
import { AuthShell } from './Login'

export default function Register() {
  const { signUp } = useAuth()
  const [role, set{t('auth.role')}] = useState('employee')
  const [form, setForm] = useState({ name: '', email: '', password: '', ward_no: '' })
  const [error, setError] = useState('')
  const { t } = useLanguage()
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) return setError('{t('auth.password')} must be at least 6 characters')
    setBusy(true)
    try {
      const res = await signUp({ role, ...form, name: form.name.trim(), email: form.email.trim() })
      if (res.needsConfirmation) {
        setNotice('Account created! Please check your email to confirm, then log in.')
        setBusy(false)
      }
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Choose your role to get started">
      <div className="mb-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="{t('auth.role')}">
        {[
          ['employee', 'Employee', 'Field worker'],
          ['supervisor', 'Supervisor', 'Ward in-charge'],
        ].map(([val, label, sub]) => (
          <button
            key={val}
            type="button"
            role="radio"
            aria-checked={role === val}
            onClick={() => set{t('auth.role')}(val)}
            className={`rounded-xl border-2 p-3 text-left ${
              role === val ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          >
            <span className="block font-semibold text-gray-900">{label}</span>
            <span className="block text-xs text-gray-500">{sub}</span>
          </button>
        ))}
      </div>

      {notice ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>
          <Link to="/auth/login" className="block text-center font-semibold text-blue-600">
            Go to login
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <Field label="{t('auth.name')}">
            <input className={inputCls} required value={form.name} onChange={set('name')} placeholder="e.g. Sahil Mulay" autoComplete="name" />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="{t('auth.password')}">
            <input className={inputCls} type="password" required minLength={6} value={form.password} onChange={set('password')} placeholder="At least 6 characters" autoComplete="new-password" />
          </Field>
          <Field label="{t('common.ward')}">
            <input className={inputCls} type="number" inputMode="numeric" min="1" required value={form.ward_no} onChange={set('ward_no')} placeholder="e.g. 5" />
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" className="w-full" loading={busy}>
            Register as {role === 'supervisor' ? 'Supervisor' : 'Employee'}
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-semibold text-blue-600">
          Login
        </Link>
      </p>
    </AuthShell>
  )
}
