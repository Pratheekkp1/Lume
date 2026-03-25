import { useState, useRef, useEffect, useCallback } from 'react'

export default function useDebouncedSave(saveFn, delay = 500, fadeDelay = 2000) {
  const [saved, setSaved] = useState(false)
  const timerRef = useRef(null)
  const fadeTimerRef = useRef(null)
  const pendingValueRef = useRef(null)
  const saveFnRef = useRef(saveFn)

  // Keep saveFn ref current without triggering effects
  saveFnRef.current = saveFn

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      if (pendingValueRef.current !== null) {
        saveFnRef.current(pendingValueRef.current)
        pendingValueRef.current = null
        setSaved(true)
        fadeTimerRef.current = setTimeout(() => setSaved(false), fadeDelay)
      }
    }
  }, [fadeDelay])

  const triggerSave = useCallback((value) => {
    pendingValueRef.current = value
    if (timerRef.current) clearTimeout(timerRef.current)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setSaved(false)

    timerRef.current = setTimeout(async () => {
      timerRef.current = null
      pendingValueRef.current = null
      await saveFnRef.current(value)
      setSaved(true)
      fadeTimerRef.current = setTimeout(() => setSaved(false), fadeDelay)
    }, delay)
  }, [delay, fadeDelay])

  // Cleanup on unmount — flush pending save
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        if (pendingValueRef.current !== null) {
          saveFnRef.current(pendingValueRef.current)
        }
      }
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  return { saved, triggerSave, flush }
}
