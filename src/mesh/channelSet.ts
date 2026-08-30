import type { Config } from '@meshtastic/protobufs'
import type { MeshChannel } from '../doc/schema'

/**
 * Decode a Meshtastic provisioning URL into the channel list the cards print.
 *
 * This is the point of the paste path: the printed channel roles are read out of
 * the same code the radios are provisioned from, so they cannot drift. A typed
 * list can, and the app flags it when it is.
 *
 * URL shape: https://meshtastic.org/e/#<base64url of a ChannelSet protobuf>,
 * sometimes with a `?add=true` query appended after the fragment.
 */

export interface DecodedChannelSet {
  channels: MeshChannel[]
  radioConfig: { label: string; value: string }[]
}

export class MeshUrlError extends Error {}

/**
 * The well-known default PSK. A `psk` of one byte is shorthand: 0 means no
 * crypto, 1 means this key exactly, and 2..10 mean this key with 1..9 added to
 * the last byte. Every one of those is public knowledge — which is precisely
 * why the cards have to say so.
 */
function classifyPsk(psk: Uint8Array): MeshChannel['keyKind'] {
  if (psk.length === 0) return 'public'
  if (psk.length === 1) return psk[0] === 0 ? 'public' : 'default'
  if (psk.length === 16 || psk.length === 32) return 'private'
  return 'unknown'
}

export function extractPayload(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) throw new MeshUrlError('Paste a meshtastic.org/e/# URL.')

  const hash = trimmed.indexOf('#')
  if (hash === -1) {
    throw new MeshUrlError(
      'That does not look like a provisioning URL. It should contain a "#" followed by the ' +
        'channel data — for example https://meshtastic.org/e/#CgMSAQ...',
    )
  }
  // Strip a trailing ?add=true and any other query the app appends.
  return trimmed.slice(hash + 1).split('?')[0]!.trim()
}

function base64UrlToBytes(payload: string): Uint8Array {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new MeshUrlError('The channel data in that URL is not valid base64.')
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Roles are the user's to write; these are only the initial suggestions. */
function suggestRole(name: string, kind: MeshChannel['keyKind'], index: number): string {
  if (/alert/i.test(name)) return 'Urgent broadcast only'
  if (kind === 'private') return index === 0 ? 'Unit traffic (private)' : 'Private channel'
  return 'Readable by anyone in range'
}

/**
 * The protobuf runtime and the generated schemas are a sizeable dependency that
 * only matters once someone pastes a URL, so they load on demand.
 */
export async function decodeChannelSet(url: string): Promise<DecodedChannelSet> {
  const bytes = base64UrlToBytes(extractPayload(url))
  const [{ fromBinary }, { AppOnly, Config }] = await Promise.all([
    import('@bufbuild/protobuf'),
    import('@meshtastic/protobufs'),
  ])

  let set: ReturnType<typeof fromBinary<typeof AppOnly.ChannelSetSchema>>
  try {
    set = fromBinary(AppOnly.ChannelSetSchema, bytes)
  } catch {
    throw new MeshUrlError(
      'That URL did not decode as a Meshtastic channel set. Copy it again from the app’s ' +
        'Channels → Share screen.',
    )
  }

  if (set.settings.length === 0) {
    throw new MeshUrlError('That URL decoded, but it contains no channels.')
  }

  const channels: MeshChannel[] = set.settings.map((s, i) => {
    const kind = classifyPsk(s.psk)
    // An empty name is the special "Default" channel; the app shows it under the
    // modem preset's name, which for the stock config is LongFast.
    const name = s.name || (i === 0 ? presetName(Config, set.loraConfig?.modemPreset) : `Channel ${i}`)
    return { name, keyKind: kind, role: suggestRole(name, kind, i) }
  })

  return { channels, radioConfig: radioConfigRows(Config, set.loraConfig) }
}

type ConfigModule = typeof import('@meshtastic/protobufs')['Config']

function presetName(Config: ConfigModule, preset: number | undefined): string {
  if (preset == null) return 'LongFast'
  const raw = Config.Config_LoRaConfig_ModemPreset[preset]
  if (!raw) return 'LongFast'
  // LONG_FAST -> LongFast
  return raw
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join('')
}

function radioConfigRows(Config: ConfigModule, lora: Config.Config_LoRaConfig | undefined) {
  if (!lora) return []
  const rows: { label: string; value: string }[] = []
  const region = Config.Config_LoRaConfig_RegionCode[lora.region]
  if (region && region !== 'UNSET') rows.push({ label: 'Region', value: region })
  if (lora.usePreset) {
    rows.push({ label: 'Preset', value: presetName(Config, lora.modemPreset) })
  } else {
    if (lora.bandwidth) rows.push({ label: 'Bandwidth', value: `${lora.bandwidth} kHz` })
    if (lora.spreadFactor) rows.push({ label: 'Spreading factor', value: String(lora.spreadFactor) })
    if (lora.codingRate) rows.push({ label: 'Coding rate', value: `4/${lora.codingRate}` })
  }
  if (lora.channelNum) rows.push({ label: 'LoRa channel', value: String(lora.channelNum) })
  if (lora.hopLimit) rows.push({ label: 'Hop limit', value: String(lora.hopLimit) })
  if (lora.txPower) rows.push({ label: 'TX power', value: `${lora.txPower} dBm` })
  return rows
}
