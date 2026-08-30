import type { Doc } from './schema'

/**
 * Content problems worth surfacing in the app rather than burying in a footnote.
 *
 * All of these are derived from the document rather than hard-coded, so they
 * keep working whatever a unit puts in. The 467 MHz check reads the frequency
 * itself instead of a channel number, which means it fires for any radio
 * service that uses those pairs, not just the one the app used to assume.
 */

/** 467.5500–467.7250 MHz: the FRS/GMRS repeater inputs. */
function isRepeaterInput(freq: string): boolean {
  const mhz = Number.parseFloat(freq)
  return Number.isFinite(mhz) && mhz >= 467.55 && mhz <= 467.7375
}
export interface Advisory {
  id: string
  severity: 'warn' | 'info'
  title: string
  detail: string
}

export function advisories(doc: Doc): Advisory[] {
  const out: Advisory[] = []

  const inputs = doc.channels.sequence.filter((c) => isRepeaterInput(c.freq))
  if (inputs.length > 0) {
    out.push({
      id: 'rollover-repeater-inputs',
      severity: 'warn',
      title: `Sequence uses 467 MHz repeater inputs (${inputs.map((c) => c.label).join(', ')})`,
      detail:
        'The 467.55–467.7375 MHz pairs are FRS/GMRS repeater inputs. Simplex on them is low power ' +
        'and short range on most handhelds. Range-test this sequence at the distances your unit ' +
        'actually works at before relying on it.',
    })
  }

  const blank = doc.channels.sequence.filter((c) => !c.freq.trim() || !c.label.trim())
  if (blank.length > 0) {
    out.push({
      id: 'channel-incomplete',
      severity: 'warn',
      title: `${blank.length} channel${blank.length === 1 ? '' : 's'} missing a name or frequency`,
      detail: 'A channel with no frequency cannot be programmed into a radio.',
    })
  }

  const approx = doc.rallyPoints.filter((r) => r.coords && r.coordsApproximate)
  if (approx.length > 0) {
    out.push({
      id: 'rally-approx-coords',
      severity: 'info',
      title: `Approximate coordinates: ${approx.map((r) => r.name).join(', ')}`,
      detail:
        'These coordinates were entered by hand rather than resolved from the address. Confirm ' +
        'them against a map before printing — a rally point that is a block off is a rally point ' +
        'people cannot find in the dark.',
    })
  }

  const unresolved = doc.rallyPoints.filter((r) => !r.coords)
  if (unresolved.length > 0 && doc.rallyPoints.some((r) => r.showMap)) {
    out.push({
      id: 'rally-no-coords',
      severity: 'info',
      title: `No coordinates: ${unresolved.map((r) => r.name).join(', ')}`,
      detail: 'Maps are requested for this plan, but these points have no coordinates to plot.',
    })
  }

  if (doc.mesh.channels.length > 0 && !doc.mesh.channelsVerified) {
    out.push({
      id: 'mesh-unverified',
      severity: 'warn',
      title: 'Meshtastic channel list is unverified',
      detail:
        'These channel names were typed by hand, so the printed roles can drift from what the QR ' +
        'code actually provisions. Paste your meshtastic.org/e/# URL instead and the list is read ' +
        'straight out of the code.',
    })
  }

  const readable = doc.mesh.channels.filter(
    (c) => c.keyKind === 'default' || c.keyKind === 'public',
  )
  if (readable.length > 0) {
    out.push({
      id: 'mesh-readable',
      severity: 'info',
      title: `Readable by anyone in range: ${readable.map((c) => c.name).join(', ')}`,
      detail:
        'These channels use the default or public key. Anything sent on them can be read by any ' +
        'Meshtastic node in range. The cards carry this warning; make sure the unit has read it.',
    })
  }

  const missingRally = doc.rallyPoints.filter((r) => /^\[.*\]$/.test(r.venue.trim()))
  if (missingRally.length > 0) {
    out.push({
      id: 'rally-placeholder',
      severity: 'warn',
      title: `Rally points still hold placeholder text: ${missingRally.map((r) => r.name).join(', ')}`,
      detail: 'Fill in the venue, street and city before printing.',
    })
  }

  return out
}
