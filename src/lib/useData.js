import { useCallback, useEffect, useRef, useState } from 'react'

// Tiny data-fetching hook with optional polling (so a supervisor sees check-ins live).
export function useData(fetcher, deps = [], { poll = 0 } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setData(await fetchRef.current())
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    if (!poll) return
    const t = setInterval(() => reload(true), poll)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, poll, ...deps])

  return { data, loading, error, reload, setData }
}
