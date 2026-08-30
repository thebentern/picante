import { create, toBinary } from '@bufbuild/protobuf'
import { AppOnly, Channel, Config } from '@meshtastic/protobufs'

/**
 * Build a Meshtastic provisioning URL the way the app does, for tests.
 *
 * Every channel set produced here is synthetic — the names are `Example*` and
 * the keys are constant fill bytes. Nothing real is committed to this
 * repository, and scripts/check-clean.mjs enforces that.
 */
export function syntheticChannelSetUrl(
  channels: { name: string; psk: Uint8Array }[],
  lora?: Partial<{
    region: number
    usePreset: boolean
    modemPreset: number
    hopLimit: number
    txPower: number
  }>,
): string {
  const set = create(AppOnly.ChannelSetSchema, {
    settings: channels.map((c) =>
      create(Channel.ChannelSettingsSchema, { name: c.name, psk: c.psk }),
    ),
    loraConfig: lora ? create(Config.Config_LoRaConfigSchema, lora) : undefined,
  })
  const bytes = toBinary(AppOnly.ChannelSetSchema, set)
  const b64 = Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `https://meshtastic.org/e/#${b64}`
}

/** N channels with distinct 256-bit keys, for exercising QR density. */
export const syntheticSet = (count: number) =>
  syntheticChannelSetUrl(
    Array.from({ length: count }, (_, i) => ({
      name: `Example${i}`,
      psk: new Uint8Array(32).fill(i + 1),
    })),
  )

export const PRIVATE_KEY = new Uint8Array(32).fill(7)
export const DEFAULT_KEY = new Uint8Array([1])
