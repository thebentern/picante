import { DOC_VERSION, type Doc } from './schema'

/**
 * The document this app opens with.
 *
 * A neutral worked example, not anyone's real plan. The body copy is generic
 * enough to be useful as a starting point; everything that identifies a unit or
 * its operations is a placeholder the user fills in — the organization name,
 * rally point venues, streets, cities and coordinates, the Meshtastic
 * provisioning URL, QR and channel list, and the regional 2 m repeater table.
 *
 * None of that is committed to this repository and none of it leaves the user's
 * browser. scripts/check-clean.mjs fails the build if a real value reappears
 * here.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export const formatRevision = (d: Date) =>
  `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`

export const formatRevisionShort = (d: Date) =>
  `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)}`

const rallyPoint = (key: string, name: string): Doc['rallyPoints'][number] => ({
  id: `rp-${key.toLowerCase()}`,
  key,
  name,
  venue: '[Venue name]',
  street: '[Street address]',
  city: '[City]',
  shortCity: '[City]',
  coords: null,
  coordsApproximate: false,
  showMap: false,
})

export function createDefaultDoc(today = new Date()): Doc {
  return {
    version: DOC_VERSION,

    meta: {
      title: 'PACE Plan',
      org: 'Example Response Group',
      orgShort: 'ERG',
      revision: `Rev. ${formatRevision(today)}`,
      revisionShort: `REV ${formatRevisionShort(today)}`,
      subtitle: 'Severe weather & disaster response',
      eyebrow: 'Use the first method that works',
    },

    pace: [
      {
        letter: 'P',
        label: 'Primary — Cell + Signal',
        body: 'Normal coordination by Signal group message, Signal voice, or cell call.',
        shortLabel: 'CELL + SIGNAL.',
        shortBody: 'Signal group, voice, or call.',
        detail:
          'Normal coordination runs on Signal: group message, Signal voice, or a plain cell call. ' +
          'Use Signal by default; it works over any data connection and keeps traffic off SMS. ' +
          'Routine reports use the four-field format {routine}, in that order, so a reader can ' +
          'scan a long thread quickly.',
        color: '#15803d',
      },
      {
        letter: 'A',
        label: 'Alternate — GMRS',
        body:
          'Cell congested or unavailable. Start at the top of the list; the unit rolls together ' +
          '{rollover}. ' +
          'Plain language. Lead urgent traffic with Priority or Emergency.',
        shortLabel: 'GMRS.',
        shortBody: 'Start at the top, rolls {rollover}.',
        detail:
          'Go to this method when cell service is congested, intermittent, or unavailable. ' +
          'Congestion counts: if a Signal message has not delivered in a few minutes, treat cell ' +
          'as down.\n\n' +
          'Start at the top of the channel list in section 5. If that channel is blocked by ' +
          'traffic or interference, the whole unit rolls together in order: {rollover}. Announce ' +
          'the roll before you move if you can. Use plain language, not codes. Begin urgent ' +
          'traffic with the word Priority or Emergency so anyone listening yields the channel.',
        color: '#1d4ed8',
      },
      {
        letter: 'C',
        label: 'Contingency — Meshtastic',
        body:
          'Cell down and GMRS cannot reach the unit. Short text, location, and urgent needs on ' +
          'Meshtastic. Also use it whenever coordinates or routes are better sent as text.',
        shortLabel: 'MESHTASTIC.',
        shortBody: 'Text messages. Coords/routes.',
        detail:
          'Go here when cellular is down and voice cannot reliably reach the unit, whether from ' +
          'distance, terrain, or a dead handheld. Send short text updates, your location, and ' +
          'urgent needs. Mesh delivery is store-and-forward and can be slow; write messages that ' +
          'still make sense arriving ten minutes late. Provision from the QR code before ' +
          'deployment.\n\n' +
          'This is also the right choice when the information is better conveyed as text than as ' +
          'voice, even while the methods above are working. Coordinates, street addresses, route ' +
          'descriptions, lists, and node locations are read once and re-read later; spoken over a ' +
          'radio they get mis-heard and have to be repeated. Send those as text and reference ' +
          'them on the working channel.',
        color: '#b45309',
      },
      {
        letter: 'E',
        label: 'Emergency — Any means',
        body:
          'Life safety: use any working method immediately. GMRS, Meshtastic broadcast, direct ' +
          'contact, runner, or public safety.',
        shortLabel: 'ANY MEANS.',
        shortBody: 'Life safety. Radio, mesh, runner.',
        detail:
          'For life safety, the ladder stops applying. Use any working method immediately: radio, ' +
          'a mesh broadcast, direct contact, a runner, or public safety. Do not spend time ' +
          'stepping down the ladder while someone is in danger. Emergency traffic uses ' +
          '{emergency} and repeats until acknowledged.',
        color: '#b91c1c',
      },
    ],

    formats: {
      routine: 'UNIT | LOCATION | STATUS | NEED',
      emergency: 'WHO | WHAT | WHERE | NEED',
    },

    checkIn: {
      levels: [
        {
          name: 'GREEN',
          interval: 'Every 4 hours',
          condition: 'Watch posted, no impact yet',
          color: '#15803d',
        },
        {
          name: 'YELLOW',
          interval: 'Every hour',
          condition: 'Warning issued, impact expected',
          color: '#a16207',
        },
        {
          name: 'RED',
          interval: 'Every 15 minutes',
          condition: 'Storm on the ground, damage or members unaccounted for',
          color: '#b91c1c',
        },
      ],
      lifeSafety: 'Life safety overrides the clock.',
      noChange: 'NO CHANGE is still a required check-in.',
    },

    missed: [
      { step: '1', text: 'Attempt contact on the current method.' },
      { step: '2', text: 'Move to the next PACE method.' },
      { step: '3', text: 'Initiate a welfare check if safe.' },
    ],

    channels: {
      // A worked example, not a prescription: every field here is free text, so
      // a unit on MURS, business band or an amateur allocation edits it rather
      // than working around it.
      sequence: [
        { id: 'ch-1', label: 'GMRS 7', short: '7', freq: '462.7125' },
        { id: 'ch-2', label: 'GMRS 12', short: '12', freq: '467.6625' },
        { id: 'ch-3', label: 'GMRS 17', short: '17', freq: '462.6000' },
        { id: 'ch-4', label: 'GMRS 22', short: '22', freq: '462.7250' },
      ],
      weather: {
        label: 'NWS Weather Radio',
        freq: '162.550',
        note:
          'Receive only. Keep one radio parked here during a watch or warning so the unit is not ' +
          'relaying weather traffic on the working channel.',
      },
      repeaters: [],
      caveat:
        'Verify before you rely on it. Program every radio in the unit to this list, in this order, ' +
        'so that a spoken channel name means the same thing on every handheld. Then confirm on a ' +
        'radio check that each one carries across the distances your unit actually works at, and ' +
        'adjust the sequence if it does not.',
    },

    rallyPoints: [
      rallyPoint('N', 'North'),
      rallyPoint('C', 'Central'),
      rallyPoint('W', 'West'),
    ],
    rallyGuidance:
      'Go when you are able to. No summons, no roll call. Report in on arrival, hold the cadence, ' +
      'and do not leave without passing it on the active channel.',
    rallyOnArrival: [
      'Report in on the highest working PACE method: {routine}.',
      'Note who else is present and pass that up with your next check-in.',
      'Hold the check-in cadence for the current status level from where you are.',
      'Monitor the active GMRS channel and Meshtastic if you have a node with you.',
      'Do not leave for another location without passing it on the active channel.',
    ],

    mesh: {
      url: '',
      qrImage: null,
      channelsVerified: false,
      channels: [],
      warning: 'Channels with a default or public key are readable by anyone in range.',
      note:
        'Scan with the Meshtastic app to load every channel and the radio configuration in one ' +
        'step. Scan and test before deployment, not during. A node that has never been tested is ' +
        'not a contingency, it is an assumption.',
      radioConfig: [],
    },

    // The heading is yours. These default to an OPSEC notice because that is
    // what these cards usually carry last, but the block is a free one — put
    // whatever your unit needs to read at the bottom of the card.
    remarks: {
      card: {
        heading: 'OPSEC',
        tone: 'warning',
        body:
          'Call signs and waypoint names only. Avoid real names and home locations. Assume every ' +
          'transmission is heard by someone outside the unit.',
      },
      label: {
        heading: 'OPSEC',
        tone: 'warning',
        body:
          'Call signs and waypoints only. No real names or home locations. Assume you are ' +
          'overheard.',
      },
      plan: {
        heading: 'Operational security',
        tone: 'warning',
        body:
          'Use only call signs and designated waypoint reference names. Avoid using real names, ' +
          'home locations, or other publicly identifiable information in a radio transmission. ' +
          'Never transmit sensitive or confidential information; assume every transmission is ' +
          'heard by someone outside the unit.',
      },
    },

    privacy: {
      mapsEnabled: false,
      geocodeEnabled: false,
    },
  }
}
