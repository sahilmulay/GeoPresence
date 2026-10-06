import { initials, titleCase } from '../lib/format'

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  )
}

const BTN = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300',
  success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-green-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  outline: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:text-gray-400',
}

export function Button({ variant = 'primary', className = '', loading, children, ...rest }) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  )
}

export function Spinner({ small }) {
  const size = small ? 'h-4 w-4' : 'h-8 w-8'
  return (
    <span
      className={`inline-block ${size} animate-spin rounded-full border-2 border-current border-t-transparent text-blue-600`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  )
}

const BADGE = {
  PRESENT: 'bg-green-50 text-green-700 border-green-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CHECKIN: 'bg-green-50 text-green-700 border-green-200',
  FLAGGED: 'bg-red-50 text-red-700 border-red-200',
  ABSENT: 'bg-red-50 text-red-700 border-red-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  CHECKOUT: 'bg-blue-50 text-blue-700 border-blue-200',
  OUT: 'bg-gray-100 text-gray-700 border-gray-200',
}

export function Badge({ value, label }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE[value] ?? BADGE.OUT}`}
    >
      {label ?? titleCase(value)}
    </span>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full min-h-12 rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'

export function Avatar({ name, src, size = 'h-11 w-11' }) {
  if (src)
    return <img src={src} alt={`${name} selfie`} className={`${size} shrink-0 rounded-full border border-gray-200 object-cover`} />
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">{children}</div>
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {children}
    </p>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-lg font-bold text-gray-900">{children}</h2>
      {right}
    </div>
  )
}
