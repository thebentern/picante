/**
 * Static reference copy for the full plan.
 *
 * This is template boilerplate, not document data: the NATO alphabet, radio
 * etiquette, and the sample transmission are the same for every unit that ever
 * prints this card, so putting them in the schema would only give the user 40
 * more fields to not edit. Anything that differs between units — channels,
 * rally points, check-in windows, the Meshtastic channel set — lives in the
 * document and stays in sync across all three templates.
 */

export const HOW_TO_USE = [
  'PACE stands for Primary, Alternate, Contingency, Emergency. It is one ordered ladder of ' +
    'communication methods for the whole unit. You do not choose a method by preference. You ' +
    'start at Primary and step down only when the method above it will not reach the unit.',
  'The unit moves together. When the group rolls to the next method or the next channel, everyone ' +
    'rolls; nobody stays behind on a dead channel waiting to be found. Page 1 is the field card. ' +
    'Carry it. Everything after page 1 is reference you read before a storm, not during one.',
]

export const THREE_THINGS = {
  title: 'Three things to do now',
  body:
    'Program your radio to the channel list in section 5. Scan the Meshtastic QR and confirm you ' +
    'see your unit channel. Learn your own call sign and the call signs of the people you work ' +
    'with most.',
}

export const CHECK_IN_INTRO =
  'Check-in frequency rises with the severity of the situation. The status level is set by whoever ' +
  'is coordinating and announced on the active method; when in doubt, use the higher frequency.'

export const CHECK_IN_CALLOUT = [
  {
    lead: 'Life safety overrides the clock.',
    body:
      'Injury, entrapment, or imminent danger is reported immediately and repeated until ' +
      'acknowledged, whatever the status level.',
  },
  {
    lead: 'NO CHANGE is still a required check-in.',
    body:
      'Silence is not a status. If nothing has happened, say so; an unanswered window starts the ' +
      'escalation below.',
  },
]

export const RALLY_INTRO =
  'The rally points exist to be used in a disaster. There is no summons and no roll call. Members ' +
  'go to a rally point when they are able to, and follow the protocols in this plan once they ' +
  'arrive. Choose the point you can reach safely, not the one nearest your house.'

export const BAND_PLAN_INTRO =
  'These are the channels the unit works on, in the order it steps through them: {rollover}. ' +
  'Program every radio to this list in this order, so that a spoken channel name means the same ' +
  'thing on every handheld in the unit.'

export const MESH_INTRO = [
  'Scanning this code loads every channel and the radio configuration in section 5 in one step. Do ' +
    'it before deployment and send a test message to confirm you appear on the mesh. A node that ' +
    'has never been tested is not a contingency, it is an assumption.',
  'Position precision is set so nodes share an approximate location rather than an exact one. Keep ' +
    'it that way unless the coordinator changes it for a specific operation.',
]

export const MESH_CONFIG_NOTE =
  'These are the values carried in the provisioning QR code. Scanning sets them; you should not ' +
  'need to enter them by hand.'

export const MAKING_A_CALL = [
  'Listen first and confirm the channel is clear.',
  'Press and hold PTT. Wait two seconds before speaking; speaking immediately clips your first word.',
  "Say the recipient's call sign.",
  'Follow with "this is" and your own call sign.',
  'Once they reply, pass your message.',
]

export const THINK_BEFORE = [
  'Decide what you are going to say and who it is for. Keep it concise, precise, and clear.',
  'Avoid long, complicated sentences. Break a long message into several short ones.',
  'Do not use abbreviations unless the whole group knows them.',
  'Leave a second or two between hand-offs so others can break in.',
  'Toss the conversation back with "over."',
]

export const ETIQUETTE = [
  'You cannot speak and listen at the same time.',
  'Do not interrupt if you hear others talking.',
  'Do not respond unless you hear your own call sign.',
  'Perform radio checks to confirm your radio works.',
  'Memorize the call signs and locations of the people you talk to regularly.',
]

export const SAMPLE_TRANSMISSION: { speaker: 'A' | 'B'; label: string; line: string }[] = [
  { speaker: 'A', label: 'JW:', line: 'Papa Hotel, this Juliet Whiskey. Over.' },
  { speaker: 'B', label: 'PH:', line: 'Juliet Whiskey, this Papa Hotel. Stand by. Over.' },
  { speaker: 'B', label: 'PH:', line: 'Juliet Whiskey, this Papa Hotel. Go ahead. Over.' },
  {
    speaker: 'A',
    label: 'JW:',
    line: 'Papa Hotel, this Juliet Whiskey, the meeting at Rally Point North tonight is canceled. Over.',
  },
  {
    speaker: 'B',
    label: 'PH:',
    line: 'Juliet Whiskey, this Papa Hotel. Affirmative. Thanks for the heads up. Over.',
  },
  {
    speaker: 'A',
    label: 'JW:',
    line: 'Papa Hotel, this Juliet Whiskey. I will let you know if I hear anything else. Out.',
  },
]

export const RADIO_TERMS: [string, string][] = [
  ['Go ahead', 'Resume transmission'],
  ['Say again', 'Re-transmit your message'],
  ['Stand by', 'Acknowledged, unable to respond now'],
  ['Roger', 'Received and understood'],
  ['Affirmative', 'Yes (avoid yup, nope)'],
  ['Negative', 'No'],
  ['Over', 'Transmission finished'],
  ['Out', 'Communication over, channel available'],
]

export const CHANNEL_VS_FREQUENCY =
  'For instance, on a UV-82, switch modes by holding the Menu button through a power cycle (volume ' +
  'knob off, then on). Channel mode (MR) selects pre-programmed channels and is what you use in ' +
  'the field. Frequency mode (VFO) is for a temporary assignment such as a test frequency or quick ' +
  'field programming.'

export const NATO: [string, string][] = [
  ['A', 'Alpha'], ['B', 'Bravo'], ['C', 'Charlie'], ['D', 'Delta'],
  ['E', 'Echo'], ['F', 'Foxtrot'], ['G', 'Golf'], ['H', 'Hotel'],
  ['I', 'India'], ['J', 'Juliet'], ['K', 'Kilo'], ['L', 'Lima'],
  ['M', 'Mike'], ['N', 'November'], ['O', 'Oscar'], ['P', 'Papa'],
  ['Q', 'Quebec'], ['R', 'Romeo'], ['S', 'Sierra'], ['T', 'Tango'],
  ['U', 'Uniform'], ['V', 'Victor'], ['W', 'Whiskey'], ['X', 'X-ray'],
  ['Y', 'Yankee'], ['Z', 'Zulu'],
]
