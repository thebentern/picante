import type { CSSProperties } from 'react'
import type { Doc } from '../doc/schema'
import { Editable } from '../editing/Editable'
import { useEditing } from '../editing/context'
import { Block } from './Block'
import { Page } from './Page'
import { MeshQr } from '../mesh/MeshQr'
import { standardTokens, hasReadableMeshChannel } from './derive'
import { color, font, page } from './tokens'

/**
 * Template A — the 8.5 x 11 in fold card.
 *
 * Every measurement here is read off `PACE Fold Card.dc.html`; the reference's
 * inline styles are the spec. Letter portrait, zero page margin, one column flex
 * with three children: front panel, fold rule, back panel.
 *
 * The back panel's `rotate(180deg)` is deliberate and must survive to print.
 * Folding the bottom half behind the top and flipping left-to-right puts it
 * upright. It looks upside down on screen; that is correct.
 */

const sectionHeading: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  borderBottom: `2px solid ${color.ink}`,
  paddingBottom: 5,
}

const mono = (extra?: CSSProperties): CSSProperties => ({ fontFamily: font.mono, ...extra })

/** The remarks block reads as a warning by default, but does not have to. */
const accent = (tone: 'warning' | 'neutral') => (tone === 'warning' ? color.red : color.ink)

export function FoldCard({
  doc,
  update,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  const { mode } = useEditing()
  const tokens = standardTokens(doc)
  // Editing inside a 180-degree rotation inverts caret movement and drag
  // selection, so the panel is unwound while editing and re-applied for preview
  // and for every export path.
  const backRotation = mode === 'edit' ? 'none' : 'rotate(180deg)'

  return (
    <Page
      mode={{ kind: 'fixed', width: page.letter.width, height: page.letter.height }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: font.display,
        color: color.ink,
      }}
    >
      {/* ---------------------------------------------------------------- front */}
      <Block
        label="Front panel"
        clip
        style={{
          flex: 1,
          minHeight: 0,
          padding: '0.3in 0.36in 0.14in',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: `3px solid ${color.ink}`,
            paddingBottom: 8,
          }}
        >
          <div>
            <Editable
              as="div"
              ariaLabel="Card title"
              value={doc.meta.title}
              commitKey="meta.title"
              onCommit={(v) => update((d) => void (d.meta.title = v))}
              style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}
            />
            <Editable
              as="div"
              ariaLabel="Organization"
              value={doc.meta.org}
              commitKey="meta.org"
              onCommit={(v) => update((d) => void (d.meta.org = v))}
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.03em',
                color: color.mutedInk,
                marginTop: 5,
              }}
            />
          </div>
          <div style={mono({ fontSize: 11, color: color.mutedInk, textAlign: 'right', lineHeight: 1.5 })}>
            <Editable
              as="div"
              ariaLabel="Revision"
              value={doc.meta.revision}
              commitKey="meta.revision"
              onCommit={(v) => update((d) => void (d.meta.revision = v))}
            />
            <Editable
              as="div"
              ariaLabel="Subtitle"
              value={doc.meta.subtitle}
              commitKey="meta.subtitle"
              onCommit={(v) => update((d) => void (d.meta.subtitle = v))}
            />
          </div>
        </div>

        <Editable
          as="div"
          ariaLabel="Eyebrow"
          value={doc.meta.eyebrow}
          commitKey="meta.eyebrow"
          onCommit={(v) => update((d) => void (d.meta.eyebrow = v))}
          style={{
            marginTop: 9,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: color.amber,
          }}
        />

        <Block
          label="PACE ladder"
          clip
          style={{
            marginTop: 7,
            border: `2px solid ${color.ink}`,
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateRows: 'repeat(4, 1fr)',
          }}
        >
          {doc.pace.map((tier, i) => (
            <div
              key={tier.letter}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr',
                borderBottom: i < 3 ? `1px solid ${color.hairlineWarm}` : undefined,
              }}
            >
              <div
                style={{
                  background: tier.color,
                  color: color.white,
                  fontSize: 26,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tier.letter}
              </div>
              <div
                style={{
                  padding: '8px 13px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Editable
                  as="div"
                  ariaLabel={`${tier.letter} tier label`}
                  value={tier.label}
                  commitKey={`pace.${i}.label`}
                  onCommit={(v) => update((d) => void (d.pace[i]!.label = v))}
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                />
                <Editable
                  as="div"
                  multiline
                  ariaLabel={`${tier.letter} tier description`}
                  value={tier.body}
                  commitKey={`pace.${i}.body`}
                  onCommit={(v) => update((d) => void (d.pace[i]!.body = v))}
                  tokens={tokens}
                  style={{ fontSize: 14, lineHeight: 1.4, marginTop: 3 }}
                />
              </div>
            </div>
          ))}
        </Block>

        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <FormatBox
            label="Routine report"
            value={doc.formats.routine}
            commitKey="formats.routine"
            onCommit={(v) => update((d) => void (d.formats.routine = v))}
          />
          <FormatBox
            label="Emergency report"
            value={doc.formats.emergency}
            commitKey="formats.emergency"
            onCommit={(v) => update((d) => void (d.formats.emergency = v))}
          />
        </div>
      </Block>

      {/* ------------------------------------------------------------- fold rule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 0.26in', flex: 'none' }}>
        <div style={{ flex: 1, borderTop: `1px dashed ${color.foldRule}` }} />
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: color.foldRule,
          }}
        >
          Fold
        </div>
        <div style={{ flex: 1, borderTop: `1px dashed ${color.foldRule}` }} />
      </div>

      {/* ----------------------------------------------------------------- back */}
      <Block
        label="Back panel"
        clip
        style={{
          flex: 1,
          minHeight: 0,
          padding: '0.14in 0.36in 0.3in',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          transform: backRotation,
        }}
      >
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          <BackLeft doc={doc} update={update} />
          <BackRight doc={doc} update={update} />
        </div>
      </Block>
    </Page>
  )
}

