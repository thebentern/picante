import { useEffect, useState, type RefObject } from 'react'
import { probeOverflow, type OverflowReport } from './probe'

const EMPTY: OverflowReport = { loaded: [], fallback: [] }

/**
 * Re-measure after every edit, coalesced to one frame, plus once when web fonts
 * finish loading (they change the answer) and on resize.
 */
export function useOverflow(
  ref: RefObject<HTMLElement | null>,
  /** Any value that changes when the document does. */
  revision: unknown,
  enabled: boolean,
): OverflowReport {
  const [report, setReport] = useState<OverflowReport>(EMPTY)

  useEffect(() => {
    if (!enabled) {
      setReport(EMPTY)
      return
    }
    let frame = 0
    let live = true

    const run = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const el = ref.current
        if (!live || !el) return
        try {
          setReport(probeOverflow(el))
        } catch (err) {
          // A measurement failure must never take the editor down with it.
          console.warn('picante: overflow probe failed —', err)
        }
      })
    }

    run()
    document.fonts?.ready.then(run).catch(() => {})
    window.addEventListener('resize', run)

    return () => {
      live = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', run)
    }
  }, [ref, revision, enabled])

  return report
}
