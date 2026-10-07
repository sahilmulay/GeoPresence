// Resize a captured/selected photo so uploads are fast on mobile networks.
export async function resizeBlob(blob, maxSize = 640, quality = 0.75) {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process photo'))), 'image/jpeg', quality),
  )
}

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })

// Promise wrapper around the browser Geolocation API with fallback
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location is not supported on this device'))

    const tryGet = (highAccuracy) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        (err) => {
          if (highAccuracy && err.code !== 1) {
            // Fall back to standard/network accuracy (crucial for laptops/desktops without satellite GPS)
            tryGet(false)
            return
          }
          const msg =
            err.code === 1
              ? 'Location permission denied. Please allow location access in your browser or Mac settings.'
              : 'Could not get your GPS location. Please ensure Location Services are enabled, or simply tap directly on the map to pin your location.'
          reject(new Error(msg))
        },
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 6000 : 10000, maximumAge: highAccuracy ? 0 : 60000 },
      )
    }

    tryGet(true)
  })
}
