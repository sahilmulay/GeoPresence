import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, ErrorNote, Field, inputCls } from '../../components/ui'

export const DEMO_ACCOUNTS = [
  { label: '{t('auth.demo_sup')}', sub: 'Rajesh Patil · Ward 5', email: 'rajesh.patil@geopresence.demo' },
  { label: '{t('auth.demo_emp')}', sub: 'Sahil Mulay · Ward 5', email: 'sahil@geopresence.demo' },
]
const DEMO_PASSWORD = 'Demo@123'
const showDemo = import.meta.env.VITE_SHOW_DEMO_LOGINS !== 'false'

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-dvh bg-[#F5F5F5] px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <img src="/icon.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
          <h1 className="mt-3 text-2xl font-bold text-gray-900">GeoPresence</h1>
          <p className="text-sm text-gray-500">Municipal workforce attendance & tasks</p>
        </div>
        <Card className="p-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mb-4 text-sm text-gray-500">{subtitle}</p>
          {children}
        </Card>
      </div>
    </div>
  )
}

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, set{t('auth.password')}] = useState('')
  const [error, setError] = useState('')
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)

  const submit = async (creds) => {
    setError('')
    setBusy(true)
    try {
      await signIn(creds)
      // PublicOnly guard redirects to the right dashboard once the profile loads.
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Login" subtitle="Sign in to continue">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit({ email: email.trim(), password })
        }}
      >
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="{t('auth.password')}">
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => set{t('auth.password')}(e.target.value)} placeholder="Your password" />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" loading={busy}>
          Login
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        New here?{' '}
        <Link to="/auth/register" className="font-semibold text-blue-600">
          Create an account
        </Link>
      </p>

      {showDemo && (
        <div className="mt-5 border-t border-gray-200 pt-4">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Quick demo login</p>
          <div className="grid grid-cols-2 gap-3">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                disabled={busy}
                onClick={() => submit({ email: a.email, password: DEMO_PASSWORD })}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-left hover:bg-blue-50 disabled:opacity-60"
              >
                <span className="block text-sm font-semibold text-gray-900">{a.label}</span>
                <span className="block text-xs text-gray-500">{a.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  )
}
