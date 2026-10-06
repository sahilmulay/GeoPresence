import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './ui'

export const homeFor = (role) => (role === 'supervisor' ? '/supervisor/dashboard' : '/employee/dashboard')

// Only logged-in users with the matching role may enter.
export function RequireRole({ role }) {
  const { profile, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!profile) return <Navigate to="/auth/login" replace />
  if (profile.role !== role) return <Navigate to={homeFor(profile.role)} replace />
  return <Outlet />
}

// Login / register: bounce logged-in users to their dashboard.
export function PublicOnly() {
  const { profile, loading } = useAuth()
  if (loading) return <PageLoader />
  if (profile) return <Navigate to={homeFor(profile.role)} replace />
  return <Outlet />
}

export function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <PageLoader />
  return <Navigate to={profile ? homeFor(profile.role) : '/auth/login'} replace />
}
