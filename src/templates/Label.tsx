import type { CSSProperties } from 'react'
import type { Doc } from '../doc/schema'
import { Editable } from '../editing/Editable'
import { Block } from './Block'
import { Page } from './Page'
import { MeshQr } from '../mesh/MeshQr'
import { standardTokens } from './derive'
import { color, font, page } from './tokens'

/**
 * Template B — the 62 x 100 mm Brother QL-500 die-cut thermal label.
 *
 * Monochrome only. The QL-500 is a 1-bit thermal device with no grays, so
 * section headers are solid black bars with white text and never gray fills — a
 * gray fill dithers into visible noise under the print head. All type is #000
 * and the PACE tier colors are deliberately ignored here.
 *
 * Type scale: 13pt title, 7pt tier labels, 6.5pt body, 6pt notes, 5.5pt section
 * bars, 5pt QR caption. 6.5pt is the floor — below that, 300 dpi thermal output
 * stops being reliably readable. There is roughly 10px of slack in the whole
 * layout, so the overflow report is not decorative here.
 */

const bar: CSSProperties = {
  background: color.black,
  color: color.white,
  fontSize: '5.5pt',
  fontWeight: 800,
  letterSpacing: '0.1em',
  padding: '0.5mm 1.2mm',
}

const mono = (extra?: CSSProperties): CSSProperties => ({ fontFamily: font.mono, ...extra })

