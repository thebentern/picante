import { describe, expect, it } from 'vitest'
import { createDefaultDoc, formatRevision, formatRevisionShort } from '../../src/doc/defaults'
import { docSchema, DOC_VERSION } from '../../src/doc/schema'
import { DocLoadError, migrate } from '../../src/doc/migrate'
import { BAND_PLANS, FRS_GMRS, MURS, gmrsByPreset } from '../../src/doc/bandPlans'
import { advisories } from '../../src/doc/advisories'
import { splitTokens } from '../../src/doc/interpolate'

describe('default document', () => {
  it('validates against the schema', () => {
    expect(docSchema.safeParse(createDefaultDoc()).success).toBe(true)
  })

  it('stamps the revision from a given date', () => {
    const d = new Date(2026, 7, 30)
    expect(formatRevision(d)).toBe('08/30/2026')
    expect(formatRevisionShort(d)).toBe('08/30/26')
    expect(createDefaultDoc(d).meta.revision).toBe('Rev. 08/30/2026')
  })

  it('ships nothing operationally sensitive', () => {
    // This repository is public. Rally points, the Meshtastic channel set and
    // the regional repeater list are all things a user fills in; none of them
    // ship. scripts/check-clean.mjs enforces the same rule over the whole tree.
    const doc = createDefaultDoc()
    for (const rp of doc.rallyPoints) {
      expect(rp.coords).toBeNull()
      expect(rp.venue).toMatch(/^\[.*\]$/)
      expect(rp.street).toMatch(/^\[.*\]$/)
    }
    expect(doc.mesh.url).toBe('')
    expect(doc.mesh.qrImage).toBeNull()
    expect(doc.mesh.channels).toEqual([])
    expect(doc.channels.repeaters).toEqual([])
    expect(doc.privacy).toEqual({ mapsEnabled: false, geocodeEnabled: false })
  })

  it('gives every footprint its own remarks wording', () => {
    // One shared string is what pushed the 62 mm label into overflow: it has
    // room for about a sentence less than the fold card.
    const { card, label, plan } = createDefaultDoc().remarks
    expect(label.body.length).toBeLessThan(card.body.length)
    expect(card.body.length).toBeLessThan(plan.body.length)
  })

  it('leaves the remarks heading editable rather than hard-coding OPSEC', () => {
    // The block defaults to an OPSEC notice, but it is a free block: a unit
    // should be able to pin whatever it needs to the bottom of the card.
    const doc = createDefaultDoc()
    for (const which of ['card', 'label', 'plan'] as const) {
      expect(doc.remarks[which].heading).toBeTruthy()
      expect(doc.remarks[which].tone).toBe('warning')
    }
  })

  it('keeps the plan\u2019s long-form prose in the document, not the template', () => {
    // Section 2 named specific radio services. A unit on something else would
    // have had the plan contradict its own cards.
    const doc = createDefaultDoc()
    for (const tier of doc.pace) expect(tier.detail.trim().length).toBeGreaterThan(40)
    // The A tier's prose tracks the channel list through the same token the
    // cards use.
    expect(doc.pace[1]!.detail).toContain('{rollover}')
  })

  it('models channels as free-text rows, not presets into a band plan', () => {
    // A unit might be on FRS, GMRS, MURS, business band or an amateur
    // allocation. The app has no business assuming which.
    const doc = createDefaultDoc()
    expect(doc.channels.sequence.length).toBeGreaterThan(0)
    for (const channel of doc.channels.sequence) {
      expect(typeof channel.label).toBe('string')
      expect(typeof channel.short).toBe('string')
      expect(typeof channel.freq).toBe('string')
    }
    // Arbitrary content validates: nothing constrains it to a known table.
    const custom = { ...doc }
    custom.channels = {
      ...doc.channels,
      sequence: [{ id: 'x', label: 'MURS 3', short: 'M3', freq: '151.9400' }],
    }
    expect(docSchema.safeParse(custom).success).toBe(true)
  })
})

