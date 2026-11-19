import { isSupabaseConfigured, supabaseApi } from './supabaseApi'
import { localApi } from './localApi'
import { useState, useEffect } from 'react'

let activeBackend = isSupabaseConfigured ? supabaseApi : localApi
export let isDemoMode = activeBackend === localApi

const activeSubscribers = new Set()
const modeListeners = new Set()

function broadcastMode() {
  isDemoMode = activeBackend === localApi
  modeListeners.forEach((cb) => {
    try {
      cb({ isDemoMode, mode: activeBackend.mode })
    } catch (e) {
      console.error('[GeoPresence] Mode listener error:', e)
    }
  })
}

export function useBackendMode() {
  const [modeState, setModeState] = useState({
    isDemoMode: activeBackend === localApi,
    mode: activeBackend.mode,
  })

  useEffect(() => {
    modeListeners.add(setModeState)
    return () => modeListeners.delete(setModeState)
  }, [])

  return modeState
}

export function switchToLocalApi() {
  if (activeBackend !== localApi) {
    console.info('[GeoPresence] Switching active API backend to localApi (demo mode)')
    activeBackend = localApi
    broadcastMode()
    try {
      const db = JSON.parse(localStorage.getItem('geopresence_demo_v1') || '{}')
      activeSubscribers.forEach((cb) => {
        try {
          cb(db.session ?? null)
        } catch (e) {
          console.error(e)
        }
      })
    } catch {}
  }
}

export function switchToSupabaseApi() {
  if (isSupabaseConfigured && activeBackend !== supabaseApi) {
    console.info('[GeoPresence] Switching active API backend to supabaseApi (live cloud mode)')
    activeBackend = supabaseApi
    broadcastMode()
    try {
      localStorage.removeItem('geopresence_demo_v1')
    } catch {}
    supabaseApi.subscribe((id) => {
      activeSubscribers.forEach((cb) => {
        try {
          cb(id)
        } catch (e) {
          console.error(e)
        }
      })
    })
  }
}

export { localApi, isSupabaseConfigured }

export const api = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === 'mode') return activeBackend.mode
      if (prop === 'switchToLocalApi') return switchToLocalApi
      if (prop === 'switchToSupabaseApi') return switchToSupabaseApi

      if (prop === 'subscribe') {
        return (cb) => {
          activeSubscribers.add(cb)
          const unsubscribe = activeBackend.subscribe((id) => {
            try {
              cb(id)
            } catch (err) {
              console.error('[GeoPresence] Subscriber error:', err)
            }
          })
          return () => {
            activeSubscribers.delete(cb)
            if (typeof unsubscribe === 'function') unsubscribe()
          }
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
              if (prop === 'signIn') {
                throw new Error(
                  'Cannot connect to Supabase database (Failed to fetch). ' +
                  'Please check your internet connection or verify your Supabase project is active.'
                )
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