function FormatBox({
  label,
  value,
  commitKey,
  onCommit,
}: {
  label: string
  value: string
  commitKey: string
  onCommit: (v: string) => void
}) {
  return (
    <div style={{ border: `1.5px solid ${color.ink}`, padding: '6px 11px' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: color.mutedInk,
        }}
      >
        {label}
      </div>
      <Editable
        as="div"
        ariaLabel={label}
        value={value}
        commitKey={commitKey}
        onCommit={onCommit}
        style={mono({ fontSize: 15, fontWeight: 600, marginTop: 2 })}
      />
    </div>
  )
}

function BackLeft({ doc, update }: { doc: Doc; update: (fn: (d: Doc) => void) => void }) {
  const channels = doc.channels.sequence
  const rows: (typeof channels)[number][][] = []
  for (let i = 0; i < Math.ceil(channels.length / 2); i++) {
    rows.push([channels[i]!, channels[i + Math.ceil(channels.length / 2)]!].filter(Boolean))
  }
  const cell: CSSProperties = { padding: '4px 0', borderBottom: `1px solid ${color.hairline}` }

  return (
    <Block
      label="Back panel · left column"
      clip
      style={{ flex: 1.05, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}
    >
      <div style={sectionHeading}>Check-in windows</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, marginTop: 6 }}>
        <tbody>
          {doc.checkIn.levels.map((level, i) => (
            <tr key={level.name}>
              <td style={{ padding: '5px 0', fontWeight: 700, color: level.color, borderBottom: `1px solid ${color.hairline}` }}>
                <Editable
                  value={level.name}
                  commitKey={`checkIn.${i}.name`}
                  ariaLabel="Status level"
                  onCommit={(v) => update((d) => void (d.checkIn.levels[i]!.name = v))}
                />
              </td>
              <td style={{ padding: '5px 0', textAlign: 'right', fontFamily: font.mono, borderBottom: `1px solid ${color.hairline}` }}>
                <Editable
                  value={level.interval}
                  commitKey={`checkIn.${i}.interval`}
                  ariaLabel="Check-in interval"
                  onCommit={(v) => update((d) => void (d.checkIn.levels[i]!.interval = v))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          marginTop: 6,
          background: color.warmFill,
          padding: '6px 9px',
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        <Editable
          as="div"
          ariaLabel="Life safety note"
          value={doc.checkIn.lifeSafety}
          commitKey="checkIn.lifeSafety"
          onCommit={(v) => update((d) => void (d.checkIn.lifeSafety = v))}
          style={{ fontWeight: 700, display: 'inline' }}
        />{' '}
        Report immediately and keep reporting.
        <br />
        <Editable
          ariaLabel="No-change note"
          value={doc.checkIn.noChange}
          commitKey="checkIn.noChange"
          onCommit={(v) => update((d) => void (d.checkIn.noChange = v))}
          style={{ fontWeight: 700 }}
        />
      </div>

      <div style={{ ...sectionHeading, marginTop: 9 }}>Missed windows</div>
      <div style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.6 }}>
        {doc.missed.map((m, i) => (
          <div key={i}>
            <span style={mono({ fontWeight: 700 })}>{m.step}</span>
            {'  '}
            <Editable
              value={m.text}
              commitKey={`missed.${i}`}
              ariaLabel={`Missed window step ${m.step}`}
              onCommit={(v) => update((d) => void (d.missed[i]!.text = v))}
            />
          </div>
        ))}
      </div>

      <div style={{ ...sectionHeading, marginTop: 9 }}>Key channels</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, marginTop: 5 }}>
        <tbody>
          {rows.map((pair, i) => (
            <tr key={i}>
              <td style={mono({ ...cell, fontWeight: 700, whiteSpace: 'nowrap' })}>{pair[0]?.label}</td>
              <td style={mono({ ...cell, textAlign: 'right' })}>{pair[0]?.freq}</td>
              <td style={mono({ ...cell, padding: '4px 0 4px 18px', fontWeight: 700, whiteSpace: 'nowrap' })}>
                {pair[1]?.label}
              </td>
              <td style={mono({ ...cell, textAlign: 'right' })}>{pair[1]?.freq}</td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: '4px 0' }} colSpan={2}>
              <Editable
                value={doc.channels.weather.label}
                commitKey="channels.weather.label"
                ariaLabel="Weather station"
                onCommit={(v) => update((d) => void (d.channels.weather.label = v))}
              />
            </td>
            <td style={mono({ padding: '4px 0', textAlign: 'right' })} colSpan={2}>
              <Editable
                value={doc.channels.weather.freq}
                commitKey="channels.weather.freq"
                ariaLabel="Weather frequency"
                onCommit={(v) => update((d) => void (d.channels.weather.freq = v))}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* A free block, pinned to the bottom. The heading is the user's; it
          defaults to an OPSEC notice because that is what these cards usually
          carry last. */}
      <Block
        label="Remarks"
        pinned
        style={{
          marginTop: 'auto',
          border: `2px solid ${accent(doc.remarks.card.tone)}`,
          padding: '6px 9px',
          fontSize: 11.5,
          lineHeight: 1.4,
        }}
      >
        <Editable
          ariaLabel="Remarks heading"
          value={doc.remarks.card.heading}
          commitKey="remarks.card.heading"
          onCommit={(v) => update((d) => void (d.remarks.card.heading = v))}
          style={{ fontWeight: 700, color: accent(doc.remarks.card.tone) }}
        />
        {doc.remarks.card.heading.trim() ? '. ' : ''}
        <Editable
          multiline
          ariaLabel="Remarks"
          value={doc.remarks.card.body}
          commitKey="remarks.card.body"
          onCommit={(v) => update((d) => void (d.remarks.card.body = v))}
        />
      </Block>
    </Block>
  )
}

