import { isSupabaseConfigured, supabaseApi } from './supabaseApi'
import { localApi } from './localApi'

let activeBackend = isSupabaseConfigured ? supabaseApi : localApi
export let isDemoMode = !isSupabaseConfigured

const clientSubscribers = new Set()
let unsubscribeBackend = null

function setupBackendSubscription() {
  if (unsubscribeBackend) {
    try {
      unsubscribeBackend()
    } catch {}
  }

  unsubscribeBackend = activeBackend.subscribe((userId) => {
    clientSubscribers.forEach((cb) => {
      try {
        cb(userId)
      } catch (err) {
        console.error('[GeoPresence] Auth callback error:', err)
      }
    })
  })
}

// Initialize backend subscription
setupBackendSubscription()

export function switchToLocalApi() {
  if (activeBackend !== localApi) {
    console.info('[GeoPresence] Switching active API backend to localApi (demo mode)')
    activeBackend = localApi
    isDemoMode = true
    setupBackendSubscription()
  }
}

export { localApi, isSupabaseConfigured }

export const api = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === 'mode') return activeBackend.mode
      if (prop === 'switchToLocalApi') return switchToLocalApi

      if (prop === 'subscribe') {
        return (cb) => {
          clientSubscribers.add(cb)
          // For demo mode or immediate session check
          if (activeBackend.mode === 'demo') {
            try {
              const db = JSON.parse(localStorage.getItem('geopresence_demo_v1') || '{}')
              cb(db.session ?? null)
            } catch {
              cb(null)
            }
          }
          return () => clientSubscribers.delete(cb)
        }
      }

      if (prop === 'subscribeAlerts') {
        return (...args) => {
          if (typeof activeBackend.subscribeAlerts === 'function') {
            return activeBackend.subscribeAlerts(...args)
          }
          return () => {}
        }
      }

      const originalMethod = activeBackend[prop]
      if (typeof originalMethod === 'function') {
        return async (...args) => {
          // Special quick path for demo users if Supabase might be unreachable
          if (prop === 'signIn' && args[0]?.email?.endsWith('@geopresence.demo') && activeBackend === supabaseApi) {
            try {
              return await Promise.race([
                originalMethod.apply(activeBackend, args),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Failed to fetch')), 2000)
                ),
              ])
            } catch (err) {
              console.warn('[GeoPresence] Supabase sign-in timed out or unreachable for demo user. Falling back to local demo mode.')
              switchToLocalApi()
              return await localApi.signIn(...args)
            }
          }

          try {
            return await originalMethod.apply(activeBackend, args)
          } catch (err) {
            const isNetworkError =
              err?.message === 'Failed to fetch' ||
              err?.message?.includes('fetch') ||
              err?.message?.includes('NetworkError') ||
              err?.message?.includes('Failed to load') ||
              (err?.name === 'TypeError' && err?.message?.toLowerCase().includes('fetch'))

            if (isNetworkError && activeBackend === supabaseApi) {
              console.warn(`[GeoPresence] Supabase network error on ${prop}:`, err.message)

              // If logging in with demo creds, fall back to localApi
              if (prop === 'signIn' && args[0]?.email?.endsWith('@geopresence.demo')) {
                console.info('[GeoPresence] Demo account detected. Automatically falling back to local demo mode.')
                switchToLocalApi()
                return await localApi.signIn(...args)
              }

              if (prop === 'signIn') {
                throw new Error(
                  'Cannot connect to Supabase database (Failed to fetch). ' +
                  'The project may be paused, deleted, or Vercel environment variables need to be updated. ' +
                  'You can use the Quick Demo Login buttons below to access the application.'
                )
              }

              // For other operations, switch to localApi and retry
              switchToLocalApi()
              if (typeof localApi[prop] === 'function') {
                return await localApi[prop](...args)
              }
            }
            throw err
          }
        }
      }

      return originalMethod
    },
  }
)