export function Label({
  doc,
  update,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  const tokens = standardTokens(doc, 700, false)
  const channels = doc.channels.sequence
  const half = Math.ceil(channels.length / 2)

  return (
    <Page
      mode={{ kind: 'fixed', width: page.label.width, height: page.label.height }}
      style={{
        padding: '2.4mm 2.6mm',
        display: 'flex',
        flexDirection: 'column',
        gap: '1mm',
        fontFamily: font.display,
        color: color.black,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: `1.2pt solid ${color.black}`,
          paddingBottom: '0.8mm',
          flex: 'none',
        }}
      >
        <div style={{ fontSize: '13pt', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {doc.meta.title.toUpperCase()}
        </div>
        <div style={mono({ fontSize: '5pt', fontWeight: 600, textAlign: 'right', lineHeight: 1.25 })}>
          <Editable
            as="div"
            ariaLabel="Label organization"
            value={doc.meta.orgShort}
            commitKey="meta.orgShort"
            onCommit={(v) => update((d) => void (d.meta.orgShort = v))}
          />
          <Editable
            as="div"
            ariaLabel="Label revision"
            value={doc.meta.revisionShort}
            commitKey="meta.revisionShort"
            onCommit={(v) => update((d) => void (d.meta.revisionShort = v))}
          />
        </div>
      </div>

      <Block label="Label · PACE ladder" style={{ border: `1pt solid ${color.black}`, flex: 'none' }}>
        {doc.pace.map((tier, i) => (
          <div
            key={tier.letter}
            style={{
              display: 'grid',
              gridTemplateColumns: '5mm 1fr',
              borderBottom: i < 3 ? `0.5pt solid ${color.black}` : undefined,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                background: color.black,
                color: color.white,
                fontSize: '9pt',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {tier.letter}
            </div>
            <div style={{ padding: '0.6mm 1.2mm', fontSize: '6.5pt', lineHeight: 1.2 }}>
              <Editable
                ariaLabel={`${tier.letter} label heading`}
                value={tier.shortLabel}
                commitKey={`pace.${i}.shortLabel`}
                onCommit={(v) => update((d) => void (d.pace[i]!.shortLabel = v))}
                style={{ fontWeight: 700 }}
              />{' '}
              <Editable
                ariaLabel={`${tier.letter} label body`}
                value={tier.shortBody}
                commitKey={`pace.${i}.shortBody`}
                onCommit={(v) => update((d) => void (d.pace[i]!.shortBody = v))}
                tokens={tokens}
              />
            </div>
          </div>
        ))}
      </Block>

      <div
        style={mono({
          fontSize: '5.5pt',
          fontWeight: 700,
          lineHeight: 1.3,
          border: `1pt solid ${color.black}`,
          padding: '0.6mm 1.2mm',
          flex: 'none',
        })}
      >
        {doc.formats.routine}
        <br />
        EMERGENCY: {doc.formats.emergency}
      </div>

      <Block label="Label · check-in" style={{ flex: 'none' }}>
        <div style={bar}>CHECK-IN</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '6.5pt',
            fontWeight: 800,
            marginTop: '0.7mm',
            borderBottom: `0.5pt solid ${color.black}`,
            paddingBottom: '0.6mm',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {doc.checkIn.levels.map((level) => (
            <span key={level.name} style={{ whiteSpace: 'nowrap' }}>
              {level.name}{' '}
              <span style={mono({ fontWeight: 400 })}>{shortInterval(level.interval)}</span>
            </span>
          ))}
        </div>
        <div style={{ fontSize: '6.5pt', lineHeight: 1.25, marginTop: '0.5mm' }}>
          {doc.checkIn.lifeSafety} {doc.checkIn.noChange}
          <br />
          Missed:{' '}
          {doc.missed.map((m, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              <strong>{m.step}</strong> {shortMissed(m.text)}
            </span>
          ))}
          .
        </div>
      </Block>

      <Block label="Label · channels" style={{ flex: 'none' }}>
        <div style={{ ...bar, display: 'flex', justifyContent: 'space-between' }}>
          <span>CHANNELS</span>
          <span style={mono()}>
            {abbreviateWeather(doc.channels.weather.label)} {doc.channels.weather.freq}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt', marginTop: '0.6mm' }}>
          <tbody>
            {Array.from({ length: half }, (_, i) => {
              const left = channels[i]
              const right = channels[i + half]
              return (
                <tr key={i}>
                  <td style={mono({ padding: '0.35mm 0', fontWeight: 700 })}>{left?.label}</td>
                  <td style={mono({ padding: '0.35mm 0' })}>{left?.freq}</td>
                  <td style={mono({ padding: '0.35mm 0 0.3mm 1.5mm', fontWeight: 700 })}>
                    {right?.label}
                  </td>
                  <td style={mono({ padding: '0.35mm 0', textAlign: 'right' })}>{right?.freq}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Block>

      <Block
        label="Label · rally points"
        style={{ display: 'flex', gap: '1.4mm', alignItems: 'flex-start', flex: 'none' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={bar}>RALLY POINTS</div>
          <div style={{ fontSize: '6.5pt', lineHeight: 1.3, marginTop: '0.5mm' }}>
            {doc.rallyPoints.map((rp, i) => (
              <div key={rp.id}>
                <strong>{rp.key}</strong> {rp.venue}
                <br />
                <Editable
                  ariaLabel={`Label rally point ${rp.key} street`}
                  value={rp.street}
                  commitKey={`rally.${i}.street`}
                  onCommit={(v) => update((d) => void (d.rallyPoints[i]!.street = v))}
                />
                {', '}
                <Editable
                  ariaLabel={`Label rally point ${rp.key} city`}
                  value={rp.shortCity || rp.city}
                  commitKey={`rally.${i}.shortCity`}
                  onCommit={(v) => update((d) => void (d.rallyPoints[i]!.shortCity = v))}
                />
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 'none', width: '16mm', textAlign: 'center' }}>
          <MeshQr doc={doc} size="16mm" />
          <div
            style={{
              fontSize: '5pt',
              fontWeight: 800,
              letterSpacing: '0.04em',
              lineHeight: 1.1,
              marginTop: '0.3mm',
            }}
          >
            SCAN: MESH
          </div>
        </div>
      </Block>

      <Block
        label="Label · remarks"
        pinned
        style={{
          marginTop: 'auto',
          borderTop: `1.2pt solid ${color.black}`,
          paddingTop: '0.6mm',
          fontSize: '6.5pt',
          lineHeight: 1.25,
          flex: 'none',
        }}
      >
        <Editable
          ariaLabel="Label remarks heading"
          value={doc.remarks.label.heading}
          commitKey="remarks.label.heading"
          onCommit={(v) => update((d) => void (d.remarks.label.heading = v))}
          style={{ fontWeight: 700 }}
        />
        {doc.remarks.label.heading.trim() ? ': ' : ''}
        <Editable
          multiline
          ariaLabel="Label remarks"
          value={doc.remarks.label.body}
          commitKey="remarks.label.body"
          onCommit={(v) => update((d) => void (d.remarks.label.body = v))}
        />
      </Block>
    </Page>
  )
}

/**
 * "Every 15 minutes" -> "15 min"; "Every hour" -> "1 hr". The label has no room
 * for the long form, and a bare "hour" reads as a missing number.
 */
function shortInterval(interval: string): string {
  const m = /(\d+)?\s*(hours?|hrs?|minutes?|mins?)/i.exec(interval)
  if (!m) return interval.replace(/^every\s+/i, '')
  const n = m[1] ?? '1'
  return /^h/i.test(m[2]!) ? `${n} hr` : `${n} min`
}

/** "Attempt contact on the current method." -> "retry" */
function shortMissed(text: string): string {
  if (/welfare/i.test(text)) return 'welfare check'
  if (/next/i.test(text)) return 'next'
  return 'retry'
}

/** "NWS Weather Radio" -> "NWS" so the bar never wraps. */
function abbreviateWeather(label: string): string {
  const acronym = /^([A-Z]{2,5})\b/.exec(label)
  return acronym ? acronym[1]! : label.split(/\s+/)[0]!
}
