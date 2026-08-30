/**
 * Body copy carries {rollover} and {routine} placeholders so the prose stays in
 * sync with the channel and format fields without the user having to remember to
 * edit two places. Templates render the tokens as JSX (mono type, arrow glyphs),
 * so this splits rather than string-replaces.
 */
export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'token'; name: string }

const TOKEN = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g

export function splitTokens(source: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of source.matchAll(TOKEN)) {
    if (m.index > last) out.push({ kind: 'text', value: source.slice(last, m.index) })
    out.push({ kind: 'token', name: m[1]! })
    last = m.index + m[0].length
  }
  if (last < source.length) out.push({ kind: 'text', value: source.slice(last) })
  return out
}