describe('migrate', () => {
  it('round-trips a current document', () => {
    const doc = createDefaultDoc()
    expect(migrate(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
  })

  it('upgrades a v1 document: GMRS presets become free-text channel rows', () => {
    const v1 = {
      ...createDefaultDoc(),
      version: 1,
      channels: {
        rollover: [7, 12],
        weather: { label: 'NWS', freq: '162.550', note: '' },
        repeaters: [{ preset: '28', call: 'EXAMPLE', freq: '145.130' }],
        caveat: 'old caveat',
      },
      opsec: { card: 'card text', label: 'label text', plan: 'plan text' },
    } as unknown

    const upgraded = migrate(JSON.parse(JSON.stringify(v1)))

    expect(upgraded.version).toBe(DOC_VERSION)
    // The presets resolve through the same table they came from, so an existing
    // document keeps exactly the channels it had.
    expect(upgraded.channels.sequence).toEqual([
      { id: 'ch-1', label: 'GMRS 7', short: '7', freq: '462.7125' },
      { id: 'ch-2', label: 'GMRS 12', short: '12', freq: '467.6625' },
    ])
    // v1's repeater table was 2 m only; say so rather than guessing.
    expect(upgraded.channels.repeaters[0]).toMatchObject({ band: '2 m', call: 'EXAMPLE', tone: '' })
    expect(upgraded.channels.caveat).toBe('old caveat')
    // Section 2's prose moved into the document in the same change; a v1
    // document has none, so it inherits the current default.
    expect(upgraded.pace.every((t) => t.detail.length > 0)).toBe(true)
  })

  it('upgrades a v1 OPSEC notice into a remarks block that keeps its wording', () => {
    const v1 = {
      ...createDefaultDoc(),
      version: 1,
      channels: { rollover: [], weather: { label: '', freq: '', note: '' }, repeaters: [], caveat: '' },
      opsec: { card: 'card text', label: 'label text', plan: 'plan text' },
    } as unknown

    const upgraded = migrate(JSON.parse(JSON.stringify(v1)))
    expect(upgraded.remarks.card).toEqual({ heading: 'OPSEC', tone: 'warning', body: 'card text' })
    expect(upgraded.remarks.label.body).toBe('label text')
    expect(upgraded.remarks.plan).toMatchObject({ heading: 'Operational security', body: 'plan text' })
    expect('opsec' in (upgraded as Record<string, unknown>)).toBe(false)
  })

  it('fills in a field added since the file was written', () => {
    const doc = createDefaultDoc() as Record<string, unknown>
    delete doc.rallyGuidance
    expect(migrate(doc).rallyGuidance).toBe(createDefaultDoc().rallyGuidance)
  })

  it('explains itself instead of throwing something unreadable', () => {
    expect(() => migrate(null)).toThrow(DocLoadError)
    expect(() => migrate([1, 2, 3])).toThrow(/not contain a PACE document/)
    expect(() => migrate({ version: DOC_VERSION + 1 })).toThrow(/newer version of this app/)
    expect(() => migrate({ ...createDefaultDoc(), meta: 'nope' })).toThrow(/not valid/)
  })
})

describe('band plan library', () => {
  it('matches the FCC FRS/GMRS allocation', () => {
    expect(FRS_GMRS.channels).toHaveLength(22)
    expect(gmrsByPreset(7)?.freq).toBe('462.7125')
    expect(gmrsByPreset(12)?.freq).toBe('467.6625')
    expect(gmrsByPreset(17)?.freq).toBe('462.6000')
    expect(gmrsByPreset(22)?.freq).toBe('462.7250')
  })

  it('matches the FCC MURS allocation', () => {
    expect(MURS.channels.map((c) => c.freq)).toEqual([
      '151.8200',
      '151.8800',
      '151.9400',
      '154.5700',
      '154.6000',
    ])
    // The two upper channels allow wider bandwidth; that is worth knowing
    // before programming a radio, so the insert menu says so.
    expect(MURS.channels.filter((c) => c.note === 'wideband').map((c) => c.preset)).toEqual([4, 5])
  })

  it('notes exactly the 467 MHz repeater inputs', () => {
    const flagged = FRS_GMRS.channels.filter((c) => c.note === '467 MHz repeater input')
    expect(flagged.map((c) => c.preset)).toEqual([8, 9, 10, 11, 12, 13, 14])
    for (const c of FRS_GMRS.channels) {
      expect(c.note === '467 MHz repeater input').toBe(c.freq.startsWith('467'))
    }
  })

  it('is a library the editor offers, not a constraint on the document', () => {
    // Every plan is addressable by id so the insert menu can group by service,
    // and adding one is additive.
    expect(BAND_PLANS.map((p) => p.id)).toEqual(['frs-gmrs', 'murs'])
    for (const plan of BAND_PLANS) {
      expect(plan.source).toMatch(/47 CFR/)
      expect(plan.channels.length).toBeGreaterThan(0)
    }
  })
})

describe('advisories', () => {
  it('warns about a sequence that sits on the 467 MHz repeater inputs', () => {
    // Read off the frequency, not a channel number, so it fires for any radio
    // service that uses those pairs rather than only the one the app used to
    // assume.
    const doc = createDefaultDoc()
    const found = advisories(doc).find((a) => a.id === 'rollover-repeater-inputs')
    expect(found?.severity).toBe('warn')
    expect(found?.title).toContain('GMRS 12')
  })

  it('says nothing about a sequence that avoids them', () => {
    const doc = createDefaultDoc()
    doc.channels.sequence = [
      { id: 'a', label: 'Ch 1', short: '1', freq: '462.7125' },
      { id: 'b', label: 'Ch 2', short: '2', freq: '151.9400' },
    ]
    expect(advisories(doc).map((a) => a.id)).not.toContain('rollover-repeater-inputs')
  })

  it('flags a channel that cannot be programmed into a radio', () => {
    const doc = createDefaultDoc()
    doc.channels.sequence = [{ id: 'a', label: 'Ch 1', short: '1', freq: '' }]
    expect(advisories(doc).map((a) => a.id)).toContain('channel-incomplete')
  })

  it('surfaces hand-entered coordinates as approximate', () => {
    const doc = createDefaultDoc()
    doc.rallyPoints[0]!.coords = { lat: 34, lon: -92 }
    doc.rallyPoints[0]!.coordsApproximate = true
    expect(advisories(doc).map((a) => a.id)).toContain('rally-approx-coords')
  })

  it('flags a typed Meshtastic channel list as able to drift', () => {
    const doc = createDefaultDoc()
    doc.mesh.channels = [{ name: 'Ops', keyKind: 'private', role: 'Unit traffic' }]
    doc.mesh.channelsVerified = false
    expect(advisories(doc).map((a) => a.id)).toContain('mesh-unverified')

    doc.mesh.channelsVerified = true
    expect(advisories(doc).map((a) => a.id)).not.toContain('mesh-unverified')
  })

  it('flags channels anyone in range can read', () => {
    const doc = createDefaultDoc()
    doc.mesh.channelsVerified = true
    doc.mesh.channels = [
      { name: 'Ops', keyKind: 'private', role: 'Unit traffic' },
      { name: 'LongFast', keyKind: 'public', role: 'Public default' },
    ]
    const found = advisories(doc).find((a) => a.id === 'mesh-readable')
    expect(found?.title).toContain('LongFast')
    expect(found?.title).not.toContain('Ops')
  })
})

describe('token interpolation', () => {
  it('splits body copy around its tokens', () => {
    expect(splitTokens('rolls {rollover}.')).toEqual([
      { kind: 'text', value: 'rolls ' },
      { kind: 'token', name: 'rollover' },
      { kind: 'text', value: '.' },
    ])
  })

  it('keeps an unknown token intact rather than swallowing it', () => {
    // A template renders an unrecognised token literally, so a typo is visible
    // on the card rather than silently deleting the text around it.
    expect(splitTokens('a {nope} b')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'token', name: 'nope' },
      { kind: 'text', value: ' b' },
    ])
  })
})
