#!/usr/bin/env node
/**
 * Guard for this repository's hard constraint: nothing operationally sensitive
 * is committed.
 *
 * The app is public and hosted on GitHub Pages. Rally point venues, streets,
 * cities and coordinates, and Meshtastic channel names are all things a user
 * fills in at runtime and keeps in their own browser. The design references this
 * was built from carried real ones, so it is genuinely easy for a future change
 * to paste them back in — this fails the build if that happens.
 *
 * The deny-list is stored as truncated SHA-256 hashes of normalized word
 * n-grams, never as plaintext. A guard that spelled out the strings it was
 * looking for would itself be the disclosure it exists to prevent — which is
 * exactly what the first version of this file did.
 *
 *   node scripts/check-clean.mjs                 scan the tree
 *   node scripts/check-clean.mjs --list          show what is scanned for
 *   node scripts/check-clean.mjs --hash "text"   hash a phrase to add below
 *
 * To add a rule, run --hash and commit the resulting line. Never commit the
 * phrase.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()

const SKIP_DIRS = new Set(['.git', 'node_modules', 'test-results', 'playwright-report', '.vite'])

/** Checked by name rather than content. */
const BINARY = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.zip',
  '.woff', '.woff2', '.ttf', '.otf', '.ico',
])

const FONT = /\.(woff2?|ttf|otf)$/i

// ---------------------------------------------------------------- deny-list

/** Normalize so punctuation and case cannot dodge a match. */
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const digest = (s) => createHash('sha256').update(normalize(s)).digest('hex').slice(0, 16)

/**
 * Hashes of the first word of every denied phrase. Scanning hashes each word
 * once and only builds n-grams where one of these hits, which keeps a full-tree
 * scan fast without revealing anything.
 */
const FIRST_WORDS = new Set([
  '1158e7e12c5e7362',
  '13984a4e7e0edce8',
  '180ca01b95f0dfdd',
  '1b16b1df538ba12d',
  '1ff474b06c92dfea',
  '60a0f78b507f6249',
  '70511dc59e4c1f7f',
  '746692549e7f08fb',
  '7c30057a5b553715',
  '8241649609f88ccd',
  '86e5014965866131',
  '8cb6279a8e1b12a9',
  '958272842345dc51',
  '999fd90dab458028',
  '9bbfd9ee2035af2b',
  'b9776d7ddf459c9a',
  'dc365e79d41cfae1',
  'df4134412a080a32',
  'ee58826f2d047d5f',
])

/** [hash, word count, what it is]. Longest n-gram in the list: */
const MAX_NGRAM = 6

const DENY = [
  ['00f4c1d50fd21a16', 2, 'a rally point coordinate'],
  ['06333266f3f575e4', 2, 'a Meshtastic channel name'],
  ['0e1cdc7e7f6aae2a', 6, 'a rally point venue name'],
  ['0e4695ca9ff10ff3', 3, 'a rally point street address'],
  ['1461d344934ee18a', 2, 'a rally point coordinate'],
  ['1dc151358be97642', 2, 'a rally point coordinate'],
  ['23772caa4c83d384', 2, 'a rally point coordinate'],
  ['28b89c5977ee9eac', 2, 'a rally point coordinate'],
  ['2a2810372215d7fa', 2, 'a rally point venue name'],
  ['36fe90b947375216', 2, 'the organization this was built for'],
  ['470be72352a5277e', 2, 'a rally point coordinate'],
  ['69923147083e1102', 3, 'a rally point venue name'],
  ['746692549e7f08fb', 1, 'a Meshtastic channel name'],
  ['84ab1112f048fb39', 4, 'a rally point street address'],
  ['8534ac814042ebae', 3, 'a rally point street address'],
  ['89dfba821a9a7b81', 3, 'a rally point street address'],
  ['8d69e5fbababc265', 3, 'a rally point street address'],
  ['8e3e81ed398376cb', 3, 'a rally point city'],
  ['8fa3d39f32369f3e', 4, 'a rally point street address'],
  ['958272842345dc51', 1, 'the organization this was built for'],
  ['999fd90dab458028', 1, 'the organization this was built for'],
  ['a129fa536cebf5c2', 5, 'the organization this was built for'],
  ['b1272ad887b96ba0', 5, 'a rally point venue name'],
  ['b859c9c09e662b6e', 2, 'a rally point venue name'],
  ['be3bcfc45e779b19', 3, 'a rally point street address'],
  ['cb0b216b91492a7f', 2, 'a rally point street address'],
  ['e8a502d3817cd7ff', 2, 'a rally point street address'],
  ['ee58826f2d047d5f', 1, 'a Meshtastic channel name'],
  ['fefa6b01f3b5662f', 2, 'a rally point city'],
]

const DENY_BY_HASH = new Map(DENY.map(([hash, n, label]) => [hash, { n, label }]))

