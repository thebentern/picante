import { DOC_VERSION, docSchema, type Doc } from './schema'
import { createDefaultDoc } from './defaults'
import { gmrsByPreset } from './bandPlans'

export class DocLoadError extends Error {}

/**
 * Bring a JSON document up to DOC_VERSION and validate it.
 *
 * Documents are exchanged as files between teams, so a file written by an older
 * build must always still open. Each step upgrades one version; unknown extra
 * keys are dropped by the schema rather than carried forward.
 */
type Step = (input: Record<string, unknown>) => Record<string, unknown>

/** Tier prose for a v1 document, which had none of its own. */
const DEFAULT_DETAIL = createDefaultDoc().pace.map((t) => t.detail)

const STEPS: Record<number, Step> = {
  /**
   * 1 -> 2. Two shapes stopped assuming things that are not the app's to
   * assume:
   *
   *  - Channels were preset numbers into a hard-coded FRS/GMRS table, which
   *    only works for a unit on GMRS. They are now an ordered list of free-text
   *    label/frequency rows. Old presets are resolved through the same table so
   *    an existing document keeps the channels it had.
   *  - The bottom block was a fixed OPSEC notice. It is now a free remarks
   *    block with its own heading, so a unit can pin whatever it needs there.
   */
  1: (d) => {
    const channels = (d.channels ?? {}) as Record<string, unknown>
    const presets = Array.isArray(channels.rollover) ? (channels.rollover as number[]) : []
    const opsec = (d.opsec ?? {}) as Record<string, string>

    const sequence = presets.map((preset, i) => {
      const known = gmrsByPreset(preset)
      return {
        id: `ch-${i + 1}`,
        label: known?.name ?? `Channel ${preset}`,
        short: String(preset),
        freq: known?.freq ?? '',
      }
    })

    const repeaters = (Array.isArray(channels.repeaters) ? channels.repeaters : []).map(
      (r, i) => {
        const row = r as Record<string, string>
        return {
          id: `rp-${i + 1}`,
          preset: row.preset ?? '',
          // v1's table was 2 m only; say so rather than guessing something else.
          band: row.band ?? '2 m',
          call: row.call ?? '',
          freq: row.freq ?? '',
          tone: row.tone ?? '',
        }
      },
    )

    const block = (body: string | undefined, heading: string) => ({
      heading,
      tone: 'warning' as const,
      body: body ?? '',
    })

    // Section 2's long-form prose moved out of the template and into the
    // document in the same change, because it named specific radio services.
    const pace = Array.isArray(d.pace) ? (d.pace as Record<string, unknown>[]) : []
    const withDetail = pace.map((tier, i) => ({
      ...tier,
      detail: typeof tier.detail === 'string' ? tier.detail : (DEFAULT_DETAIL[i] ?? ''),
    }))

    const { rollover: _dropped, ...restChannels } = channels
    void _dropped
    const { opsec: _oldOpsec, ...rest } = d
    void _oldOpsec

    return {
      ...rest,
      version: 2,
      pace: withDetail.length === 4 ? withDetail : rest.pace,
      channels: { ...restChannels, sequence, repeaters },
      remarks: {
        card: block(opsec.card, 'OPSEC'),
        label: block(opsec.label, 'OPSEC'),
        plan: block(opsec.plan, 'Operational security'),
      },
    }
  },
}

export function migrate(input: unknown): Doc {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new DocLoadError('That file does not contain a PACE document.')
  }

  let doc = input as Record<string, unknown>
  let version = typeof doc.version === 'number' ? doc.version : 0

  if (version > DOC_VERSION) {
    throw new DocLoadError(
      `That document was written by a newer version of this app (document v${version}, ` +
        `this build reads up to v${DOC_VERSION}). Update the app and try again.`,
    )
  }

  while (version < DOC_VERSION) {
    const step = STEPS[version]
    if (!step) throw new DocLoadError(`No upgrade path from document version ${version}.`)
    doc = step(doc)
    version = typeof doc.version === 'number' ? doc.version : version + 1
  }

  // Fill anything the file legitimately omitted (a field added since it was
  // written) from the defaults, then validate the merged result.
  const merged = { ...(createDefaultDoc() as unknown as Record<string, unknown>), ...doc }
  const parsed = docSchema.safeParse(merged)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new DocLoadError(
      `That document is not valid: ${first?.path.join('.') || 'document'} — ${first?.message}`,
    )
  }
  return parsed.data
}
