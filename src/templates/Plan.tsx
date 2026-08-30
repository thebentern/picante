import type { CSSProperties, ReactNode } from 'react'
import type { Doc } from '../doc/schema'
import { Editable } from '../editing/Editable'
import { MeshQr } from '../mesh/MeshQr'
import { MapFigure } from '../maps/MapFigure'
import { Page } from './Page'
import { TokenText } from './TokenText'
import { hasReadableMeshChannel, meshChannelKeyLabel, rolloverText, standardTokens } from './derive'
import * as C from './planContent'
import { color, font } from './tokens'

/**
 * Template C — the full multi-page guide the cards condense.
 *
 * Unlike A and B this is a *flowing* document: no fixed page boxes, the print
 * engine paginates it. That means no overflow risk here, and it is why the
 * overflow probe only measures the two card templates.
 *
 * Content splits two ways. Anything that differs between units — channels,
 * rally points, check-in windows, the Meshtastic channel set, OPSEC wording —
 * comes from the shared document, so editing it on the fold card updates it
 * here. Everything else (radio etiquette, the NATO alphabet, the sample
 * transmission) is boilerplate in planContent.ts.
 */

const mono = (extra?: CSSProperties): CSSProperties => ({ fontFamily: font.mono, ...extra })

const h2: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: `2px solid ${color.ink}`,
  paddingBottom: 6,
  margin: '26px 0 14px',
}

const h3: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  margin: '0 0 7px',
}

const body: CSSProperties = { fontSize: 15, lineHeight: 1.6, margin: '0 0 12px' }

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  borderBottom: `2px solid ${color.ink}`,
  padding: '5px 8px',
}

/** The remarks block reads as a warning by default, but does not have to. */
const accent = (tone: 'warning' | 'neutral') => (tone === 'warning' ? color.red : color.ink)

const boxLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