/** Why each category must not appear, for the failure message. */
const WHY = {
  'a rally point venue name': 'Venue names identify where a unit gathers.',
  'a rally point street address':
    'Street addresses are exactly what the printed OPSEC notice says not to share.',
  'a rally point city': 'The city narrows a unit to a place.',
  'a rally point coordinate':
    'Coordinates are the same disclosure as an address, in a form maps take directly.',
  'a Meshtastic channel name': 'Channel names disclose a unit’s mesh layout.',
  'the organization this was built for':
    'The default document ships as a neutral example; a real org name belongs in a user’s own ' +
    'saved file, not in the repository.',
}

// ------------------------------------------------------------- shape rules

/**
 * Patterns that describe a *shape* rather than a known value, so they catch
 * content nobody has thought to add to the deny-list. These are safe to write
 * in plaintext because they name no location and no channel.
 */
const SHAPES = [
  {
    name: 'a Meshtastic provisioning URL',
    why: 'A provisioning URL carries the actual channel keys.',
    pattern: /meshtastic\.org\/e\/#[A-Za-z0-9_-]{8,}/,
  },
  {
    name: 'a decimal-degree coordinate pair',
    why: 'Coordinates are the same disclosure as an address, in a form maps take directly.',
    // Four or more decimals on both halves: precise enough to be a real place,
    // and past what the app's own round-numbered format hints use.
    pattern: /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/,
  },
]

// -------------------------------------------------------------------- scan

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) yield* walk(full)
    else yield full
  }
}

/** Denied n-grams present in `text`, as {label} findings with a line number. */
function scanNgrams(text) {
  const found = []
  const words = []
  const offsets = []
  const re = /[a-z0-9]+/g
  const lower = text.toLowerCase()
  let m
  while ((m = re.exec(lower)) !== null) {
    words.push(m[0])
    offsets.push(m.index)
  }

  for (let i = 0; i < words.length; i++) {
    if (!FIRST_WORDS.has(digest(words[i]))) continue
    for (let n = 1; n <= MAX_NGRAM && i + n <= words.length; n++) {
      const hit = DENY_BY_HASH.get(digest(words.slice(i, i + n).join(' ')))
      if (hit && hit.n === n) {
        found.push({ label: hit.label, line: text.slice(0, offsets[i]).split('\n').length })
      }
    }
  }
  return found
}

// ------------------------------------------------------------------- modes

const args = process.argv.slice(2)

if (args[0] === '--hash') {
  const phrase = args.slice(1).join(' ')
  if (!phrase) {
    console.error('Usage: node scripts/check-clean.mjs --hash "the phrase"')
    process.exit(2)
  }
  const words = normalize(phrase).split(' ').filter(Boolean)
  console.log(`  ['${digest(phrase)}', ${words.length}, 'describe it here'],`)
  console.log(`  first word: '${digest(words[0])}'  (add to FIRST_WORDS)`)
  if (words.length > MAX_NGRAM) console.log(`  raise MAX_NGRAM to ${words.length}`)
  process.exit(0)
}

if (args.includes('--list')) {
  const counts = {}
  for (const [, , label] of DENY) counts[label] = (counts[label] ?? 0) + 1
  console.log('Denied phrases (stored as hashes, never as plaintext):')
  for (const [label, n] of Object.entries(counts)) console.log(`  - ${label}: ${n} variants`)
  console.log('Shape rules:')
  for (const s of SHAPES) console.log(`  - ${s.name}`)
}

const findings = []
let scanned = 0

for (const path of walk(ROOT)) {
  const rel = relative(ROOT, path)

  if (BINARY.has(extname(rel).toLowerCase())) {
    // No image is committed except the fonts the build pulls in, so any image
    // under public/ or src/ is worth a human look — a QR code is an image.
    if (/^(public|src)\//.test(rel) && !FONT.test(rel)) {
      findings.push({
        rel,
        rule: 'a committed image',
        why: 'A QR code is an image; no image belongs in this repository.',
      })
    }
    continue
  }

  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    continue
  }
  scanned++

  for (const hit of scanNgrams(text)) {
    findings.push({ rel: `${rel}:${hit.line}`, rule: hit.label, why: WHY[hit.label] })
  }

  for (const shape of SHAPES) {
    const m = shape.pattern.exec(text)
    if (m) {
      findings.push({
        rel: `${rel}:${text.slice(0, m.index).split('\n').length}`,
        rule: shape.name,
        why: shape.why,
      })
    }
  }
}

const unique = []
const seen = new Set()
for (const f of findings) {
  const key = `${f.rel}|${f.rule}`
  if (seen.has(key)) continue
  seen.add(key)
  unique.push(f)
}
findings.length = 0
findings.push(...unique)

if (findings.length === 0) {
  console.log(`check-clean: ${scanned} files scanned, nothing sensitive committed.`)
  process.exit(0)
}

console.error('\ncheck-clean FAILED — operationally sensitive content is committed:\n')
for (const f of findings) {
  console.error(`  ${f.rel}`)
  console.error(`    matched: ${f.rule}`)
  if (f.why) console.error(`    ${f.why}`)
  console.error('')
}
console.error(
  'This repository is public. Move the value into the app as user-entered content.\n' +
    'The matched text is deliberately not printed here — look at the line above.\n',
)
process.exit(1)
