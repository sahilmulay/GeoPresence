import { api } from './api'
import { useData } from './useData'
import { sameDay } from './format'

// Loads everything a supervisor needs for the ward (auto-refreshes so check-ins appear live).
export function useWardData(poll = 10000) {
  return useData(
    async () => {
      const [employees, attendance, tasks] = await Promise.all([api.listEmployees(), api.listAttendance(), api.listTasks()])
      return { employees, attendance, tasks }
    },
    [],
    { poll },
  )
}

// 'PRESENT' | 'OUT' | 'ABSENT' for an employee today, plus first check-in / last check-out.
export function todaySummary(employeeId, attendance, ref = new Date()) {
  const rows = attendance
    .filter((a) => a.employee_id === employeeId && sameDay(a.timestamp, ref))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const ins = rows.filter((r) => r.check_type === 'CHECKIN')
  const outs = rows.filter((r) => r.check_type === 'CHECKOUT')
  const checkIn = ins[0]
  const checkOut = outs[outs.length - 1]
  const last = rows[rows.length - 1]
  const state = !checkIn ? 'ABSENT' : last.check_type === 'CHECKOUT' ? 'OUT' : 'PRESENT'
  const flagged = rows.some((r) => r.status === 'FLAGGED')
  return { state, checkIn, checkOut, flagged, rows }
}
