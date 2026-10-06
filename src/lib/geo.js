export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // metres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // in metres
}

export const GEOFENCE_RADIUS_M = 500

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`)
    const data = await res.json()
    const name = data.address?.road || data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || data.name
    return name || `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
  } catch {
    return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
  }
}
