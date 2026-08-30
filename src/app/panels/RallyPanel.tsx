import { useState } from 'react'
import type { Doc, RallyPoint } from '../../doc/schema'
import { formatCoords, geocode, geocodeUrl, parseCoords, type GeocodeHit } from '../../maps/geocode'
import { TextArea, TextField } from './Field'

/**
 * Rally points, plus the two features that reach the network.
 *
 * Coordinates are entered by hand by default. Looking one up sends a real
 * address to a third-party service, and on a card whose own OPSEC notice says
 * "avoid home locations" that request is the user's call to make, not a
 * convenience we should take on their behalf. The dialog shows the exact URL
 * before anything is sent.
 */
export function RallyPanel({
  doc,
  update,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  const [pending, setPending] = useState<{ index: number; query: string } | null>(null)

  return (
    <div className="panel">
      <section>
        <h2>Rally points</h2>
        {doc.rallyPoints.map((rp, i) => (
          <RallyCard
            key={rp.id}
            rp={rp}
            mapsEnabled={doc.privacy.mapsEnabled}
            onChange={(fn) => update((d) => fn(d.rallyPoints[i]!))}
            onRemove={() => update((d) => void d.rallyPoints.splice(i, 1))}
            onLookup={(query) => setPending({ index: i, query })}
          />
        ))}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() =>
            update((d) =>
              void d.rallyPoints.push({
                id: `rp-${Date.now().toString(36)}`,
                key: String.fromCharCode(65 + d.rallyPoints.length),
                name: 'New point',
                venue: '[Venue name]',
                street: '[Street address]',
                city: '[City]',
                shortCity: '[City]',
                coords: null,
                coordsApproximate: false,
                showMap: false,
              }),
            )
          }
        >
          Add rally point
        </button>
      </section>

      <section>
        <h2>Guidance</h2>
        <TextArea
          label="Rally point guidance (fold card)"
          rows={3}
          value={doc.rallyGuidance}
          onChange={(v) => update((d) => void (d.rallyGuidance = v))}
        />
      </section>

      <section>
        <h2>Maps</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={doc.privacy.mapsEnabled}
            onChange={(e) => update((d) => void (d.privacy.mapsEnabled = e.target.checked))}
          />
          <span>
            Draw maps in the plan template. This loads tiles from
            {' '}<code>tile.openstreetmap.org</code>, which means your rally point coordinates are
            sent to OpenStreetMap as tile requests. Off by default.
          </span>
        </label>
      </section>

      {pending ? (
        <GeocodeDialog
          query={pending.query}
          onCancel={() => setPending(null)}
          onPick={(hit) => {
            update((d) => {
              const rp = d.rallyPoints[pending.index]!
              rp.coords = { lat: hit.lat, lon: hit.lon }
              rp.coordsApproximate = false
              d.privacy.geocodeEnabled = true
            })
            setPending(null)
          }}
        />
      ) : null}
    </div>
  )
}

