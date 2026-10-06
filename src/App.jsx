import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import Layout from './components/Layout'
import { PublicOnly, RequireRole, RootRedirect } from './components/guards'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import SupervisorDashboard from './pages/supervisor/Dashboard'
import SupervisorTasks from './pages/supervisor/Tasks'
import SupervisorAttendance from './pages/supervisor/Attendance'
import SupervisorMap from './pages/supervisor/MapPage'
import EmployeeDashboard from './pages/employee/Dashboard'
import EmployeeHistory from './pages/employee/History'

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route element={<PublicOnly />}>
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
          </Route>

          <Route element={<RequireRole role="supervisor" />}>
            <Route element={<Layout />}>
              <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
              <Route path="/supervisor/tasks" element={<SupervisorTasks />} />
              <Route path="/supervisor/attendance" element={<SupervisorAttendance />} />
              <Route path="/supervisor/map" element={<SupervisorMap />} />
            </Route>
          </Route>

          <Route element={<RequireRole role="employee" />}>
            <Route element={<Layout />}>
              <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
              <Route path="/employee/history" element={<EmployeeHistory />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
