import { describe, expect, it } from 'vitest'
import { decodeChannelSet, extractPayload, MeshUrlError } from '../../src/mesh/channelSet'
import { DEFAULT_KEY, PRIVATE_KEY, syntheticChannelSetUrl as buildUrl } from '../support/mesh'
import { scanRisk } from '../../src/mesh/qr'

/**
 * Decoding the provisioning URL is what stops the printed channel roles from
 * drifting away from what the radios are actually provisioned with — the point
 * of the feature, per the handoff. These build a real ChannelSet, encode it the
 * way the Meshtastic app does, and check what comes back.
 *
 * Nothing here is a real channel set; every key and name is synthetic.
 */

describe('provisioning URL', () => {
  it('pulls the payload out of the URL forms the app produces', () => {
    expect(extractPayload('https://meshtastic.org/e/#ABC')).toBe('ABC')
    expect(extractPayload('https://meshtastic.org/e/#ABC?add=true')).toBe('ABC')
    expect(extractPayload('  https://meshtastic.org/e/#ABC  ')).toBe('ABC')
  })

  it('says what is wrong rather than failing silently', async () => {
    expect(() => extractPayload('')).toThrow(MeshUrlError)
    expect(() => extractPayload('https://meshtastic.org/e/')).toThrow(/should contain a "#"/)
    await expect(decodeChannelSet('https://meshtastic.org/e/#!!!!')).rejects.toThrow(MeshUrlError)
  })

  it('reads channel names straight out of the code', async () => {
    const url = buildUrl([
      { name: 'UnitOps', psk: PRIVATE_KEY },
      { name: 'Alerts', psk: DEFAULT_KEY },
    ])
    const { channels } = await decodeChannelSet(url)
    expect(channels.map((c) => c.name)).toEqual(['UnitOps', 'Alerts'])
  })

  it('tells a 256-bit key from one anyone in range can read', async () => {
    // This drives the red warning on the cards, so getting it wrong is not a
    // cosmetic bug.
    const { channels } = await decodeChannelSet(
      buildUrl([
        { name: 'UnitOps', psk: PRIVATE_KEY },
        { name: 'Alerts', psk: DEFAULT_KEY },
        { name: 'Open', psk: new Uint8Array(0) },
        { name: 'Aes128', psk: new Uint8Array(16).fill(3) },
      ]),
    )
    expect(channels.map((c) => c.keyKind)).toEqual(['private', 'default', 'public', 'private'])
  })

  it('names the unnamed primary channel after the modem preset', async () => {
    // An empty name is the special "Default" channel; the app shows it under
    // the preset's name, which for a stock config is LongFast.
    const { channels } = await decodeChannelSet(
      buildUrl([{ name: '', psk: DEFAULT_KEY }], { usePreset: true, modemPreset: 0 }),
    )
    expect(channels[0]!.name).toBe('LongFast')
  })

  it('reads the radio config the plan prints', async () => {
    const { radioConfig } = await decodeChannelSet(
      buildUrl([{ name: 'UnitOps', psk: PRIVATE_KEY }], {
        region: 1,
        usePreset: true,
        modemPreset: 0,
        hopLimit: 7,
      }),
    )
    expect(radioConfig).toEqual(
      expect.arrayContaining([
        { label: 'Region', value: 'US' },
        { label: 'Preset', value: 'LongFast' },
        { label: 'Hop limit', value: '7' },
      ]),
    )
  })

  it('refuses a URL that decodes to nothing', async () => {
    await expect(decodeChannelSet(buildUrl([]))).rejects.toThrow(/contains no channels/)
  })
})

describe('QR scan risk at label size', () => {
  it('accepts a small symbol at 16 mm and rejects a dense one', () => {
    // A 300 dpi thermal head smears adjacent modules below ~2.5 dots each, so a
    // code that is fine at 112 px on the fold card can be unscannable on the
    // label. Warning about it beats printing a roll of labels to find out.
    expect(scanRisk(33, 16, 300).ok).toBe(true)
    expect(scanRisk(101, 16, 300).ok).toBe(false)
    expect(scanRisk(101, 112 / (96 / 25.4), 300).ok).toBe(true)
  })
})
