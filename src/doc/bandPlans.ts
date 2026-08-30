/**
 * Bundled band plans, as a convenience library — not the document's shape.
 *
 * Channels in a document are free-text rows, because a unit might be on FRS,
 * GMRS, MURS, business band, an amateur allocation, or a mix. These tables
 * exist so the common cases do not involve typing "462.7125" by hand, which is
 * how a card ends up with a wrong digit on it. The editor inserts rows from
 * them; nothing constrains a channel to one.
 *
 * Adding a service here is additive: a name, a channel list, and it appears in
 * the editor's insert menu.
 */
export interface BandPlanChannel {
  preset: number
  name: string
  freq: string
  /** Shown in the insert menu when a channel has a caveat worth knowing. */
  note?: string
}

export interface BandPlan {
  id: string
  name: string
  /** Cited so anyone can check the numbers against the source. */
  source: string
  channels: readonly BandPlanChannel[]
}

/**
 * FRS/GMRS, 47 CFR §95.563 / §95.1763. Presets are the conventional 1–22
 * ordering consumer handhelds ship with.
 */
const FRS_GMRS_FREQS: [number, string][] = [
  [1, '462.5625'], [2, '462.5875'], [3, '462.6125'], [4, '462.6375'],
  [5, '462.6625'], [6, '462.6875'], [7, '462.7125'], [8, '467.5625'],
  [9, '467.5875'], [10, '467.6125'], [11, '467.6375'], [12, '467.6625'],
  [13, '467.6875'], [14, '467.7125'], [15, '462.5500'], [16, '462.5750'],
  [17, '462.6000'], [18, '462.6250'], [19, '462.6500'], [20, '462.6750'],
  [21, '462.7000'], [22, '462.7250'],
]

export const FRS_GMRS: BandPlan = {
  id: 'frs-gmrs',
  name: 'FRS / GMRS',
  source: '47 CFR §95.563, §95.1763',
  channels: FRS_GMRS_FREQS.map(([preset, freq]) => ({
    preset,
    name: `GMRS ${preset}`,
    freq,
    // Presets 8–14 are the 467 MHz repeater inputs: low power and short range
    // simplex on most handhelds.
    note: freq.startsWith('467') ? '467 MHz repeater input' : undefined,
  })),
}

/**
 * MURS, 47 CFR §95.2763. Five channels, licence-free, and unlike FRS/GMRS the
 * two upper ones allow wider bandwidth — worth knowing before programming.
 */
export const MURS: BandPlan = {
  id: 'murs',
  name: 'MURS',
  source: '47 CFR §95.2763',
  channels: [
    { preset: 1, name: 'MURS 1', freq: '151.8200', note: 'narrowband' },
    { preset: 2, name: 'MURS 2', freq: '151.8800', note: 'narrowband' },
    { preset: 3, name: 'MURS 3', freq: '151.9400', note: 'narrowband' },
    { preset: 4, name: 'MURS 4', freq: '154.5700', note: 'wideband' },
    { preset: 5, name: 'MURS 5', freq: '154.6000', note: 'wideband' },
  ],
}

export const BAND_PLANS: readonly BandPlan[] = [FRS_GMRS, MURS]

/** Resolve an FRS/GMRS preset. Used by the v1 document migration. */
export const gmrsByPreset = (preset: number): BandPlanChannel | undefined =>
  FRS_GMRS.channels.find((c) => c.preset === preset)
