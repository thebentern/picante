/**
 * Address lookup through OpenStreetMap's Nominatim.
 *
 * This is the only outbound request the app makes with user content in it, and
 * it carries a rally point address. It runs only after the user has been shown
 * the exact string being sent and has said yes — see GeocodeDialog. Manual
 * coordinate entry is the default and always available.
 */

export interface GeocodeHit {
  lat: number
  lon: number
  displayName: string
}

export class GeocodeError extends Error {}

export const NOMINATIM_HOST = 'nominatim.openstreetmap.org'

/** The exact URL a lookup would request, so the consent dialog can show it. */
export function geocodeUrl(query: string): string {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5' })
  return `https://${NOMINATIM_HOST}/search?${params}`
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const trimmed = query.trim()
  if (!trimmed) throw new GeocodeError('Enter an address first.')

  let res: Response
  try {
    res = await fetch(geocodeUrl(trimmed), {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new GeocodeError(
      'Could not reach OpenStreetMap. Check the connection, or enter the coordinates by hand.',
    )
  }
  if (!res.ok) {
    throw new GeocodeError(`OpenStreetMap returned ${res.status}. Try again in a moment.`)
  }

  const body = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  return body
    .map((r) => ({ lat: Number(r.lat), lon: Number(r.lon), displayName: r.display_name }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
}

/**
 * Parse a pasted coordinate pair. Accepts "34.0, -92.0", "34.0 -92.0", and the
 * parenthesised form apps copy to the clipboard.
 */
export function parseCoords(input: string): { lat: number; lon: number } | null {
  const m = /(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/.exec(input.trim())
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

export const formatCoords = (c: { lat: number; lon: number }) =>
  `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`