export function Plan({
  doc,
  update,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  const tokens = standardTokens(doc)
  const sequence = doc.channels.sequence
  const mapPoints = doc.rallyPoints
    .filter((rp) => rp.coords != null)
    .map((rp) => ({ key: rp.key, label: `Rally Point ${rp.name}`, lat: rp.coords!.lat, lon: rp.coords!.lon }))

  return (
    <Page mode={{ kind: 'flowing', size: 'letter', margin: '0.6in' }} style={{ fontFamily: font.display, color: color.ink }}>
      {/* ============================================================ page 1 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: `3px solid ${color.ink}`,
          paddingBottom: 10,
        }}
      >
        <div>
          <Editable
            as="h1"
            ariaLabel="Plan title"
            value={doc.meta.title}
            commitKey="meta.title"
            onCommit={(v) => update((d) => void (d.meta.title = v))}
            style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}
          />
          <Editable
            as="div"
            ariaLabel="Organization"
            value={doc.meta.org}
            commitKey="meta.org"
            onCommit={(v) => update((d) => void (d.meta.org = v))}
            style={{ marginTop: 6, fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', color: color.mutedInk }}
          />
        </div>
        <div style={mono({ fontSize: 11, textAlign: 'right', color: color.mutedInk, lineHeight: 1.5 })}>
          <div>{doc.meta.revision}</div>
          <div>{doc.meta.subtitle}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: color.amber,
        }}
      >
        Field card — tear off and carry
      </div>

      <div style={{ marginTop: 10, border: `2px solid ${color.ink}` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: color.ink,
            color: color.white,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {doc.meta.eyebrow}
          </div>
          <div style={mono({ fontSize: 11, color: color.planInvertedMuted })}>
            {doc.pace.map((t) => t.label.split('—')[1]?.trim() ?? t.label).join(' → ')}
          </div>
        </div>

        {doc.pace.map((tier, i) => (
          <div
            key={tier.letter}
            style={{
              display: 'grid',
              gridTemplateColumns: '38px 1fr',
              borderBottom: i < 3 ? `1px solid ${color.hairlineWarm}` : undefined,
            }}
          >
            <div
              style={{
                background: tier.color,
                color: color.white,
                fontSize: 22,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {tier.letter}
            </div>
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {tier.label}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 2 }}>
                <TokenText value={tier.body} tokens={tokens} />
                {/* The field card names the format beside the tier that uses it. */}
                {tier.letter === 'P' ? (
                  <>
                    <br />
                    Routine format: <span style={mono({ fontWeight: 600 })}>{doc.formats.routine}</span>
                  </>
                ) : null}
                {tier.letter === 'E' ? (
                  <>
                    <br />
                    Emergency format:{' '}
                    <span style={mono({ fontWeight: 600 })}>{doc.formats.emergency}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14 }}>
        <Framed>
          <RuledLabel>Communication windows</RuledLabel>
          <div style={{ fontSize: 11, color: color.mutedInk, margin: '6px 0 4px' }}>
            Greater emergency = more frequent check-ins
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {doc.checkIn.levels.map((level) => (
                <tr key={level.name}>
                  <td style={{ padding: '3px 0', fontWeight: 700, color: level.color }}>{level.name}</td>
                  <td style={mono({ padding: '3px 0', textAlign: 'right' })}>{level.interval}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, background: color.warmFill, padding: '5px 7px' }}>
            {doc.checkIn.lifeSafety}
            <br />
            {doc.checkIn.noChange}
          </div>
        </Framed>

        <Framed>
          <RuledLabel>Missed windows</RuledLabel>
          <div style={{ marginTop: 7, fontSize: 13, lineHeight: 1.6 }}>
            {doc.missed.map((m, i) => (
              <div key={i}>
                <span style={mono({ fontWeight: 700 })}>{m.step} missed</span> — {m.text}
              </div>
            ))}
          </div>
          <div style={{ ...boxLabel, borderBottom: `1px solid ${color.ink}`, paddingBottom: 5, marginTop: 12 }}>
            Rally points
          </div>
          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.45 }}>
            {doc.rallyPoints.map((rp) => (
              <div key={rp.id}>
                <strong>{rp.name}</strong> — {rp.street}, {rp.city}
              </div>
            ))}
          </div>
        </Framed>
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 14,
          alignItems: 'center',
          border: `1px solid ${color.ink}`,
          padding: '10px 12px',
        }}
      >
        <MeshQr doc={doc} size={104} />
        <div>
          <div style={boxLabel}>Meshtastic provisioning</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{doc.mesh.note}</div>
          <div style={mono({ fontSize: 11, color: color.mutedInk, marginTop: 5 })}>
            {doc.mesh.channels.length
              ? `Channels: ${doc.mesh.channels.map((c) => c.name).join(' · ')}`
              : 'No channels loaded — paste a provisioning URL in the Meshtastic panel.'}
          </div>
        </div>
      </div>

      {/* ============================================================ section 1 */}
      <h2 style={{ ...h2, breakBefore: 'page', margin: '0 0 14px' }}>1. How to use this plan</h2>
      {C.HOW_TO_USE.map((p, i) => (
        <p key={i} style={body}>
          {p}
        </p>
      ))}
      <Callout accent={color.amber} background={color.warmFillAlt}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
          {C.THREE_THINGS.title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>{C.THREE_THINGS.body}</div>
      </Callout>

      {/* ============================================================ section 2 */}
      <h2 style={h2}>2. The PACE ladder in detail</h2>
      {doc.pace.map((tier) => {
        const paragraphs = tier.detail.split(/\n\s*\n/).filter((p) => p.trim())
        return (
          <div key={tier.letter}>
            <h3 style={{ ...h3, fontSize: 15, letterSpacing: '0.05em', color: tier.color, margin: '0 0 5px' }}>
              {tier.letter} — {tier.label.replace(/^[A-Z]\s*—\s*/, '')}
            </h3>
            {paragraphs.map((paragraph, i) => (
              <p key={i} style={{ ...body, margin: i === paragraphs.length - 1 ? '0 0 14px' : '0 0 8px' }}>
                <TokenText value={paragraph} tokens={tokens} />
              </p>
            ))}
          </div>
        )
      })}
      <div className="keep" style={{ border: `1px solid ${color.ink}`, padding: '10px 14px', margin: '0 0 12px' }}>
        <div style={{ ...boxLabel, marginBottom: 5 }}>Report formats</div>
        <div style={mono({ fontSize: 13, lineHeight: 1.9 })}>
          <div>Routine{'  '}{doc.formats.routine}</div>
          <div>Emergency{'  '}{doc.formats.emergency}</div>
        </div>
      </div>

      {/* ============================================================ section 3 */}
      <h2 style={h2}>3. Check-in windows</h2>
      <p style={body}>{C.CHECK_IN_INTRO}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, margin: '0 0 12px' }}>
        <thead>
          <tr>
            <th style={{ ...th, padding: '6px 8px 6px 0' }}>Status</th>
            <th style={{ ...th, padding: '6px 8px' }}>Check in</th>
            <th style={{ ...th, padding: '6px 8px' }}>Typical condition</th>
          </tr>
        </thead>
        <tbody>
          {doc.checkIn.levels.map((level, i) => {
            const cell = { padding: '6px 8px', borderBottom: `1px solid ${color.planRowRule}` }
            return (
              <tr key={level.name}>
                <td style={{ ...cell, padding: '6px 8px 6px 0', fontWeight: 700, color: level.color }}>
                  {level.name}
                </td>
                <td style={mono(cell)}>{level.interval}</td>
                <td style={cell}>
                  <Editable
                    ariaLabel={`${level.name} typical condition`}
                    value={level.condition}
                    commitKey={`checkIn.${i}.condition`}
                    onCommit={(v) => update((d) => void (d.checkIn.levels[i]!.condition = v))}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Callout accent={color.ink} background={color.warmFill}>
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>
          {C.CHECK_IN_CALLOUT.map((c, i) => (
            <span key={i}>
              {i > 0 && <br />}
              <strong>{c.lead}</strong> {c.body}
            </span>
          ))}
        </div>
      </Callout>

      <h3 style={{ ...h3, fontSize: 15, letterSpacing: '0.05em', margin: '0 0 8px' }}>Missed windows</h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${doc.missed.length}, 1fr)`, gap: 10, margin: '0 0 12px' }}>
        {doc.missed.map((m, i) => (
          <div key={i} className="keep" style={{ border: `1px solid ${color.ink}`, padding: '10px 12px' }}>
            <div style={mono({ fontSize: 12, fontWeight: 700, color: i === doc.missed.length - 1 ? color.red : color.amber })}>
              {m.step} MISSED
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 3 }}>{m.text}</div>
          </div>
        ))}
      </div>

      {/* ============================================================ section 4 */}
      <h2 style={h2}>4. Rally points</h2>
      <p style={body}>{C.RALLY_INTRO}</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(doc.rallyPoints.length, 3)}, 1fr)`,
          gap: 12,
          margin: '0 0 14px',
        }}
      >
        {doc.rallyPoints.map((rp) => (
          <div key={rp.id} className="keep" style={{ border: `1px solid ${color.ink}`, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: color.blue,
                  color: color.white,
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                {rp.key}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: color.planEyebrow,
                    lineHeight: 1,
                  }}
                >
                  Rally Point
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1.15 }}>
                  {rp.name}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 7 }}>
              {rp.venue}
              <br />
              {rp.street}
              <br />
              {rp.city}
            </div>
            {rp.coords ? (
              <div style={mono({ fontSize: 11.5, color: color.mutedInk, marginTop: 5 })}>
                {rp.coords.lat.toFixed(5)}, {rp.coords.lon.toFixed(5)}
                {rp.coordsApproximate ? ' (approx.)' : ''}
              </div>
            ) : null}
            {rp.showMap ? (
              <div style={{ marginTop: 8 }}>
                <MapFigure
                  enabled={doc.privacy.mapsEnabled}
                  points={rp.coords ? [{ key: rp.key, label: rp.name, lat: rp.coords.lat, lon: rp.coords.lon }] : []}
                  zoom={17}
                  height={130}
                  ariaLabel={`Street map of Rally Point ${rp.name}`}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="keep" style={{ border: `1px solid ${color.ink}`, padding: '12px 14px', margin: '0 0 14px' }}>
        <div style={{ ...boxLabel, marginBottom: 6 }}>On arrival</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
          {doc.rallyOnArrival.map((step, i) => (
            <li key={i}>
              <TokenText value={step} tokens={tokens} />
            </li>
          ))}
        </ol>
      </div>

      <MapFigure
        enabled={doc.privacy.mapsEnabled}
        points={mapPoints}
        height={300}
        ariaLabel="Map showing every rally point"
        caption="Map data © OpenStreetMap contributors."
      />

      {/* ============================================================ section 5 */}
      <h2 style={{ ...h2, breakBefore: 'page', margin: '0 0 14px' }}>5. Channels and repeaters</h2>
      <p style={body}>
        <TokenText value={C.BAND_PLAN_INTRO} tokens={tokens} />
      </p>

      <h3 style={h3}>Channels</h3>
      {sequence.length === 0 ? (
        <p style={{ ...body, color: color.mutedInk }}>
          No channels yet. Add them in the Channels panel — they drive this table, both cards, and
          the rollover sequence in section 2.
        </p>
      ) : (
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 13,
            margin: '0 0 16px',
            minWidth: '20rem',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...th, padding: '5px 8px 5px 0', width: '2.5rem' }}>#</th>
              <th style={{ ...th, padding: '5px 8px', width: '12rem' }}>Channel</th>
              <th style={{ ...th, padding: '5px 20px 5px 8px' }}>Freq (MHz)</th>
            </tr>
          </thead>
          <tbody>
            {sequence.map((channel, i) => {
              const cell = { padding: '4px 8px', borderBottom: `1px solid ${color.planRowRule}` }
              return (
                <tr key={channel.id}>
                  <td style={mono({ ...cell, padding: '4px 8px 4px 0' })}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{channel.label}</td>
                  <td style={mono(cell)}>{channel.freq}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <Callout accent={color.amber} background={color.warmFillAlt} style={{ margin: '-8px 0 16px', fontSize: 13, lineHeight: 1.5 }}>
        <Editable
          multiline
          ariaLabel="Channel list caveat"
          value={doc.channels.caveat}
          commitKey="channels.caveat"
          onCommit={(v) => update((d) => void (d.channels.caveat = v))}
        />
      </Callout>

      {/* Repeaters get the full width: the table is five columns wide and the
          list is open-ended, so squeezing it into half a page wraps every
          band and tone onto two lines. */}
      <h3 style={h3}>Repeaters</h3>
      {doc.channels.repeaters.length === 0 ? (
        <p style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 18px', color: color.mutedInk }}>
          None listed. Add the repeaters your unit monitors in the Channels panel — they are
          region-specific, so this app ships without any.
        </p>
      ) : (
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 13,
            margin: '0 0 18px',
            minWidth: '28rem',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...th, padding: '5px 8px 5px 0' }}>Preset</th>
              <th style={{ ...th, padding: '5px 8px' }}>Band</th>
              <th style={{ ...th, padding: '5px 8px' }}>Call</th>
              <th style={{ ...th, padding: '5px 8px' }}>Freq (MHz)</th>
              <th style={{ ...th, padding: '5px 8px' }}>Offset / tone</th>
            </tr>
          </thead>
          <tbody>
            {doc.channels.repeaters.map((r) => {
              const cell = {
                padding: '4px 8px',
                borderBottom: `1px solid ${color.planRowRule}`,
                whiteSpace: 'nowrap' as const,
              }
              return (
                <tr key={r.id}>
                  <td style={mono({ ...cell, padding: '4px 8px 4px 0' })}>{r.preset}</td>
                  <td style={cell}>{r.band}</td>
                  <td style={mono(cell)}>{r.call}</td>
                  <td style={mono(cell)}>{r.freq}</td>
                  <td style={mono(cell)}>{r.tone}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h3 style={h3}>Weather</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, margin: '0 0 10px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 8px 4px 0', borderBottom: `1px solid ${color.planRowRule}` }}>
                  {doc.channels.weather.label}
                </td>
                <td style={mono({ padding: '4px 0', textAlign: 'right', borderBottom: `1px solid ${color.planRowRule}` })}>
                  {doc.channels.weather.freq}
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, lineHeight: 1.55, margin: 0, color: color.softInk }}>
            <Editable
              multiline
              ariaLabel="Weather note"
              value={doc.channels.weather.note}
              commitKey="channels.weather.note"
              onCommit={(v) => update((d) => void (d.channels.weather.note = v))}
            />
          </p>
        </div>

        <div>
          <h3 style={h3}>Meshtastic radio config</h3>
          {doc.mesh.radioConfig.length === 0 ? (
            <p style={{ fontSize: 13, lineHeight: 1.55, margin: 0, color: color.mutedInk }}>
              Read from the provisioning URL once one is pasted.
            </p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {doc.mesh.radioConfig.map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 8px 4px 0', borderBottom: `1px solid ${color.planRowRule}` }}>
                        {row.label}
                      </td>
                      <td style={mono({ padding: '4px 0', textAlign: 'right', borderBottom: `1px solid ${color.planRowRule}` })}>
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0', color: color.mutedInk }}>
                {C.MESH_CONFIG_NOTE}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ============================================================ section 6 */}
      <h2 style={{ ...h2, breakBefore: 'page', margin: '0 0 14px' }}>6. Meshtastic provisioning</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 20, alignItems: 'start', margin: '0 0 16px' }}>
        <div className="keep">
          <MeshQr doc={doc} size={170} style={{ border: `1px solid ${color.ink}` }} />
          <div style={{ fontSize: 11, color: color.mutedInk, marginTop: 5, textAlign: 'center' }}>
            Scan with the Meshtastic app
          </div>
        </div>
        <div>
          {C.MESH_INTRO.map((p, i) => (
            <p key={i} style={{ ...body, margin: i === C.MESH_INTRO.length - 1 ? 0 : '0 0 12px' }}>
              {p}
            </p>
          ))}
        </div>
      </div>

      {doc.mesh.channels.length > 0 ? (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, margin: '0 0 14px' }}>
            <thead>
              <tr>
                <th style={{ ...th, padding: '5px 8px 5px 0' }}>Channel</th>
                <th style={{ ...th, padding: '5px 8px' }}>Key</th>
                <th style={{ ...th, padding: '5px 8px' }}>Use it for</th>
              </tr>
            </thead>
            <tbody>
              {doc.mesh.channels.map((ch, i) => {
                const cell = { padding: '7px 8px', borderBottom: `1px solid ${color.planTableRule}` }
                return (
                  <tr key={i}>
                    <td style={mono({ ...cell, padding: '7px 8px 7px 0', fontWeight: 700 })}>{ch.name}</td>
                    <td style={{ ...cell, fontSize: 13 }}>{meshChannelKeyLabel(ch.keyKind)}</td>
                    <td style={{ ...cell, lineHeight: 1.45 }}>
                      <Editable
                        multiline
                        ariaLabel={`${ch.name} role`}
                        value={ch.role}
                        commitKey={`mesh.${i}.role`}
                        onCommit={(v) => update((d) => void (d.mesh.channels[i]!.role = v))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {hasReadableMeshChannel(doc) ? (
            <Callout accent={color.red} background={color.redFill} style={{ fontSize: 14, lineHeight: 1.55 }}>
              <strong>{doc.mesh.warning}</strong> Apply the operational security rules in section 7
              to every channel, and assume anything on an unencrypted one is public.
            </Callout>
          ) : null}
        </>
      ) : (
        <p style={{ ...body, color: color.mutedInk }}>
          No channels loaded yet. Paste your meshtastic.org/e/# URL in the Meshtastic panel and this
          table fills itself in from the code, so the printed roles cannot drift from what the
          radios are actually provisioned with.
        </p>
      )}

      {/* ============================================================ section 7 */}
      <h2 style={{ ...h2, breakBefore: 'page', margin: '0 0 14px' }}>7. Radio operation</h2>
      <div
        className="keep"
        style={{
          border: `2px solid ${accent(doc.remarks.plan.tone)}`,
          padding: '10px 14px',
          margin: '0 0 16px',
        }}
      >
        <div style={{ ...boxLabel, color: accent(doc.remarks.plan.tone), marginBottom: 5 }}>
          <Editable
            ariaLabel="Plan remarks heading"
            value={doc.remarks.plan.heading}
            commitKey="remarks.plan.heading"
            onCommit={(v) => update((d) => void (d.remarks.plan.heading = v))}
          />
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>
          <Editable
            multiline
            ariaLabel="Plan remarks"
            value={doc.remarks.plan.body}
            commitKey="remarks.plan.body"
            onCommit={(v) => update((d) => void (d.remarks.plan.body = v))}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '0 0 16px' }}>
        <div>
          <h3 style={h3}>Making a call</h3>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
            {C.MAKING_A_CALL.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          <h3 style={h3}>Think before you speak</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
            {C.THINK_BEFORE.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <h3 style={h3}>Etiquette</h3>
      <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
        {C.ETIQUETTE.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <div className="keep" style={{ background: color.ink, color: color.planInvertedText, padding: '12px 16px', margin: '0 0 16px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: color.foldRule,
            marginBottom: 7,
          }}
        >
          Sample transmission
        </div>
        <div style={mono({ fontSize: 12.5, lineHeight: 1.75 })}>
          {C.SAMPLE_TRANSMISSION.map((t, i) => (
            <div key={i}>
              <span style={{ color: t.speaker === 'A' ? color.planSpeakerA : color.planSpeakerB }}>
                {t.label}
              </span>{' '}
              {t.line}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h3 style={h3}>Radio user terms</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <tbody>
              {C.RADIO_TERMS.map(([term, meaning]) => (
                <tr key={term}>
                  <td style={{ padding: '4px 8px 4px 0', fontWeight: 700, borderBottom: `1px solid ${color.planRowRule}`, whiteSpace: 'nowrap' }}>
                    {term}
                  </td>
                  <td style={{ padding: '4px 0', borderBottom: `1px solid ${color.planRowRule}` }}>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ ...h3, margin: '16px 0 7px' }}>Channel vs frequency mode</h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{C.CHANNEL_VS_FREQUENCY}</p>
        </div>
        <div>
          <h3 style={h3}>NATO phonetic alphabet</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', fontSize: 13.5, lineHeight: 1.72 }}>
            {/* Interleaved so the grid reads A–M down the left and N–Z down the
                right, rather than snaking A B / C D across the rows. */}
            {Array.from({ length: C.NATO.length / 2 }, (_, i) =>
              [C.NATO[i]!, C.NATO[i + C.NATO.length / 2]!].map(([letter, word]) => (
                <div key={letter}>
                  <span style={mono({ fontWeight: 700 })}>{letter}</span> {word}
                </div>
              )),
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, paddingTop: 10, borderTop: `1px solid ${color.hairline}`, fontSize: 11, color: color.mutedInk }}>
        {doc.meta.org} · {doc.meta.revision} · Rollover {rolloverText(doc)}
      </div>
    </Page>
  )
}

const Framed = ({ children }: { children: ReactNode }) => (
  <div className="keep" style={{ border: `1px solid ${color.ink}`, padding: '10px 12px' }}>
    {children}
  </div>
)

const RuledLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ ...boxLabel, borderBottom: `1px solid ${color.ink}`, paddingBottom: 5 }}>{children}</div>
)

const Callout = ({
  accent,
  background,
  style,
  children,
}: {
  accent: string
  background: string
  style?: CSSProperties
  children: ReactNode
}) => (
  <div
    className="keep"
    style={{
      borderLeft: `4px solid ${accent}`,
      background,
      padding: '10px 14px',
      margin: '0 0 16px',
      ...style,
    }}
  >
    {children}
  </div>
)
