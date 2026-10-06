import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastId = useRef(undefined)

  const loadProfile = useCallback(async (id) => {
    try {
      setProfile(await Promise.race([api.getProfile(id), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))]))
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = api.subscribe((id) => {
      if (lastId.current === id) return // ignore token-refresh noise
      lastId.current = id
      if (!id) {
        setProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setTimeout(() => loadProfile(id), 0)
    })
    return unsubscribe
  }, [loadProfile])

  const value = useMemo(
    () => ({
      profile,
      role: profile?.role ?? null,
      loading,
      signIn: (creds) => api.signIn(creds),
      signUp: (data) => api.signUp(data),
      signOut: () => api.signOut(),
    }),
    [profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
