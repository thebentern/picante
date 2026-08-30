import type { Doc } from '../doc/schema'
import type { TokenRender } from '../editing/Editable'
import { font } from './tokens'

/**
 * Values derived from the document that more than one template needs. Keeping
 * them here is what stops the fold card, the label and the plan from disagreeing
 * about the rollover sequence or the report formats.
 */

export const rolloverText = (doc: Doc) =>
  doc.channels.sequence.map((c) => c.short || c.label).join(' → ')

/**
 * The rollover sequence as inline runs. Arrows sit in their own inline-block
 * run with a small vertical-align, matching the reference: JetBrains Mono's
 * arrow glyph rides low against the digits otherwise.
 */
export function rolloverToken(doc: Doc, weight = 600, spaced = true): TokenRender {
  // The spaces stay OUTSIDE the inline-block runs: whitespace at the edge of an
  // inline-block is trimmed, which is why the reference wraps only the arrow
  // glyph and leaves the spaces as plain text either side of it.
  const runs = doc.channels.sequence.flatMap((channel, i) =>
    i === 0
      ? [{ text: channel.short || channel.label }]
      : [
          ...(spaced ? [{ text: ' ' }] : []),
          { text: '→', style: { display: 'inline-block', verticalAlign: '0.1em' } as const },
          ...(spaced ? [{ text: ' ' }] : []),
          { text: channel.short || channel.label },
        ],
  )
  return {
    name: 'rollover',
    runs,
    style: { fontFamily: font.mono, fontWeight: weight },
  }
}

export function monoToken(name: string, text: string, weight = 600): TokenRender {
  return { name, runs: [{ text }], style: { fontFamily: font.mono, fontWeight: weight } }
}

/** `spaced: false` is the label's tight form — the spaced one costs a line there. */
export function standardTokens(doc: Doc, weight = 600, spaced = true): TokenRender[] {
  return [
    rolloverToken(doc, weight, spaced),
    monoToken('routine', doc.formats.routine, weight),
    monoToken('emergency', doc.formats.emergency, weight),
  ]
}

/** True when any Meshtastic channel is readable by anyone in range. */
export const hasReadableMeshChannel = (doc: Doc) =>
  doc.mesh.channels.some((c) => c.keyKind === 'default' || c.keyKind === 'public')

export const meshChannelKeyLabel = (kind: Doc['mesh']['channels'][number]['keyKind']) =>
  kind === 'private'
    ? 'Private, 256-bit'
    : kind === 'default'
      ? 'Default key'
      : kind === 'public'
        ? 'Public default'
        : 'Unknown key'
