/**
 * Design tokens, transcribed from the handoff. The reference files are inline
 * styles end to end — those values are the spec, and these are them.
 */

export const color = {
  ink: '#16191d',
  mutedInk: '#4a5058',
  softInk: '#3a4048',
  green: '#15803d',
  blue: '#1d4ed8',
  amber: '#b45309',
  red: '#b91c1c',
  yellowDark: '#a16207',
  warmFill: '#f3f0ea',
  warmFillAlt: '#f7f4ee',
  redFill: '#fbf2f2',
  hairline: '#ecebe7',
  hairlineWarm: '#d8d5cf',
  hairlineCool: '#c9c5bd',
  foldRule: '#9aa1aa',
  black: '#000',
  white: '#fff',

  // Plan template only — the long-form guide has a few rules and an inverted
  // block the cards do not.
  planRowRule: '#ddd9d2',
  planTableRule: '#e4e0d9',
  planEyebrow: '#6b7280',
  planInvertedText: '#e8e6e1',
  planInvertedMuted: '#c8ccd2',
  planSpeakerA: '#7dd3a0',
  planSpeakerB: '#93b8ff',
} as const

/**
 * Metric-stable fallbacks, kept exactly as the references have them. Arial is
 * far closer to Archivo's metrics than system-ui, which matters because the
 * overflow check is run a second time against this stack.
 */
export const font = {
  display: "'Archivo','Helvetica Neue',Arial,sans-serif",
  mono: "'JetBrains Mono','Courier New',monospace",
  displayFallback: "'Helvetica Neue',Arial,sans-serif",
  monoFallback: "'Courier New',monospace",
} as const

/** Physical page boxes. */
export const page = {
  letter: { width: '8.5in', height: '11in' },
  label: { width: '62mm', height: '100mm' },
} as const

/** 62 x 100 mm label geometry, in the units the Brother QL-500 cares about. */
export const LABEL_MM = { width: 62, height: 100 } as const

export const PT_PER_MM = 72 / 25.4
export const PX_PER_MM = 96 / 25.4