function BackRight({ doc, update }: { doc: Doc; update: (fn: (d: Doc) => void) => void }) {
  const showMeshWarning = hasReadableMeshChannel(doc)
  return (
    <Block
      label="Back panel · right column"
      clip
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}
    >
      <div style={sectionHeading}>Rally points</div>
      <div style={{ fontSize: 13, lineHeight: 1.4, marginTop: 6 }}>
        {doc.rallyPoints.map((rp, i) => (
          <div
            key={rp.id}
            style={{
              display: 'flex',
              gap: 8,
              padding: '6px 0',
              borderBottom:
                i < doc.rallyPoints.length - 1 ? `1px solid ${color.hairline}` : undefined,
            }}
          >
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
                marginTop: 1,
              }}
            >
              {rp.key}
            </div>
            <div>
              <Editable
                ariaLabel={`Rally point ${rp.key} name`}
                value={rp.name}
                commitKey={`rally.${i}.name`}
                onCommit={(v) => update((d) => void (d.rallyPoints[i]!.name = v))}
                style={{ fontSize: 14, fontWeight: 700 }}
              />
              {' · '}
              <Editable
                ariaLabel={`Rally point ${rp.key} venue`}
                value={rp.venue}
                commitKey={`rally.${i}.venue`}
                onCommit={(v) => update((d) => void (d.rallyPoints[i]!.venue = v))}
              />
              <br />
              <Editable
                ariaLabel={`Rally point ${rp.key} street`}
                value={rp.street}
                commitKey={`rally.${i}.street`}
                onCommit={(v) => update((d) => void (d.rallyPoints[i]!.street = v))}
              />
              {', '}
              <Editable
                ariaLabel={`Rally point ${rp.key} city`}
                value={rp.city}
                commitKey={`rally.${i}.city`}
                onCommit={(v) => update((d) => void (d.rallyPoints[i]!.city = v))}
              />
            </div>
          </div>
        ))}
      </div>
      <Editable
        as="div"
        multiline
        ariaLabel="Rally point guidance"
        value={doc.rallyGuidance}
        commitKey="rallyGuidance"
        onCommit={(v) => update((d) => void (d.rallyGuidance = v))}
        style={{ fontSize: 12, lineHeight: 1.4, marginTop: 6, color: color.softInk }}
      />

      <div style={{ ...sectionHeading, marginTop: 9 }}>Meshtastic</div>
      <div style={{ display: 'flex', gap: 13, marginTop: 7, alignItems: 'flex-start' }}>
        <MeshQr doc={doc} size={112} style={{ border: `1px solid ${color.ink}`, flex: 'none' }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.45, minWidth: 0 }}>
          {doc.mesh.channels.length === 0 ? (
            <div style={{ color: color.mutedInk }}>
              No channels yet — paste your provisioning URL in the Meshtastic panel.
            </div>
          ) : (
            doc.mesh.channels.map((ch, i) => (
              <div key={i} style={{ marginTop: i === 0 ? 0 : 5 }}>
                <span style={mono({ fontWeight: 700 })}>{ch.name}</span>
                <br />
                <Editable
                  ariaLabel={`${ch.name} role`}
                  value={ch.role}
                  commitKey={`mesh.${i}.role`}
                  onCommit={(v) => update((d) => void (d.mesh.channels[i]!.role = v))}
                />
              </div>
            ))
          )}
        </div>
      </div>
      <Block
        label="Meshtastic warning"
        pinned
        style={{
          marginTop: 'auto',
          paddingTop: 7,
          fontSize: 12,
          fontWeight: 700,
          color: color.red,
          lineHeight: 1.35,
          visibility: showMeshWarning ? 'visible' : 'hidden',
        }}
      >
        <Editable
          multiline
          ariaLabel="Meshtastic encryption warning"
          value={doc.mesh.warning}
          commitKey="mesh.warning"
          onCommit={(v) => update((d) => void (d.mesh.warning = v))}
        />
      </Block>
    </Block>
  )
}
