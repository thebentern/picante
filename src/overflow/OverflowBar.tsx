import { describeFinding, hasOverflow, type OverflowReport } from './probe'

/**
 * The overflow report. Specific by design: which block, how many pixels over,
 * and what will actually disappear — a generic "content is too long" tells the
 * user nothing they can act on at 6.5 pt.
 */
export function OverflowBar({
  report,
  onHighlight,
}: {
  report: OverflowReport
  onHighlight: (block: string | null) => void
}) {
  const over = hasOverflow(report)
  const fallbackOnly = !report.loaded.length && report.fallback.length > 0

  if (!over && report.loaded.length === 0) {
    return (
      <div className="status status--ok" role="status">
        <span className="status__dot" aria-hidden="true" />
        Fits the page
      </div>
    )
  }

  return (
    <div className={`status ${over ? 'status--bad' : 'status--warn'}`} role="status">
      <div className="status__head">
        <span className="status__dot" aria-hidden="true" />
        {over
          ? `${report.loaded.length + report.fallback.length} overflow ${
              report.loaded.length + report.fallback.length === 1 ? 'problem' : 'problems'
            }`
          : 'At capacity'}
      </div>

      <ul className="status__list">
        {report.loaded.map((f, i) => (
          <li key={`l${i}`}>
            <button
              type="button"
              className="status__row"
              onMouseEnter={() => onHighlight(f.block ?? f.container)}
              onMouseLeave={() => onHighlight(null)}
              onFocus={() => onHighlight(f.block ?? f.container)}
              onBlur={() => onHighlight(null)}
            >
              {describeFinding(f)}
            </button>
          </li>
        ))}
        {report.fallback.map((f, i) => (
          <li key={`f${i}`}>
            <button
              type="button"
              className="status__row status__row--muted"
              onMouseEnter={() => onHighlight(f.block ?? f.container)}
              onMouseLeave={() => onHighlight(null)}
              onFocus={() => onHighlight(f.block ?? f.container)}
              onBlur={() => onHighlight(null)}
            >
              With fallback fonts — {describeFinding(f)}
            </button>
          </li>
        ))}
      </ul>

      {fallbackOnly ? (
        <p className="status__note">
          This only bites on a machine where the bundled fonts do not load. They are served from
          this site rather than a CDN, so it should not happen — but the card still has to survive
          it, because someone will print this from a file you emailed them.
        </p>
      ) : null}
    </div>
  )
}
