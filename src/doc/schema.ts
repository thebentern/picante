import { z } from 'zod'

/**
 * The document object. Every template renders from this one shape, which is what
 * keeps the fold card, the label, and the full plan from drifting apart — the
 * drift that made the design phase slow.
 *
 * Bump DOC_VERSION whenever a change is not backward-readable, and add a step to
 * doc/migrate.ts. Documents are exchanged as JSON files between teams, so an old
 * file must always still open.
 */
export const DOC_VERSION = 2

/** PACE tier colors are a fixed set, not a free picker. */
export const TIER_COLORS = ['#15803d', '#1d4ed8', '#b45309', '#b91c1c'] as const
export const STATUS_COLORS = ['#15803d', '#a16207', '#b91c1c'] as const

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a #rrggbb color')

/** 6.5pt is the floor: below it, 300 dpi thermal output stops being readable. */
export const LABEL_MIN_PT = 6.5

const paceTier = z.object({
  letter: z.string().min(1).max(1),
  /** Fold card + plan wording. */
  label: z.string(),
  body: z.string(),
  /** Label wording — the 62 x 100 mm footprint has one line per tier. */
  shortLabel: z.string(),
  shortBody: z.string(),
  /**
   * Long-form explanation for the plan's section 2. Blank lines separate
   * paragraphs. It lives in the document rather than the template because it
   * names the actual method a unit uses, which is not the app's to decide.
   */
  detail: z.string(),
  color: hex,
})

const checkInLevel = z.object({
  name: z.string(),
  interval: z.string(),
  /** Plan-only third column. */
  condition: z.string(),
  color: hex,
})

/**
 * One working channel. Label and frequency are free text on purpose: a unit
 * might be on GMRS, FRS, MURS, business band or an amateur allocation, and the
 * app has no business assuming which. `short` is the compact form used in the
 * rollover sequence and on the 62 mm label, where "GMRS 7" will not fit.
 */
const channel = z.object({
  id: z.string(),
  label: z.string(),
  short: z.string(),
  freq: z.string(),
})

/** A repeater, band-agnostic: 2 m, 70 cm, GMRS, or anything else. */
const repeater = z.object({
  id: z.string(),
  /** Radio memory slot, so "go to preset 28" means the same on every handheld. */
  preset: z.string(),
  band: z.string(),
  call: z.string(),
  freq: z.string(),
  /** Offset and tone: a repeater is unusable without them. */
  tone: z.string(),
})

/**
 * A free block pinned to the bottom of each footprint. The default content is
 * an OPSEC notice because that is what these cards usually carry, but the
 * heading is the user's — this is the place to put whatever a unit needs to
 * read last and remember.
 */
const remarks = z.object({
  heading: z.string(),
  body: z.string(),
  /** 'warning' is the red-ruled treatment; 'neutral' is the same box in ink. */
  tone: z.enum(['warning', 'neutral']),
})

const rallyPoint = z.object({
  id: z.string(),
  /** Single-character pin glyph: N, C, W... */
  key: z.string().min(1).max(1),
  name: z.string(),
  venue: z.string(),
  street: z.string(),
  city: z.string(),
  /** Label footprint abbreviates hard; falls back to `city` when blank. */
  shortCity: z.string(),
  coords: z.object({ lat: z.number(), lon: z.number() }).nullable(),
  /**
   * True when the coordinate was typed rather than resolved from the address.
   * Surfaced in the editor: the reference plan had one point with no
   * OpenStreetMap entry whose coordinate was the nearest mapped point on the
   * road, and that caveat should not be silently lost.
   */
  coordsApproximate: z.boolean(),
  /** Per-point street map in the plan template. Requires coords + map opt-in. */
  showMap: z.boolean(),
})

const meshChannel = z.object({
  name: z.string(),
  /** 'private' = a 256-bit PSK; 'default' and 'public' are readable by anyone. */
  keyKind: z.enum(['private', 'default', 'public', 'unknown']),
  role: z.string(),
})

export const docSchema = z.object({
  version: z.literal(DOC_VERSION),

  meta: z.object({
    title: z.string(),
    org: z.string(),
    /** Compact org string for the 62 x 100 mm label. */
    orgShort: z.string(),
    revision: z.string(),
    revisionShort: z.string(),
    subtitle: z.string(),
    eyebrow: z.string(),
  }),

  pace: z.tuple([paceTier, paceTier, paceTier, paceTier]),

  formats: z.object({
    routine: z.string(),
    emergency: z.string(),
  }),

  checkIn: z.object({
    levels: z.array(checkInLevel).min(1),
    lifeSafety: z.string(),
    noChange: z.string(),
  }),

  /** The three escalation steps for a missed check-in window. */
  missed: z.array(z.object({ step: z.string(), text: z.string() })).min(1),

  channels: z.object({
    /**
     * The working channels, in the order the unit steps through them. This is
     * the rollover sequence, and it is a plain ordered list rather than presets
     * into a band plan the app happens to know about.
     */
    sequence: z.array(channel),
    weather: z.object({ label: z.string(), freq: z.string(), note: z.string() }),
    /** Ships empty: a regional repeater list is an area fingerprint. */
    repeaters: z.array(repeater),
    /** Free-text caveat rendered under the channel list in the plan template. */
    caveat: z.string(),
  }),

  rallyPoints: z.array(rallyPoint),
  rallyGuidance: z.string(),
  rallyOnArrival: z.array(z.string()),

  mesh: z.object({
    /** meshtastic.org/e/#... provisioning URL. Never committed; user-supplied. */
    url: z.string(),
    /** Uploaded QR image as a data URI, when the user brought their own. */
    qrImage: z.string().nullable(),
    /** True when `channels` came from decoding `url` rather than being typed. */
    channelsVerified: z.boolean(),
    channels: z.array(meshChannel),
    warning: z.string(),
    note: z.string(),
    radioConfig: z.array(z.object({ label: z.string(), value: z.string() })),
  }),

  /**
   * Three versions, because the three footprints have wildly different room.
   * Sharing one string is what pushes the label into overflow — it has about
   * 10 px of slack.
   */
  remarks: z.object({
    card: remarks,
    label: remarks,
    plan: remarks,
  }),

  /** Feature consent. Both default off: this is an OPSEC tool. */
  privacy: z.object({
    /** Allows OpenStreetMap tile requests for plan maps. */
    mapsEnabled: z.boolean(),
    /** Allows Nominatim lookups. Asked per use regardless; this remembers "yes". */
    geocodeEnabled: z.boolean(),
  }),
})

export type Doc = z.infer<typeof docSchema>
export type Channel = z.infer<typeof channel>
export type Repeater = z.infer<typeof repeater>
export type Remarks = z.infer<typeof remarks>
export type PaceTier = z.infer<typeof paceTier>
export type RallyPoint = z.infer<typeof rallyPoint>
export type MeshChannel = z.infer<typeof meshChannel>
export type CheckInLevel = z.infer<typeof checkInLevel>

export type TemplateId = 'fold' | 'label' | 'plan'

export const TEMPLATES: Record<TemplateId, { name: string; blurb: string }> = {
  fold: {
    name: 'Fold card',
    blurb: '8.5 x 11 in, single-sided. Folds in half to a double-sided 8.5 x 5.5 card.',
  },
  label: {
    name: 'Thermal label',
    blurb: '62 x 100 mm. Brother QL-500 die-cut (DK-11202), 300 dpi.',
  },
  plan: {
    name: 'Full plan',
    blurb: 'Multi-page Letter reference guide the cards condense.',
  },
}
