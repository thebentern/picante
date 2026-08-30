# picante

A browser-based builder for PACE emergency-communications reference cards.

Pick a template, edit the card in place, and get print-ready output: a fold card
for any office printer, a 62 × 100 mm thermal label for a Brother QL-500, and a
full multi-page plan. All three render from one shared document, so a channel or
a rally point is edited once and updated everywhere.

Everything runs in your browser. There is no account, no server, and no
analytics.

---

## Why it exists

The cards these replace were hand-authored HTML. Changing a rally point address
or a channel frequency meant editing markup, and getting a file that imported
correctly into a Brother label printer took several manual steps. Neither should
require a developer.

## What it does

**Nothing is assumed about your radios.** Channels are free-text name/frequency
rows in whatever order your unit rolls through them — FRS, GMRS, MURS, business
band, an amateur allocation, or a mix. FRS/GMRS and MURS band plans are bundled
as an insert menu so the common cases do not involve typing `462.7125` by hand,
but they insert rows rather than constraining them. Repeaters are
band-agnostic. The block
pinned to the bottom of each card is a free remarks block with its own heading;
it defaults to an OPSEC notice because that is what these cards usually carry
last, but it is yours to use. The prose tracks the data: write `{rollover}` in
the body copy and it renders the live channel sequence, so the plan cannot
contradict the cards.

**Three templates from one document.**

| Template | Size | Notes |
|---|---|---|
| Fold card | 8.5 × 11 in, single-sided | Folds in half to a double-sided 8.5 × 5.5 card. The back panel is rotated 180°, which is what makes the fold come out upright. |
| Thermal label | 62 × 100 mm | Brother QL-500 die-cut (DK-11202), 300 dpi, monochrome. |
| Full plan | Letter, ~8 pages | The reference guide the cards condense. |

**Print straight to a Brother QL over USB.** Connect the printer in Chrome or
Edge and print — no P-touch Editor, no import step, no rescaling. The bitmap sent
to the print head is the same thresholded 696 × 1109 dots the PNG export
contains, which is exactly the QL-500's printable grid for 62 mm media. 62 mm is
the widest media a QL-500 takes and the only width this design fits, so that is
the only media offered.

**Exports that land at the right size.**

- **PNG, 300 dpi** — exactly 696 × 1109 px, pure black and white, tagged with a
  `pHYs` density chunk. That last part is what makes P-touch Editor place it at
  label size instead of dropping it in as a small floating image.
- **PNG, 600 dpi** — exactly 1392 × 2218 px, for when P-touch downscales.
- **PDF, exactly 62 × 100 mm** — the raster wrapped in a PDF whose page box is
  set in points, so the geometry does not depend on print-dialog settings.
- **Print to PDF** — keeps live text; the app lists the dialog settings that
  matter.

**Overflow detection.** Both card templates are fixed-height with
`overflow: hidden`, so surplus content is discarded with no warning — and
`margin-top: auto` on a bottom-pinned block collapses under pressure, meaning
the thing that vanishes first is the remarks block at the bottom. The app
measures after every edit, names the block and the pixel overrun, and blocks
export. It runs the
check a second time against the fallback font stack, because a card is often
printed by someone the file was emailed to.

**Meshtastic provisioning.** Paste your `meshtastic.org/e/#…` URL: the QR is
generated in your browser and the channel list is decoded out of the code
itself, so the printed roles cannot drift from what the radios are actually
provisioned with. Channels using a default or public key are flagged, and the
cards carry the warning automatically.

## Privacy

This is a tool whose own printed advice is "avoid real names and home
locations". It behaves accordingly.

- The document lives in your browser's local storage and in JSON files you
  export. Nothing is uploaded.
- There is deliberately **no share-by-link**. A URL fragment would have been
  free to build and would have put rally point addresses into browser history
  and into every chat window the link was pasted into.
- The only outbound requests the app can make with your content in them are
  OpenStreetMap map tiles and address lookups. Both are **off until you turn
  them on**, and the address lookup shows you the exact URL before sending
  anything.
- No sensitive content is committed to this repository: no organization name,
  rally point addresses or coordinates, no Meshtastic QR, URL or channel names.
  The default document is a neutral worked example with placeholders you fill
  in, and `npm run check:clean` enforces that on every build — its deny-list is
  stored as hashes rather than plaintext, because a guard that spells out the
  strings it looks for is itself the disclosure it exists to prevent.

## Browser support

Everything except direct USB printing works anywhere. **WebUSB printing needs
Chrome or Edge over HTTPS** — elsewhere the app hides the button and points at
the PNG export, which produces identical output.

## Development

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run typecheck` | Types only |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Build, then Playwright |
| `npm run check:clean` | Fail if anything sensitive is committed |

### Provenance

The three templates were rebuilt from a set of design references — hand-authored
HTML prototypes that fixed the print geometry, type scale and content structure.
Those files are not in this repository (they carried real operational content),
so comments citing "the handoff" or a `.dc.html` reference are pointing at
material you will not find here. The measurements they describe are all in
`src/templates/`, which is now the spec.

### How it is put together

```
src/
  doc/         the document: schema, defaults, migrations, the FCC channel
               table, derived advisories, and the store
  templates/   one component per footprint, plus Page.tsx — the page geometry
               and @page rules that make a 62 × 100 mm PDF actually that size
  editing/     in-place editing on the rendered card
  overflow/    the offscreen probe that measures clipping
  export/      raster pipeline, pHYs density, PDF, print
  print/       Brother QL raster protocol and WebUSB transport
  mesh/        provisioning URL decode and QR generation
  maps/        opt-in OpenStreetMap maps and geocoding
  app/         editor chrome
```

### Testing

The unit tests pin the things that are easy to get subtly wrong and impossible
to eyeball: the `pHYs` bytes, the 1-bit threshold, the QL raster wire format,
the channel-set decode, the schema migrations.

The Playwright suite is where the real verification happens. It drives the
production build and checks that the exports are what they claim: byte-exact
dimensions, pure 1-bit output, the right physical density, a one-page PDF at the
right size, and — because a rasterizer that mis-measures text will silently wrap
a line and you only see it in the PNG — a diff of the label rendered two
independent ways. `tests/unit/compare.test.ts` pins the sensitivity of that
diff, so its threshold is grounded rather than guessed.

There are also tests asserting that no third-party request happens without
consent, and that the print path produces the right page geometry with none of
the editing chrome on it.

## Deployment

Pushes to `master` build and publish to GitHub Pages. `vite.config.ts` sets
`base: './'`, so the same build works at a project-pages URL or behind a custom
domain with no rebuild.

## Credits

The Brother QL raster encoder and WebUSB transport are ported from
[meshtastic-readyline](https://github.com/Meshtastic-Solutions/meshtastic-readyline)
(GPL-3.0), narrowed to 62 mm media. The wire format follows
[brother_ql](https://github.com/pklaus/brother_ql), the reference implementation.

Maps use [OpenStreetMap](https://www.openstreetmap.org/copyright) data.
Typefaces are [Archivo](https://fonts.google.com/specimen/Archivo) and
[JetBrains Mono](https://www.jetbrains.com/lp/mono/), both SIL Open Font
License, self-hosted so the layout does not reflow — and clip — on a machine
that cannot reach a font CDN.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
