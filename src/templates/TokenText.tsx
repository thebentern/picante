import { splitTokens } from '../doc/interpolate'
import type { TokenRender } from '../editing/Editable'

/**
 * Read-only rendering of body copy that carries {rollover}/{routine} tokens.
 * Used where the text is template boilerplate rather than an editable field —
 * the tokens still have to resolve, but there is nothing to commit.
 */
export function TokenText({ value, tokens }: { value: string; tokens: TokenRender[] }) {
  return (
    <>
      {splitTokens(value).map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.value}</span>
        const t = tokens.find((tk) => tk.name === seg.name)
        if (!t) return <span key={i}>{`{${seg.name}}`}</span>
        return (
          <span key={i} style={{ whiteSpace: 'nowrap', ...t.style }}>
            {t.runs.map((run, j) => (
              <span key={j} style={run.style}>
                {run.text}
              </span>
            ))}
          </span>
        )
      })}
    </>
  )
}
