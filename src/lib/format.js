// Small date / format helpers shared across the app.

export const sameDay = (iso, ref = new Date()) => {
  const d = new Date(iso)
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}

export const isToday = (iso) => sameDay(iso)

// yyyy-mm-dd in LOCAL time (for <input type="date">)
export const toDateInput = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '—'

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

export const fmtDateTime = (iso) => `${fmtDate(iso)}, ${fmtTime(iso)}`

export const fmtCoords = (lat, lng) =>
  lat == null || lng == null ? '—' : `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`

export const mapsLink = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('')

export const titleCase = (s = '') => s.replaceAll('_', ' ').toLowerCase().replace(/^\w|\s\w/g, (c) => c.toUpperCase())