function RallyCard({
  rp,
  mapsEnabled,
  onChange,
  onRemove,
  onLookup,
}: {
  rp: RallyPoint
  mapsEnabled: boolean
  onChange: (fn: (rp: RallyPoint) => void) => void
  onRemove: () => void
  onLookup: (query: string) => void
}) {
  const [paste, setPaste] = useState('')
  const query = [rp.venue, rp.street, rp.city].filter((s) => s && !/^\[.*\]$/.test(s)).join(', ')

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">
          {rp.key} · {rp.name}
        </span>
        <button type="button" className="btn btn--ghost btn--small" onClick={onRemove}>
          Remove
        </button>
      </div>

      <div className="row">
        <div style={{ width: '3.5rem' }}>
          <span className="field__label">Pin</span>
          <input
            aria-label="Pin letter"
            maxLength={1}
            value={rp.key}
            onChange={(e) => onChange((r) => void (r.key = e.target.value.toUpperCase().slice(0, 1)))}
                      />
        </div>
        <div className="grow">
          <TextField label="Name" value={rp.name} onChange={(v) => onChange((r) => void (r.name = v))} />
        </div>
      </div>

      <TextField label="Venue" value={rp.venue} onChange={(v) => onChange((r) => void (r.venue = v))} />
      <TextField label="Street" value={rp.street} onChange={(v) => onChange((r) => void (r.street = v))} />
      <TextField label="City" value={rp.city} onChange={(v) => onChange((r) => void (r.city = v))} />
      <TextField
        label="City (label)"
        value={rp.shortCity}
        onChange={(v) => onChange((r) => void (r.shortCity = v))}
        hint="Abbreviated for the 62 mm label, where the full city name will not fit."
      />

      <div style={{ marginTop: '0.6rem' }}>
        <span className="field__label">Coordinates</span>
        <div className="row">
          <input
            className="grow mono"
            aria-label="Coordinates"
            placeholder="latitude, longitude"
            value={rp.coords ? formatCoords(rp.coords) : paste}
            onChange={(e) => {
              setPaste(e.target.value)
              const parsed = parseCoords(e.target.value)
              onChange((r) => {
                r.coords = parsed
                // Typed by hand, so flag it: the reference plan had a point with
                // no OpenStreetMap entry whose coordinate was the nearest mapped
                // spot on the road, and losing that caveat loses real meaning.
                r.coordsApproximate = parsed != null
              })
            }}
          />
          {rp.coords ? (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                setPaste('')
                onChange((r) => {
                  r.coords = null
                  r.coordsApproximate = false
                })
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="row" style={{ marginTop: '0.35rem' }}>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={!query}
            onClick={() => onLookup(query)}
            title={query ? `Look up “${query}”` : 'Fill in the address first'}
          >
            Look up address…
          </button>
          {rp.coords ? (
            <label className="checkbox" style={{ fontSize: '0.75rem' }}>
              <input
                type="checkbox"
                checked={rp.coordsApproximate}
                onChange={(e) => onChange((r) => void (r.coordsApproximate = e.target.checked))}
              />
              <span>Approximate</span>
            </label>
          ) : null}
        </div>
      </div>

      <label className="checkbox" style={{ marginTop: '0.6rem' }}>
        <input
          type="checkbox"
          checked={rp.showMap}
          onChange={(e) => onChange((r) => void (r.showMap = e.target.checked))}
        />
        <span>
          Street map in the plan
          {!mapsEnabled ? ' (maps are currently off)' : rp.coords ? '' : ' (needs coordinates)'}
        </span>
      </label>
    </div>
  )
}

/**
 * Consent before a rally point address leaves the machine. The exact request
 * URL is shown, not a summary of it — "we may share data with partners" is how
 * you get people to stop reading.
 */
function GeocodeDialog({
  query,
  onCancel,
  onPick,
}: {
  query: string
  onCancel: () => void
  onPick: (hit: GeocodeHit) => void
}) {
  const [state, setState] = useState<'ask' | 'loading' | 'done' | 'error'>('ask')
  const [hits, setHits] = useState<GeocodeHit[]>([])
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setState('loading')
    try {
      const results = await geocode(query)
      setHits(results)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  return (
    <div className="modal__backdrop" role="dialog" aria-modal="true" aria-label="Look up address">
      <div className="modal">
        <h2>This sends the address to OpenStreetMap</h2>
        <p>
          Looking up coordinates means transmitting the rally point address to
          {' '}<code>nominatim.openstreetmap.org</code>, a public third-party service. Nothing else
          in this app makes a network request with your content in it, and this one is entirely
          optional — you can type the coordinates in by hand instead.
        </p>
        <div className="code">{geocodeUrl(query)}</div>

        {state === 'error' ? <p className="notice notice--bad">{error}</p> : null}

        {state === 'done' ? (
          hits.length === 0 ? (
            <p className="notice">
              OpenStreetMap has no entry for that address. This is common for churches, community
              halls and rural addresses without a mapped house number — find the spot on a map and
              type the coordinates in instead.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
              {hits.map((hit, i) => (
                <li key={i} style={{ marginBottom: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => onPick(hit)}
                  >
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
                      {formatCoords(hit)}
                    </span>
                    <br />
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {hit.displayName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        <div className="row">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {state === 'done' ? 'Close' : 'Cancel'}
          </button>
          {state !== 'done' ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={send}
              disabled={state === 'loading'}
            >
              {state === 'loading' ? 'Looking up…' : 'Send it'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
