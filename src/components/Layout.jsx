import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, localApi } from '../lib/api'

const ICONS = {
  home: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9',
  attendance: 'M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  map: 'M9 20l-6-3V4l6 3m0 13l6-3m-6 3V7m6 10l6 3V7l-6-3m0 13V4',
  history: 'M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  )
}

const NAV = {
  supervisor: [
    { to: '/supervisor/dashboard', labelKey: 'nav.home', icon: 'home' },
    { to: '/supervisor/tasks', labelKey: 'nav.tasks', icon: 'tasks' },
    { to: '/supervisor/attendance', labelKey: 'nav.attendance', icon: 'attendance' },
    { to: '/supervisor/map', labelKey: 'nav.map', icon: 'map' },
  ],
  employee: [
    { to: '/employee/dashboard', labelKey: 'nav.home', icon: 'home' },
    { to: '/employee/history', labelKey: 'nav.history', icon: 'history' },
  ],
}

export default function Layout() {
  const { profile, role, signOut } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const items = NAV[role] ?? []

  const toggleLang = () => {
    setLang(lang === 'en' ? 'mr' : 'en')
  }

  const logout = async () => {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  const linkCls = ({ isActive }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium md:flex-none md:flex-row md:gap-2 md:rounded-lg md:px-3 md:text-sm ${
      isActive ? 'text-blue-600 md:bg-blue-50' : 'text-gray-500 hover:text-gray-800'
    }`

  return (
    <div className="min-h-dvh bg-[#F5F5F5]">
      {isDemoMode && (
        <div className="bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-800">
          Demo mode: data is stored in this browser.{' '}
          <button
            className="font-semibold underline"
            onClick={async () => {
              await localApi.resetDemo()
              navigate('/auth/login', { replace: true })
            }}
          >
            Reset demo data
          </button>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <div className="leading-tight">
              <p className="font-bold text-gray-900">{t('app.title')}</p>
              <p className="text-xs text-gray-500">
                {role === 'supervisor' ? t('role.supervisor') : t('role.employee')} · {t('common.ward')} {profile?.ward_no}
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} className={linkCls}>
                <Icon name={i.icon} />
                {t(i.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/citizen"
              className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 flex items-center gap-1 shadow-xs"
            >
              <span>🏛️</span>
              <span className="hidden sm:inline">Citizen Portal</span>
            </Link>
            <button
              onClick={toggleLang}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold hover:bg-gray-50"
            >
              {t('lang.switch')}
            </button>
            <button onClick={logout} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 md:pb-10">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-3xl">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={linkCls}>
              <Icon name={i.icon} />
              {t(i.labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
